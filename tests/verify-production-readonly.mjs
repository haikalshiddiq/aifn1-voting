import assert from "node:assert/strict";
const api = (process.env.API_BASE || "").replace(/\/$/, "");
const site = (process.env.SITE_URL || "").replace(/\/$/, "");
const alias = (process.env.CLOUDFLARE_FRONTEND || "").replace(/\/$/, "");
assert.ok(api && site && alias, "API_BASE, SITE_URL and CLOUDFLARE_FRONTEND are required");
const origin = new URL(site).origin;
async function get(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
}
async function verify() {
  const health = await get(api + "/api/health", { headers: { Origin: origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), origin);
  assert.equal((await health.json()).ok, true);
  const configResponse = await get(api + "/api/config");
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json();
  assert.ok(config.turnstileSiteKey && !config.turnstileSiteKey.includes("REPLACE"));
  assert.ok(["open", "closed"].includes(config.status));
  const statsResponse = await get(api + "/api/stats");
  assert.equal(statsResponse.status, 200);
  const stats = await statsResponse.json();
  assert.equal(stats.totalStudents, 37);
  assert.ok(stats.voted >= 0 && stats.voted <= 37);
  assert.equal(stats.remaining, 37 - stats.voted);
  for (const [path, pattern] of [["/", /Voting UTS AiFn1/], ["/admin.html", /Admin Voting AiFn1/]]) {
    const page = await get(site + path);
    assert.equal(page.status, 200);
    assert.match(await page.text(), pattern);
    const redirected = await get(alias + path, { redirect: "manual" });
    assert.equal(redirected.status, 302);
    assert.equal(redirected.headers.get("location"), site + path);
  }
  const frontendConfig = await get(site + "/config.js");
  assert.equal(frontendConfig.status, 200);
  const source = await frontendConfig.text();
  assert.ok(!source.includes("__API_BASE__") && !source.includes("__TURNSTILE_SITE_KEY__"));
  assert.ok(source.includes(api) && source.includes(config.turnstileSiteKey));
  const unauthenticated = await get(api + "/api/admin/dashboard");
  assert.equal(unauthenticated.status, 401);
  // Empty Turnstile token must be rejected before a session can be created.
  const noChallenge = await get(api + "/api/login", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ nim: "SMOKE-AIFN1-2026", name: "LIVE SMOKE TEST AIFN1", turnstileToken: "" }),
  });
  assert.equal(noChallenge.status, 400);
  assert.match((await noChallenge.json()).error, /Turnstile/i);
  console.log("PASS PRODUCTION: health, D1 statistics (37 students), CORS, frontend/config/admin, Cloudflare redirects, admin auth, Turnstile required");
}
let lastError;
for (let attempt = 1; attempt <= 18; attempt++) {
  try { await verify(); lastError = null; break; }
  catch (error) {
    lastError = error;
    console.log("Waiting for production rollout, attempt " + attempt + ": " + error.message);
    if (attempt < 18) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
if (lastError) throw lastError;
