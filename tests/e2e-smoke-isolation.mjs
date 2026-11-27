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
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const env = {
  DB, BYPASS_TURNSTILE: "true", ADMIN_PASSWORD: "local-regression-only",
  ALLOWED_ORIGINS: "https://example.test",
};
async function call(path, { method = "GET", token, body, ip, cf } = {}) {
  const headers = { Origin: "https://example.test" };
  if (ip) headers["CF-Connecting-IP"] = ip;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const request = new Request(`https://api.example.test${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  const response = await handle(request, env);
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
  assert.equal((await call("/api/admin/dashboard")).status, 401);
  assert.equal((await call("/api/admin/dashboard", { token: normal.data.token })).status, 401);
  const dashboard = await call("/api/admin/dashboard", { token: admin.data.token });
  assert.equal(dashboard.status, 200);
  const student = dashboard.data.students.find(row => row.nim === "25110200041");
  assert.equal(student.voted, 1);
  assert.equal(student.group_method, "Berdasarkan minat tema UTS");
  themes.forEach((theme, i) => assert.equal(student["theme_rank_" + (i + 1)], theme));
  assert.equal(student.custom_theme, "Regression theme");
  assert.equal(student.reason, "class-regression");
  assert.ok(student.created_at && student.updated_at);
  const notVoted = dashboard.data.students.find(row => row.nim === "25110200029");
  assert.equal(notVoted.voted, 0);
  assert.equal(notVoted.group_method, null);
  assert.equal(notVoted.theme_rank_1, null);
  const csv = await call("/api/admin/export", { token: admin.data.token });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /class-regression/);
  assert.doesNotMatch(csv.text, /SMOKE-|smoke-regression/);
  const groups = await call("/api/admin/groups", { token: admin.data.token });
  assert.equal(groups.status, 200);
  assert.deepEqual(groups.data.groups.flat().map(row => row.nim), ["25110200041"]);

  const nim = "25110200041";
  const historyPath = "/api/admin/students/" + nim + "/history";
  assert.equal((await call(historyPath)).status, 401);
  assert.equal((await call(historyPath, { token: normal.data.token })).status, 401);
  assert.equal((await call("/api/admin/students/UNKNOWN/history", { token: admin.data.token })).status, 404);
  for (const query of ["?limit=0", "?limit=51", "?before=-1", "?before=invalid", "?limit=1.5"])
    assert.equal((await call(historyPath + query, { token: admin.data.token })).status, 400);
  await DB.prepare("INSERT INTO audit_log(actor,action,detail,created_at) VALUES(?,?,?,?)")
    .bind(nim, "save_vote", "Pilih anggota sendiri", "2026-11-26 20:00:00").run();
  const newerVote = {
    group_method: "Berdasarkan minat tema UTS",
    ...Object.fromEntries(themes.map((theme, i) => ["theme_rank_" + (i + 1), theme])),
    custom_theme: "Historical free title", reason: "First audited choice",
    ip: "198.51.100.99", city: "Spoofed body city"
  };
  assert.equal((await call("/api/vote", {
    method: "PUT", token: normal.data.token, body: newerVote,
    ip: "203.0.113.10", cf: { city: "Jakarta", region: "Jakarta", country: "ID", timezone: "Asia/Jakarta" }
  })).status, 200);
  const latestLogin = await call("/api/login", { method: "POST",
    body: { nim, name: "AINUN KHOLISHAH", turnstileToken: "local" },
    ip: "2001:db8::10", cf: { country: "ID", city: "Bandung", region: "West Java" }
  });
  assert.equal(latestLogin.status, 200);
  const firstPage = await call(historyPath + "?limit=2", { token: admin.data.token });
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.data.events.length, 2);
  assert.ok(firstPage.data.nextBefore);
  const [loginEvent, voteEvent] = firstPage.data.events;
  assert.equal(loginEvent.action, "login");
  assert.equal(loginEvent.network.ip, "2001:db8::10");
  assert.equal(loginEvent.network.city, "Bandung");
  assert.equal(voteEvent.action, "save_vote");
  assert.equal(voteEvent.network.ip, "203.0.113.10");
  assert.equal(voteEvent.network.city, "Jakarta");
  assert.equal(voteEvent.vote.custom_theme, "Historical free title");
  assert.equal(voteEvent.vote.reason, "First audited choice");
  assert.ok(voteEvent.created_at);
  const page2 = await call(historyPath + "?limit=2&before=" + firstPage.data.nextBefore, { token: admin.data.token });
  assert.equal(page2.status, 200);
  assert.ok(page2.data.events.every(event => event.id < firstPage.data.nextBefore));
  assert.ok(page2.data.events.some(event => event.legacy_method === "Pilih anggota sendiri" && event.network.ip === null));
  const updatedVote = { ...newerVote, reason: "Second audited choice" };
  assert.equal((await call("/api/vote", { method: "PUT", token: normal.data.token, body: updatedVote, ip: "203.0.113.20" })).status, 200);
  const history = (await call(historyPath, { token: admin.data.token })).data.events;
  assert.equal(history[0].vote.reason, "Second audited choice");
  assert.equal(history[0].network.city, null);
  assert.ok(history.some(event => event.vote?.reason === "First audited choice"));
  assert.ok(history.every(event => !JSON.stringify(event).includes("local-regression-only")));
  const auditBefore = sqlite.prepare("SELECT COUNT(*) n FROM audit_log WHERE actor=? AND action='save_vote'").get(nim).n;
  assert.equal((await call("/api/vote", { method: "PUT", token: normal.data.token, body: { ...updatedVote, theme_rank_1: "invalid" } })).status, 400);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM audit_log WHERE actor=? AND action='save_vote'").get(nim).n, auditBefore);
  sqlite.exec("CREATE TRIGGER reject_vote_audit BEFORE INSERT ON audit_log WHEN NEW.action='save_vote' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  await assert.rejects(call("/api/vote", { method: "PUT", token: normal.data.token, body: { ...updatedVote, reason: "Must roll back" } }));
  assert.equal(sqlite.prepare("SELECT reason FROM votes WHERE nim=?").get(nim).reason, "Second audited choice");
  sqlite.exec("DROP TRIGGER reject_vote_audit");
  sqlite.exec(readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../database/seed_students.sql", import.meta.url), "utf8"));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM audit_log WHERE actor=? AND action='save_vote'").get(nim).n, auditBefore);
  // Restore the local fixture's final choice for the existing reset assertions.
  assert.equal((await call("/api/vote", { method: "PUT", token: normal.data.token, body: { ...updatedVote, reason: "class-regression" } })).status, 200);
  console.log("PASS ACTIVITY HISTORY: admin-only, legacy timestamps, server metadata, immutable snapshots, pagination, reseed and atomic rollback");

  const reset = await call("/api/admin/reset-smoke-test", {
    method: "DELETE", token: admin.data.token,
  });
  assert.equal(reset.status, 200);
  assert.equal((await call("/api/me", { token: smoke.data.token })).status, 401);
  assert.equal((await call("/api/me", { token: normal.data.token })).status, 200);
  assert.equal((await call("/api/vote", { token: normal.data.token })).data.vote.reason, "class-regression");
  assert.equal((await call("/api/stats")).data.voted, 1);
  console.log("PASS SMOKE ISOLATION: real SQLite, admin-only vote details, reseed, statistics, CSV, groups, scoped reset, preserved class vote");
} finally {
  sqlite.close();
}
