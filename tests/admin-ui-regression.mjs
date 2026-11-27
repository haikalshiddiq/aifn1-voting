import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync(new URL("../frontend/admin.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../frontend/admin.js", import.meta.url), "utf8");
const dashboard = {
  status: "open", deadline: "2099-11-29T23:59:00+07:00",
  totalStudents: 37, voted: 1, remaining: 36, participation: 2.7,
  students: [
    { nim: "25110200041", name: "Student example", voted: 1,
      group_method: "Berdasarkan minat tema UTS", theme_rank_1: "Pembiayaan UMKM",
      theme_rank_2: "Pinjaman Koperasi", theme_rank_3: "Piutang Pelanggan Usaha",
      theme_rank_4: "Kemampuan Bayar Kredit Konsumtif", theme_rank_5: "Tema Finance Usulan Sendiri",
      custom_theme: '<img src=x onerror="attack()">',
      reason: "<script>attack()</script>", created_at: "2026-11-27 01:00:00", updated_at: "2026-11-27 01:30:00" },
    { nim: "25110200029", name: "Not voted student", voted: 0 }
  ]
};
async function flush() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
function response(data, status = 200) { return { ok: status < 400, status, async json() { return data; } }; }
async function boot({ token = null, oldError = "" } = {}) {
  const nodes = new Map();
  for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const classes = new Set((match[0].match(/class="([^"]*)"/)?.[1] || "").split(/\s+/));
    nodes.set("#" + match[1], {
      value: "", innerHTML: "", textContent: "", disabled: false,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }
    });
  }
  nodes.get("#message").innerHTML = oldError;
  const storage = new Map(token ? [["admin_token", token]] : []);
  const state = { dashboard: structuredClone(dashboard), loginCalls: 0, nextLogin: null, dashboardError: null };
  const turnstile = { getResponse: () => "local-ui-test", reset() {}, render: () => 0 };
  const sandbox = {
    window: { APP_CONFIG: { API_BASE: "https://api.example.test" }, turnstile }, turnstile,
    document: { querySelector: selector => {
      assert.ok(nodes.has(selector), "Element must exist in real admin.html: " + selector);
      return nodes.get(selector);
    } },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    async fetch(url) {
      if (url.endsWith("/api/config")) return response({ turnstileSiteKey: "local-test-key" });
      if (url.endsWith("/api/admin/login")) {
        state.loginCalls++;
        return state.nextLogin ? await state.nextLogin : response({ error: "Password admin salah." }, 401);
      }
      if (url.endsWith("/api/admin/dashboard")) return state.dashboardError
        ? response({ error: state.dashboardError }, 503) : response(state.dashboard);
      throw new Error("Unexpected request: " + url);
    },
    setInterval(callback) { queueMicrotask(callback); return 1; }, clearInterval() {},
    confirm() { throw new Error("No destructive actions allowed in this test"); },
    location: { reload() {} }, Date, Intl, console
  };
  vm.runInNewContext(source, sandbox, { filename: "admin.js" });
  await flush();
  return { nodes, state, storage };
}
const { nodes, state, storage } = await boot();
const submit = () => nodes.get("#form").onsubmit({ preventDefault() {} });
nodes.get("#password").value = "incorrect-local-value";
await submit();
assert.match(nodes.get("#message").innerHTML, /Password admin salah/);
assert.equal(nodes.get("#loginSubmit").disabled, false);
let releaseLogin;
state.nextLogin = new Promise(resolve => { releaseLogin = resolve; });
const pending = submit();
assert.equal(nodes.get("#message").innerHTML, "", "Clear old error immediately when retrying");
assert.equal(nodes.get("#loginSubmit").disabled, true);
await submit();
assert.equal(state.loginCalls, 2, "Only one request per pending login");
releaseLogin(response({ token: "local-admin-session" }));
await pending;
assert.equal(nodes.get("#message").innerHTML, "", "Successful login must clear previous password error");
assert.equal(storage.get("admin_token"), "local-admin-session");
assert.equal(nodes.get("#password").value, "");
assert.equal(nodes.get("#login").classList.contains("hidden"), true);
assert.equal(nodes.get("#panel").classList.contains("hidden"), false);
const table = nodes.get("#students").innerHTML;
for (const text of ["Lihat pilihan", ...Object.values(dashboard.students[0]).filter(v => typeof v === "string" && !v.includes("<") && !v.includes("2026-"))])
  assert.ok(table.includes(text), "Show saved choice: " + text);
assert.match(table, /&lt;img/);
assert.match(table, /&lt;script&gt;/);
assert.ok(!table.includes("<img") && !table.includes("<script>"), "Student text must be escaped");
assert.match(table, /Belum ada pilihan/);
assert.match(table, /08\.30|08:30/, "SQLite UTC update must display Jakarta time");
state.dashboard.students[0].reason = "New saved reason after refresh";
await nodes.get("#refresh").onclick();
assert.match(nodes.get("#students").innerHTML, /New saved reason after refresh/);
assert.match(nodes.get("#lastRefresh").textContent, /WIB/);
nodes.get("#search").value = "25110200029";
nodes.get("#search").oninput();
assert.ok(!nodes.get("#students").innerHTML.includes("25110200041"));
state.dashboardError = "Gagal memuat dashboard";
await nodes.get("#refresh").onclick();
assert.match(nodes.get("#message").innerHTML, /Gagal memuat dashboard/);
assert.equal(nodes.get("#refresh").disabled, false);
const restored = await boot({ token: "existing-local-session", oldError: "Password admin salah." });
assert.equal(restored.nodes.get("#message").innerHTML, "", "Session restore must clear stale login errors");
assert.equal(restored.nodes.get("#panel").classList.contains("hidden"), false);
console.log("PASS ADMIN UI: failed then successful login, duplicate submit blocked, restored session, vote details, escaping, WIB, search and refresh");
