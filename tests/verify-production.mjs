import assert from 'node:assert/strict';
const api=(process.env.API_BASE||'').replace(/\/$/,'');
const site=(process.env.SITE_URL||'').replace(/\/$/,'');
if(!api||!site){console.error('Gunakan API_BASE=https://... SITE_URL=https://... node tests/verify-production.mjs');process.exit(2)}
async function get(url){const r=await fetch(url,{headers:{Origin:site}});const text=await r.text();return {r,text}}
const health=await get(api+'/api/health');assert.equal(health.r.status,200);const h=JSON.parse(health.text);assert.equal(h.ok,true);
const config=await get(api+'/api/config');assert.equal(config.r.status,200);const c=JSON.parse(config.text);assert.ok(c.turnstileSiteKey&&!c.turnstileSiteKey.includes('REPLACE'));assert.ok(c.deadline);assert.ok(['open','closed'].includes(c.status));
const page=await get(site+'/');assert.equal(page.r.status,200);assert.match(page.text,/Voting UTS AiFn1/);
const cfg=await get(site+'/config.js');assert.equal(cfg.r.status,200);assert.ok(!cfg.text.includes('__API_BASE__'));assert.ok(!cfg.text.includes('__TURNSTILE_SITE_KEY__'));assert.ok(cfg.text.includes(api));
const admin=await get(site+'/admin.html');assert.equal(admin.r.status,200);assert.match(admin.text,/Admin Voting AiFn1/);
console.log('PASS PRODUCTION SMOKE: Worker health/config, Pages index/config/admin, placeholders replaced.');
