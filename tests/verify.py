import sqlite3, pathlib, subprocess
from student_counts import COUNT_QUERY, validate_counts
root=pathlib.Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.executescript((root/'database/schema.sql').read_text())
db.executescript((root/'database/seed_students.sql').read_text())
db.row_factory = sqlite3.Row
validate_counts(dict(db.execute(COUNT_QUERY).fetchone()))
subprocess.run(['python3', str(root/'tests/test_database.py')], check=True)
for f in ['frontend/index.html','frontend/admin.html','frontend/app.js','frontend/admin.js','worker/src/index.js','worker/wrangler.jsonc.example','.github/workflows/deploy-pages.yml']:
 assert (root/f).exists(), f
w=(root/'worker/src/index.js').read_text(); a=(root/'frontend/app.js').read_text(); ad=(root/'frontend/admin.js').read_text()
assert 'student-login' in w and 'admin-login' in w
assert '/api/logout' in a and '/api/logout' in ad
assert 'EXPECTED_TURNSTILE_HOSTNAMES' in w
print('PASS: database, files, Turnstile actions, hostname validation, logout/login flow')

subprocess.run(['node', str(root/'tests/e2e-login-logout.mjs')], check=True)
print('PASS FULL QA: static verification and E2E login/logout')

subprocess.run(['node', str(root/'tests/e2e-smoke-isolation.mjs')], check=True)

subprocess.run(['node', str(root/'tests/admin-ui-regression.mjs')], check=True)
