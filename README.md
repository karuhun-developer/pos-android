# POS Kacaw

Aplikasi **Point of Sale offline-first** untuk warung/UMKM. Kasir jalan **100%
tanpa internet** (kelola produk, transaksi, buka/tutup kasir, cashflow), dan
arsitekturnya sudah disiapkan untuk **sinkronisasi ke cloud "POS Pro"** (login
online/Google, sync dua arah, plugin tambahan) tanpa mengubah core.

- **App id:** `com.karuhundeveloper.poskacaw`
- **Backend (opsional):** [POS Pro](https://github.com/karuhun-developer/pos-web) — Laravel + Sanctum
- **Status:** Phase 0–7 selesai (offline penuh + sync + build Android jalan).
  Printer thermal masih menyusul — lihat [Roadmap](#roadmap).

**Stack:** Vue 3 · Vite · TypeScript · Tailwind v4 · shadcn-vue (reka-ui) · Pinia ·
vue-router · **Capacitor 8** (Android + web dev) · **SQLite**
(`@capacitor-community/sqlite` native + `jeep-sqlite`/`sql.js` wasm di web).

## Jalankan (web dev)

```bash
npm install
npm run dev            # otomatis copy sql-wasm.wasm, buka http://localhost:5173
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server (web) |
| `npm run build` | Typecheck (vue-tsc) + build produksi |
| `npm run typecheck` | Cek tipe saja |
| `node scripts/smoke.mjs` | Smoke test end-to-end (butuh dev server jalan) |
| `npm run cap:sync` | Build + sync ke platform native |
| `npm run android:open` | (WSL) build + sync + buka project di Android Studio Windows |

## Build Android

```bash
npm run build && npx cap sync android   # wajib sebelum tiap build
npm run android:open                    # (WSL) buka di Android Studio Windows
```

Di Android Studio: tunggu Gradle sync, colok HP (USB debugging), **Run ▶**.
Debug keystore di-commit (`android/debug.keystore`) supaya **SHA-1 konsisten** di
semua mesin — lihat [Google Sign-In](docs/features/google-signin-android.md).

## Konfigurasi (`.env`)

Salin `.env.example` → `.env`:

| Variabel | Isi |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL POS Pro, mis. `http://localhost:8000/api/v1` |
| `VITE_GOOGLE_CLIENT_ID` | **Web** OAuth Client ID (dipakai FE + `server_client_id`) |

`.env` di-gitignore (berisi ID asli); hanya `.env.example` yang di-commit.

## Roadmap

| Phase | Fitur | Status |
| --- | --- | --- |
| 0 | Scaffold & fondasi (DB, outbox, layout, capability) | ✅ |
| 1 | Manajemen produk (+ foto/media) | ✅ |
| 2 | POS + Checkout (+ QRIS dinamis) | ✅ |
| 3 | Buka/Tutup kasir | ✅ |
| 4 | Cashflow ledger | ✅ |
| 5 | Login lokal & PIN | ✅ |
| 6 | Kontrak API v1 + backend POS Pro | ✅ |
| 6C | Integrasi FE ↔ sync (client, account, sync store, Connect) + Google native | ✅ |
| 7 | Build Android | ✅ |
| — | Export Excel `.xlsx` (Transaksi & Cashflow, filter tanggal) | ✅ |
| — | **Printer thermal** (Bluetooth/USB ESC/POS) | 🟡 menyusul |

## Dokumentasi

- `docs/PRD.md` — kebutuhan produk & scope
- `docs/architecture.md` — arsitektur teknis (storage, sync, plugin)
- `docs/CHANGELOG.md` — riwayat per phase
- `docs/api/pos-pro-api-v1.md` — kontrak API sync FE↔BE
- `docs/features/*.md` — spec per fitur

## Catatan

- Uang disimpan sebagai **INTEGER** rupiah (tanpa float).
- **Sync-ready sejak Phase 0:** tiap write menulis baris `outbox` di transaksi
  yang sama → aman untuk push saat online.
- `sql.js` di-pin `1.11.0` agar cocok dengan wasm `jeep-sqlite@2.8`.
- v1 DB `no-encryption`; keamanan = PIN app-level (Phase 5).
