# AiFn1 UTS Voting Portal

Aplikasi voting lengkap untuk 37 mahasiswa AiFn1: login NIM + nama, Cloudflare Turnstile, edit vote sampai deadline, ranking tema, hasil live, admin, CSV export, dan simulasi 5 kelompok.

## Struktur
- `frontend/`: aset GitHub Pages
- `worker/`: Cloudflare Worker API
- `database/`: skema dan seed D1
- `docs/DEPLOYMENT.md`: petunjuk deployment

## Keamanan
Token sesi acak disimpan sebagai SHA-256 di D1. Semua validasi vote dan deadline dilakukan ulang di Worker. Admin memakai secret Cloudflare, bukan password di repository.

## Mulai deployment
Ikuti `docs/DEPLOYMENT.md`. Gunakan `worker/wrangler.jsonc.example` sebagai template konfigurasi.
