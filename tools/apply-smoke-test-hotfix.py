from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SMOKE_NIM = "SMOKE-AIFN1-2026"
SMOKE_NAME = "LIVE SMOKE TEST AIFN1"

# 1. Add the reserved smoke-test account to the idempotent seed.
seed_path = ROOT / "database/seed_students.sql"
seed = seed_path.read_text(encoding="utf-8").rstrip()
if SMOKE_NIM not in seed:
    if not seed.endswith(";"):
        raise SystemExit("database/seed_students.sql must end with a semicolon")
    seed = seed[:-1] + f",\n('{SMOKE_NIM}','{SMOKE_NAME}',1);\n"
    seed_path.write_text(seed, encoding="utf-8")

# 2. Patch Worker queries. SQL containing 'SMOKE-%' uses JavaScript template
# literals, avoiding nested single-quote syntax errors.
worker_path = ROOT / "worker/src/index.js"
worker = worker_path.read_text(encoding="utf-8")

replacements = {
    "'SELECT COUNT(*) n FROM students WHERE active=1'":
        "`SELECT COUNT(*) n FROM students WHERE active=1 AND nim NOT LIKE 'SMOKE-%'`",
    "'SELECT COUNT(*) n FROM votes'":
        "`SELECT COUNT(*) n FROM votes WHERE nim NOT LIKE 'SMOKE-%'`",
    "'SELECT group_method label,COUNT(*) value FROM votes GROUP BY group_method ORDER BY value DESC'":
        "`SELECT group_method label,COUNT(*) value FROM votes WHERE nim NOT LIKE 'SMOKE-%' GROUP BY group_method ORDER BY value DESC`",
    "WHERE s.active=1 ORDER BY s.name":
        "WHERE s.active=1 ORDER BY CASE WHEN s.nim LIKE 'SMOKE-%' THEN 0 ELSE 1 END,s.name",
}
for old, new in replacements.items():
    if new not in worker:
        if old not in worker:
            raise SystemExit(f"Worker anchor not found: {old}")
        worker = worker.replace(old, new, 1)

old_theme = "SELECT theme_rank_1 theme,5 points FROM votes UNION ALL SELECT theme_rank_2,4 FROM votes UNION ALL SELECT theme_rank_3,3 FROM votes UNION ALL SELECT theme_rank_4,2 FROM votes UNION ALL SELECT theme_rank_5,1 FROM votes"
new_theme = "SELECT theme_rank_1 theme,5 points FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_2,4 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_3,3 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_4,2 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_5,1 FROM votes WHERE nim NOT LIKE 'SMOKE-%'"
if new_theme not in worker:
    if old_theme not in worker:
        raise SystemExit("Theme totals query anchor not found")
    worker = worker.replace(old_theme, new_theme, 1)

# 3. Add a narrowly scoped admin reset route.
reset_route = """if(p==='/api/admin/reset-smoke-test'&&req.method==='DELETE'){const smokeNim='SMOKE-AIFN1-2026';await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE nim=?').bind(smokeNim),env.DB.prepare('DELETE FROM votes WHERE nim=?').bind(smokeNim),env.DB.prepare('INSERT INTO audit_log(actor,action,detail) VALUES(?,?,?)').bind('admin','reset_smoke_test',smokeNim)]);return reply({ok:true,message:'Sesi login dan vote akun smoke test sudah direset.',nim:smokeNim},200,env,req)}
   """
if "/api/admin/reset-smoke-test" not in worker:
    reset_anchor = "if(p==='/api/admin/reset'&&req.method==='DELETE'){"
    if reset_anchor not in worker:
        raise SystemExit("Admin reset route anchor not found")
    worker = worker.replace(reset_anchor, reset_route + reset_anchor, 1)
worker_path.write_text(worker, encoding="utf-8")

# 4. Add admin card and handler.
admin_html_path = ROOT / "frontend/admin.html"
admin_html = admin_html_path.read_text(encoding="utf-8")
smoke_card = '<div class="card"><h2>Akun live smoke test</h2><p><strong>NIM:</strong> <code>SMOKE-AIFN1-2026</code><br><strong>Nama:</strong> <code>LIVE SMOKE TEST AIFN1</code></p><p class="muted">Akun ini tidak dihitung dalam statistik maupun hasil voting kelas.</p><button class="btn danger" id="resetSmoke">Reset login &amp; vote smoke test</button></div>'
if 'id="resetSmoke"' not in admin_html:
    html_anchor = '<div class="card"><h2>Ringkasan</h2><div id="stats" class="stats"></div></div>'
    if html_anchor not in admin_html:
        raise SystemExit("Admin HTML anchor not found")
    admin_html = admin_html.replace(html_anchor, html_anchor + smoke_card, 1)
admin_html_path.write_text(admin_html, encoding="utf-8")

admin_js_path = ROOT / "frontend/admin.js"
admin_js = admin_js_path.read_text(encoding="utf-8")
smoke_handler = "$('#resetSmoke').onclick=async()=>{if(!confirm('Reset sesi dan vote SMOKE-AIFN1-2026?'))return;try{const d=await api('/api/admin/reset-smoke-test',{method:'DELETE'});msg(d.message);await load()}catch(x){msg(x.message,true)}};"
if "$('#resetSmoke')" not in admin_js:
    js_anchor = "$('#reset').onclick=async()=>{if(!confirm('Hapus seluruh vote? Tindakan ini tidak dapat dibatalkan.'))return;try{await api('/api/admin/reset',{method:'DELETE'});msg('Seluruh vote direset.');await load()}catch(x){msg(x.message,true)}};"
    if js_anchor not in admin_js:
        raise SystemExit("Admin JavaScript anchor not found")
    admin_js = admin_js.replace(js_anchor, js_anchor + smoke_handler, 1)
admin_js_path.write_text(admin_js, encoding="utf-8")

# 5. Document the production smoke account.
doc_path = ROOT / "docs/LIVE_SMOKE_TEST.md"
doc_path.write_text(
    "# Live smoke test\n\n"
    "- NIM: `SMOKE-AIFN1-2026`\n"
    "- Nama: `LIVE SMOKE TEST AIFN1`\n\n"
    "Akun ini tidak dihitung dalam 37 mahasiswa maupun hasil voting. "
    "Reset melalui halaman admin hanya menghapus sesi dan vote akun smoke test.\n",
    encoding="utf-8",
)
print("Smoke-test hotfix v2 applied successfully.")
