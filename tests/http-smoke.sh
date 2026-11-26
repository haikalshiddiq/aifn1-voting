#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/worker"
npm ci --ignore-scripts >/tmp/aifn1-npm-ci.log 2>&1
npx wrangler d1 execute aifn1-voting-test --local --config wrangler.test.jsonc --file=../database/schema.sql >/tmp/aifn1-schema.log 2>&1
npx wrangler d1 execute aifn1-voting-test --local --config wrangler.test.jsonc --file=../database/seed_students.sql >/tmp/aifn1-seed.log 2>&1
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY npx wrangler dev --config wrangler.test.jsonc --port 8787 --local >/tmp/aifn1-http.log 2>&1 & PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:8787/api/health >/dev/null && break || sleep 1; done
LOGIN=$(curl -fsS -X POST http://127.0.0.1:8787/api/login -H 'Origin: http://127.0.0.1:8000' -H 'Content-Type: application/json' --data '{"nim":"25110200041","name":"AINUN KHOLISHAH","turnstileToken":"test"}')
TOKEN=$(printf '%s' "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
curl -fsS http://127.0.0.1:8787/api/me -H "Authorization: Bearer $TOKEN" -H 'Origin: http://127.0.0.1:8000' >/tmp/me.json
curl -fsS -X PUT http://127.0.0.1:8787/api/vote -H "Authorization: Bearer $TOKEN" -H 'Origin: http://127.0.0.1:8000' -H 'Content-Type: application/json' --data '{"group_method":"Berdasarkan minat tema UTS","theme_rank_1":"Pembiayaan UMKM","theme_rank_2":"Pinjaman Koperasi","theme_rank_3":"Piutang Pelanggan Usaha","theme_rank_4":"Kemampuan Bayar Kredit Konsumtif","theme_rank_5":"Tema Finance Usulan Sendiri","custom_theme":"Deteksi fraud kartu kredit","reason":"Smoke test"}' >/tmp/vote.json
curl -fsS -X POST http://127.0.0.1:8787/api/logout -H "Authorization: Bearer $TOKEN" -H 'Origin: http://127.0.0.1:8000' >/tmp/logout.json
STATUS=$(curl -sS -o /tmp/old-token.json -w '%{http_code}' http://127.0.0.1:8787/api/me -H "Authorization: Bearer $TOKEN" -H 'Origin: http://127.0.0.1:8000')
test "$STATUS" = "401"
LOGIN2=$(curl -fsS -X POST http://127.0.0.1:8787/api/login -H 'Origin: http://127.0.0.1:8000' -H 'Content-Type: application/json' --data '{"nim":"25110200041","name":"AINUN KHOLISHAH","turnstileToken":"test2"}')
TOKEN2=$(printf '%s' "$LOGIN2" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
RESTORED=$(curl -fsS http://127.0.0.1:8787/api/vote -H "Authorization: Bearer $TOKEN2" -H 'Origin: http://127.0.0.1:8000')
printf '%s' "$RESTORED" | python3 -c 'import sys,json; assert json.load(sys.stdin)["vote"]["custom_theme"]=="Deteksi fraud kartu kredit"'
echo 'PASS HTTP SMOKE: Wrangler + local D1 + login + vote + logout + relogin + restore'
