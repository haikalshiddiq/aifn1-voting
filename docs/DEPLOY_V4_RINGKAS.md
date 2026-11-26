# Deploy v4 ringkas: GitHub Actions + Cloudflare Worker/D1 + Turnstile

## A. Cloudflare sekali saja
1. `cd worker && npm ci && npx wrangler login`
2. Buat D1: `npx wrangler d1 create aifn1-voting`; catat `database_id`.
3. Salin config: `cp wrangler.jsonc.example wrangler.jsonc`; isi database ID, origin GitHub Pages, hostname, dan Site Key.
4. Import: `npm run db:init && npm run db:seed`.
5. Buat Turnstile Managed widget untuk hostname `USERNAME.github.io`; catat Site Key dan Secret Key.
6. Secret production: `npx wrangler secret put TURNSTILE_SECRET --config wrangler.jsonc` dan `npx wrangler secret put ADMIN_PASSWORD --config wrangler.jsonc`.
7. Deploy pertama: `npx wrangler deploy --config wrangler.jsonc`; catat URL Worker.

## B. GitHub repository
Upload seluruh isi ZIP ke branch `main`. Di **Settings > Secrets and variables > Actions** tambahkan:

### Secrets
- `CLOUDFLARE_API_TOKEN`: token Cloudflare dengan Workers Scripts Edit dan D1 Edit.
- `CLOUDFLARE_ACCOUNT_ID`: Account ID Cloudflare.
- `D1_DATABASE_ID`: ID D1.

### Variables
- `API_BASE`: URL Worker, tanpa slash akhir.
- `TURNSTILE_SITE_KEY`: Site Key.
- `ALLOWED_ORIGINS`: `https://USERNAME.github.io`.
- `EXPECTED_TURNSTILE_HOSTNAMES`: `USERNAME.github.io`.

Di **Settings > Pages**, pilih **GitHub Actions**. Push ke `main` menjalankan QA, deploy Worker jika file backend berubah, dan deploy GitHub Pages.

## C. Verifikasi otomatis
Sebelum push: `bash tests/predeploy-check.sh`.
Smoke HTTP lokal: `cd worker && npm run test:http`.
Setelah deploy:
```bash
API_BASE=https://WORKER.workers.dev \
SITE_URL=https://USERNAME.github.io/NAMA-REPO \
node tests/verify-production.mjs
```
Hasil harus: `PASS PRODUCTION SMOKE`.

## D. Turnstile
Widget hostname hanya `USERNAME.github.io`, bukan URL lengkap atau path repo. Secret Key hanya disimpan dengan `wrangler secret put`. Site Key masuk GitHub Variable dan Worker vars.
