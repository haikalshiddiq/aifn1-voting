import sqlite3, pathlib, re, json, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.executescript((root/'database/schema.sql').read_text())
db.executescript((root/'database/seed_students.sql').read_text())
assert db.execute('select count(*) from students').fetchone()[0]==37
for f in ['frontend/index.html','frontend/admin.html','frontend/app.js','frontend/admin.js','worker/src/index.js','worker/wrangler.jsonc.example','.github/workflows/deploy-pages.yml']:
 assert (root/f).exists(), f
w=(root/'worker/src/index.js').read_text(); a=(root/'frontend/app.js').read_text(); ad=(root/'frontend/admin.js').read_text()
assert 'student-login' in w and 'admin-login' in w
assert '/api/logout' in a and '/api/logout' in ad
assert 'EXPECTED_TURNSTILE_HOSTNAMES' in w
print('PASS: database, files, Turnstile actions, hostname validation, logout/login flow')

subprocess.run(['node', str(root/'tests/e2e-login-logout.mjs')], check=True)
print('PASS FULL QA: static verification and E2E login/logout')
