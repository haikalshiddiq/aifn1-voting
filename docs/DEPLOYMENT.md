# Deployment final

## Prasyarat
- Node.js 20+
- Akun GitHub
- Akun Cloudflare
- Domain GitHub Pages yang akan dipakai

## 1. Upload repository
Ekstrak ZIP, lalu upload seluruh **isi folder** ke branch `main` repository GitHub.

## 2. Buat Cloudflare D1
```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create aifn1-voting
```
Salin `database_id` dari output. Duplikasi `wrangler.jsonc.example` menjadi `wrangler.jsonc`, lalu ganti `REPLACE_WITH_D1_DATABASE_ID`. File JSONC adalah konfigurasi utama yang direkomendasikan untuk paket ini.

## 3. Isi database remote
Dari folder `worker`:
```bash
npx wrangler d1 execute aifn1-voting --remote --file=../database/schema.sql
npx wrangler d1 execute aifn1-voting --remote --file=../database/seed_students.sql
npx wrangler d1 execute aifn1-voting --remote --command="SELECT COUNT(*) AS total FROM students"
```
Hasil terakhir harus `37`.

## 4. Buat Turnstile
Di Cloudflare Dashboard pilih **Turnstile > Add widget**. Masukkan hostname GitHub Pages Anda, misalnya `username.github.io`. Salin Site Key dan Secret Key.

Pada `worker/wrangler.jsonc`:
- `ALLOWED_ORIGINS`: URL origin frontend tanpa slash akhir, misalnya `https://username.github.io`
- `TURNSTILE_SITE_KEY`: Site Key Turnstile
- `EXPECTED_TURNSTILE_HOSTNAMES`: hostname frontend tanpa protokol dan path, misalnya `username.github.io`

Simpan secret, jangan masukkan ke Git:
```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put ADMIN_PASSWORD
```
Gunakan password admin minimal 16 karakter acak.

## 5. Deploy Worker
```bash
npx wrangler deploy
```
Catat URL Worker, misalnya `https://aifn1-voting-api.NAMA.workers.dev`.

Uji:
```bash
curl https://aifn1-voting-api.NAMA.workers.dev/api/health
```
Harus mengembalikan `{ "ok": true, ... }`.

## 6. Konfigurasi GitHub Actions
Di GitHub repository buka **Settings > Secrets and variables > Actions > Variables**, lalu buat:
- `API_BASE`: URL Worker tanpa slash akhir
- `TURNSTILE_SITE_KEY`: Site Key Turnstile
- `EXPECTED_TURNSTILE_HOSTNAMES`: hostname frontend tanpa protokol dan path, misalnya `username.github.io`

Buka **Settings > Pages > Source** lalu pilih **GitHub Actions**. Push ke `main` akan memublikasikan folder `frontend`.

## 7. Validasi produksi
1. Buka frontend GitHub Pages.
2. Login memakai NIM + nama persis dari daftar kelas.
3. Isi ranking lima tema unik dan simpan.
4. Logout, login ulang, pastikan vote lama dimuat.
5. Buka `admin.html`, login admin, pastikan statistik dan CSV export bekerja.
6. Uji status `closed`, pastikan API menolak perubahan vote.

## Local development
Untuk Worker lokal, set `BYPASS_TURNSTILE=true` hanya di `.dev.vars` dan jangan pernah di produksi:
```text
TURNSTILE_SECRET=dummy
ADMIN_PASSWORD=ganti-password-lokal
BYPASS_TURNSTILE=true
ALLOWED_ORIGINS=http://localhost:8000
TURNSTILE_SITE_KEY=1x00000000000000000000AA
```
Jalankan `npx wrangler dev` dari `worker`, lalu frontend dengan `python -m http.server 8000 -d frontend`. Ubah sementara `frontend/config.js` agar API mengarah ke `http://localhost:8787`.

## Pemeriksaan Turnstile
- Widget mahasiswa memakai action `student-login`; widget admin memakai action `admin-login`.
- Worker memvalidasi `success`, `hostname`, dan `action` dari Siteverify.
- Token Turnstile hanya dapat dipakai sekali dan biasanya kedaluwarsa dalam sekitar lima menit. Setelah login gagal, widget otomatis direset.
- Untuk GitHub Pages project site, masukkan hostname `username.github.io` pada Turnstile, bukan path `/nama-repo`.

## Logout dan login kembali
- Logout mahasiswa memanggil `/api/logout`, menghapus sesi dari D1, menghapus token browser, lalu kembali ke form login.
- Logout admin melakukan hal yang sama untuk sesi admin.
- Login kembali dengan NIM dan nama yang sama akan memuat vote terakhir melalui `GET /api/vote`, selama sesi baru berhasil dibuat.

## Smoke test yang sudah disertakan
Jalankan `npm run test:http` dari folder `worker` untuk mengulang smoke test HTTP lokal memakai Wrangler dan D1 lokal.
