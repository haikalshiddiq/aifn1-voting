# Konfigurasi Cloudflare Turnstile untuk GitHub Pages

## Nilai yang perlu disiapkan
Contoh deployment frontend:

```text
https://username.github.io/aifn1-voting/
```

Gunakan nilai berikut:

```text
Hostname Turnstile: username.github.io
ALLOWED_ORIGINS: https://username.github.io
EXPECTED_TURNSTILE_HOSTNAMES: username.github.io
```

Jangan memasukkan `https://`, slash akhir, atau path repository pada daftar hostname widget Turnstile.

## 1. Buat widget
1. Masuk ke Cloudflare Dashboard.
2. Buka **Turnstile**.
3. Pilih **Add widget**.
4. Nama widget: `AiFn1 Voting GitHub Pages`.
5. Hostname: `username.github.io`.
6. Widget mode: **Managed**.
7. Simpan, lalu catat **Site Key** dan **Secret Key**.

Jika memakai custom domain GitHub Pages, tambahkan domain tersebut sebagai hostname juga. Pisahkan beberapa hostname Worker dengan koma, misalnya:

```json
"EXPECTED_TURNSTILE_HOSTNAMES": "username.github.io,voting.example.com"
```

## 2. Konfigurasi Worker
Salin template:

```bash
cd worker
cp wrangler.jsonc.example wrangler.jsonc
```

Isi `worker/wrangler.jsonc`:

```jsonc
{
  "vars": {
    "ALLOWED_ORIGINS": "https://username.github.io",
    "EXPECTED_TURNSTILE_HOSTNAMES": "username.github.io",
    "TURNSTILE_SITE_KEY": "0x4AAAA...SITE_KEY"
  }
}
```

Simpan Secret Key sebagai Worker secret:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Jangan menaruh Secret Key di `wrangler.jsonc`, GitHub variable, `config.js`, atau repository.

## 3. Konfigurasi GitHub Actions
Di repository, buka **Settings > Secrets and variables > Actions > Variables**, lalu buat:

```text
API_BASE = https://aifn1-voting-api.SUBDOMAIN.workers.dev
TURNSTILE_SITE_KEY = 0x4AAAA...SITE_KEY
```

`API_BASE` tidak memakai slash akhir.

## 4. Deploy dan smoke test
Deploy Worker:

```bash
cd worker
npm ci
npx wrangler deploy
```

Setelah GitHub Pages selesai deploy:

1. Buka halaman voting melalui URL GitHub Pages, bukan file lokal.
2. Pastikan widget Turnstile tampil pada login mahasiswa.
3. Selesaikan Turnstile dan login dengan NIM serta nama yang valid.
4. Logout, lalu pastikan halaman kembali ke form login.
5. Login kembali dan pastikan vote sebelumnya dimuat.
6. Buka `admin.html`, pastikan widget admin tampil dan login admin bekerja.

## Pemecahan masalah

### Widget tidak tampil
- Pastikan `TURNSTILE_SITE_KEY` GitHub Actions Variable sudah diisi.
- Periksa hasil deploy `frontend/config.js`; placeholder tidak boleh tersisa.
- Pastikan browser tidak memblokir `https://challenges.cloudflare.com`.

### `invalid-input-secret`
Jalankan kembali:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

### `invalid-input-response` atau `timeout-or-duplicate`
Refresh widget dan selesaikan tantangan lagi. Token hanya untuk satu verifikasi dan dapat kedaluwarsa.

### `Hostname Turnstile tidak sesuai`
Pastikan ketiga nilai konsisten:
- hostname pada widget Cloudflare;
- `EXPECTED_TURNSTILE_HOSTNAMES`;
- hostname GitHub Pages yang benar-benar dibuka.

### CORS gagal
Pastikan `ALLOWED_ORIGINS` adalah origin persis, misalnya `https://username.github.io`, tanpa path repository.
