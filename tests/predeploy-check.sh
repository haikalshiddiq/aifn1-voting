#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo '[1/6] Memeriksa file wajib...'
for f in worker/src/index.js worker/package.json worker/package-lock.json worker/wrangler.jsonc.example database/schema.sql database/seed_students.sql frontend/index.html frontend/admin.html frontend/config.js .github/workflows/deploy-pages.yml; do test -s "$f" || { echo "GAGAL: $f hilang/kosong"; exit 1; }; done
echo '[2/6] Memeriksa sintaks JavaScript...'
node --check worker/src/index.js
node --check frontend/app.js
node --check frontend/admin.js
echo '[3/6] Menjalankan QA + E2E handler...'
python3 tests/verify.py
echo '[4/6] Memeriksa seed mahasiswa...'
python3 tests/student_counts.py
echo '[5/6] Memeriksa placeholder dan secret...'
! grep -R -E 'TURNSTILE_SECRET\s*[=:]\s*["'\'' ]*0x|ADMIN_PASSWORD\s*[=:]\s*["'\'' ]+[^R]' frontend worker/src 2>/dev/null || { echo 'GAGAL: kemungkinan secret masuk source'; exit 1; }
grep -q '__API_BASE__' frontend/config.js
grep -q '__TURNSTILE_SITE_KEY__' frontend/config.js
echo '[6/6] Memeriksa konfigurasi Wrangler...'
grep -q '"binding": "DB"' worker/wrangler.jsonc.example
grep -q 'EXPECTED_TURNSTILE_HOSTNAMES' worker/wrangler.jsonc.example
echo 'PASS PREDEPLOY: source, syntax, QA, E2E, seed, placeholders, dan konfigurasi valid.'
