# QA Report

- [x] Schema dan seed dapat dieksekusi; total mahasiswa 37.
- [x] JavaScript Worker, frontend mahasiswa, dan frontend admin lolos pemeriksaan sintaks Node.js.
- [x] Turnstile memvalidasi success, hostname, dan action di server.
- [x] Action mahasiswa `student-login` dan admin `admin-login` konsisten frontend-backend.
- [x] Turnstile direset setelah login gagal.
- [x] Logout mahasiswa menghapus sesi D1 dan localStorage.
- [x] Logout admin menghapus sesi D1 dan sessionStorage.
- [x] Login kembali memuat vote terdahulu.
- [x] Workflow GitHub Pages mengganti API_BASE dan Site Key saat build.
- [x] Wrangler JSONC dan TOML example tersedia.
- [x] E2E API: login, simpan vote, logout, token lama ditolak, login ulang, vote lama dimuat.
- [x] `tests/verify.py` menjalankan pemeriksaan statis dan E2E.
- [x] HTTP smoke melalui Wrangler lokal + D1 lokal: health, login, vote, logout, token lama 401, login ulang, vote dipulihkan.
- [x] Compatibility date diperbaiki dari tanggal masa depan menjadi `2026-11-26`.
