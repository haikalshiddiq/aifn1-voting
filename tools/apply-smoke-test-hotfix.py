from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace_once(path, old, new):
    p=ROOT/path; s=p.read_text(encoding='utf-8')
    if new in s: return
    if old not in s: raise SystemExit(f'Anchor not found in {path}: {old[:80]}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

# 1) Seed reserved production smoke account.
p=ROOT/'database/seed_students.sql'; s=p.read_text(encoding='utf-8').rstrip()
if 'SMOKE-AIFN1-2026' not in s:
    if not s.endswith(';'): raise SystemExit('seed_students.sql must end with semicolon')
    s=s[:-1]+",\n('SMOKE-AIFN1-2026','LIVE SMOKE TEST AIFN1',1);\n"
    p.write_text(s,encoding='utf-8')

# 2) Exclude smoke account from class stats/results.
p=ROOT/'worker/src/index.js'; s=p.read_text(encoding='utf-8')
repls={
"SELECT COUNT(*) n FROM students WHERE active=1":"SELECT COUNT(*) n FROM students WHERE active=1 AND nim NOT LIKE 'SMOKE-%'",
"SELECT COUNT(*) n FROM votes":"SELECT COUNT(*) n FROM votes WHERE nim NOT LIKE 'SMOKE-%'",
"SELECT group_method label,COUNT(*) value FROM votes GROUP BY group_method":"SELECT group_method label,COUNT(*) value FROM votes WHERE nim NOT LIKE 'SMOKE-%' GROUP BY group_method",
"SELECT theme_rank_1 theme,5 points FROM votes UNION ALL SELECT theme_rank_2,4 FROM votes UNION ALL SELECT theme_rank_3,3 FROM votes UNION ALL SELECT theme_rank_4,2 FROM votes UNION ALL SELECT theme_rank_5,1 FROM votes":"SELECT theme_rank_1 theme,5 points FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_2,4 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_3,3 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_4,2 FROM votes WHERE nim NOT LIKE 'SMOKE-%' UNION ALL SELECT theme_rank_5,1 FROM votes WHERE nim NOT LIKE 'SMOKE-%'",
"WHERE s.active=1 ORDER BY s.name":"WHERE s.active=1 ORDER BY CASE WHEN s.nim LIKE 'SMOKE-%' THEN 0 ELSE 1 END,s.name",
}
for old,new in repls.items():
    if new not in s:
        if old not in s: raise SystemExit(f'Worker anchor missing: {old[:60]}')
        s=s.replace(old,new,1)

# 3) Add admin-only targeted reset endpoint.
endpoint="""if(p==='/api/admin/reset-smoke-test'&&req.method==='DELETE'){const smokeNim='SMOKE-AIFN1-2026';await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE nim=?').bind(smokeNim),env.DB.prepare('DELETE FROM votes WHERE nim=?').bind(smokeNim),env.DB.prepare('INSERT INTO audit_log(actor,action,detail) VALUES(?,?,?)').bind('admin','reset_smoke_test',smokeNim)]);return reply({ok:true,message:'Sesi login dan vote akun smoke test sudah direset.',nim:smokeNim},200,env,req)}
   """
if '/api/admin/reset-smoke-test' not in s:
    anchor="if(p==='/api/admin/reset'&&req.method==='DELETE'){"
    if anchor not in s: raise SystemExit('Admin reset endpoint anchor missing')
    s=s.replace(anchor,endpoint+anchor,1)
p.write_text(s,encoding='utf-8')

# 4) Admin UI.
p=ROOT/'frontend/admin.html'; s=p.read_text(encoding='utf-8')
card='<div class="card"><h2>Akun live smoke test</h2><p><strong>NIM:</strong> <code>SMOKE-AIFN1-2026</code><br><strong>Nama:</strong> <code>LIVE SMOKE TEST AIFN1</code></p><p class="muted">Akun ini tidak dihitung dalam statistik maupun hasil voting kelas.</p><button class="btn danger" id="resetSmoke">Reset login &amp; vote smoke test</button></div>'
if 'id="resetSmoke"' not in s:
    anchor='<div class="card"><h2>Ringkasan</h2><div id="stats" class="stats"></div></div>'
    if anchor not in s: raise SystemExit('Admin HTML anchor missing')
    s=s.replace(anchor,anchor+card,1)
p.write_text(s,encoding='utf-8')

p=ROOT/'frontend/admin.js'; s=p.read_text(encoding='utf-8')
handler="$('#resetSmoke').onclick=async()=>{if(!confirm('Reset sesi dan vote SMOKE-AIFN1-2026?'))return;try{const d=await api('/api/admin/reset-smoke-test',{method:'DELETE'});msg(d.message);await load()}catch(x){msg(x.message,true)}};"
if "$('#resetSmoke')" not in s:
    anchor="$('#reset').onclick=async()=>{if(!confirm('Hapus seluruh vote? Tindakan ini tidak dapat dibatalkan.'))return;try{await api('/api/admin/reset',{method:'DELETE'});msg('Seluruh vote direset.');await load()}catch(x){msg(x.message,true)}};"
    if anchor not in s: raise SystemExit('Admin JS anchor missing')
    s=s.replace(anchor,anchor+handler,1)
p.write_text(s,encoding='utf-8')

# 5) Documentation.
(ROOT/'docs/LIVE_SMOKE_TEST.md').write_text('''# Live smoke test\n\n- NIM: `SMOKE-AIFN1-2026`\n- Nama: `LIVE SMOKE TEST AIFN1`\n\nAkun ini tidak dihitung dalam 37 mahasiswa maupun hasil voting. Reset melalui halaman admin hanya menghapus sesi dan vote akun smoke test.\n''',encoding='utf-8')
print('Smoke-test hotfix applied successfully.')
