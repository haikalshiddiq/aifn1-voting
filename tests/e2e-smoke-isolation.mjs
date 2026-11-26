import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handle } from "../worker/src/index.js";

// Real SQL execution: no SQL-pattern mocks and no production bindings.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8"));
sqlite.exec(readFileSync(new URL("../database/seed_students.sql", import.meta.url), "utf8"));
class Statement {
  constructor(sql) { this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { return sqlite.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
  async run() { sqlite.prepare(this.sql).run(...this.args); return { success: true }; }
}
const DB = {
  prepare(sql) { return new Statement(sql); },
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  },
};
const env = {
  DB, BYPASS_TURNSTILE: "true", ADMIN_PASSWORD: "local-regression-only",
  ALLOWED_ORIGINS: "https://example.test",
};
async function call(path, { method = "GET", token, body } = {}) {
  const headers = { Origin: "https://example.test" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await handle(new Request(`https://api.example.test${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  }), env);
  const text = await response.text();
  return { status: response.status, text,
    data: response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null };
}
const themes = ["Pembiayaan UMKM", "Pinjaman Koperasi", "Piutang Pelanggan Usaha",
  "Kemampuan Bayar Kredit Konsumtif", "Tema Finance Usulan Sendiri"];
try {
  await DB.prepare("UPDATE settings SET setting_value=? WHERE setting_key='deadline'")
    .bind("2099-11-29T23:59:00+07:00").run();
  const normal = await call("/api/login", { method: "POST", body: {
    nim: "25110200041", name: "AINUN KHOLISHAH", turnstileToken: "local",
  } });
  const smoke = await call("/api/login", { method: "POST", body: {
    nim: "SMOKE-AIFN1-2026", name: "LIVE SMOKE TEST AIFN1", turnstileToken: "local",
  } });
  assert.equal(normal.status, 200);
  assert.equal(smoke.status, 200);
  for (const [login, reason] of [[normal, "class-regression"], [smoke, "smoke-regression"]]) {
    const saved = await call("/api/vote", { method: "PUT", token: login.data.token, body: {
      group_method: "Berdasarkan minat tema UTS",
      ...Object.fromEntries(themes.map((theme, i) => [`theme_rank_${i + 1}`, theme])),
      custom_theme: "Regression theme", reason,
    } });
    assert.equal(saved.status, 200);
  }
  // Exercise reseeding against real dependent votes as well as handler SQL.
  sqlite.exec(readFileSync(new URL("../database/seed_students.sql", import.meta.url), "utf8"));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM votes").get().n, 2);
  const stats = await call("/api/stats");
  assert.equal(stats.status, 200);
  assert.equal(stats.data.totalStudents, 37);
  assert.equal(stats.data.voted, 1);
  assert.equal(stats.data.remaining, 36);
  assert.equal(stats.data.methods.reduce((n, row) => n + row.value, 0), 1);
  assert.equal(stats.data.themes.reduce((n, row) => n + row.value, 0), 15);
  const denied = await call("/api/admin/reset-smoke-test", { method: "DELETE" });
  assert.equal(denied.status, 401);
  const admin = await call("/api/admin/login", { method: "POST", body: {
    password: "local-regression-only", turnstileToken: "local",
  } });
  assert.equal(admin.status, 200);
  const csv = await call("/api/admin/export", { token: admin.data.token });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /class-regression/);
  assert.doesNotMatch(csv.text, /SMOKE-|smoke-regression/);
  const groups = await call("/api/admin/groups", { token: admin.data.token });
  assert.equal(groups.status, 200);
  assert.deepEqual(groups.data.groups.flat().map(row => row.nim), ["25110200041"]);
  const reset = await call("/api/admin/reset-smoke-test", {
    method: "DELETE", token: admin.data.token,
  });
  assert.equal(reset.status, 200);
  assert.equal((await call("/api/me", { token: smoke.data.token })).status, 401);
  assert.equal((await call("/api/me", { token: normal.data.token })).status, 200);
  assert.equal((await call("/api/vote", { token: normal.data.token })).data.vote.reason, "class-regression");
  assert.equal((await call("/api/stats")).data.voted, 1);
  console.log("PASS SMOKE ISOLATION: real SQLite, reseed, statistics, CSV, groups, scoped reset, preserved class vote");
} finally {
  sqlite.close();
}
