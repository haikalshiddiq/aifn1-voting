# MULAI DI SINI: Turnstile

Buat widget Cloudflare Turnstile dengan:
- Name: `aifn-voting-uts`
- Mode: `Managed`
- Hostname: `<USERNAME-GITHUB>.github.io`

Contoh bila pemilik repository GitHub adalah `hicall`, hostname yang dimasukkan adalah `hicall.github.io`.
Jangan masukkan `aifn-voting-uts.hicall.workers.dev`; alamat itu adalah backend API, bukan halaman tempat widget tampil.

Setelah widget dibuat:
1. GitHub Secret `TURNSTILE_SECRET` = Secret Key.
2. GitHub Variable `TURNSTILE_SITE_KEY` = Site Key.
3. Tidak perlu lagi membuat variables `ALLOWED_ORIGINS` dan `EXPECTED_TURNSTILE_HOSTNAMES`; workflow menghitungnya otomatis dari owner repository GitHub.
