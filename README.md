# POS Kacaw

Aplikasi **Point of Sale offline-first** untuk UMKM. Jalan penuh tanpa internet,
disiapkan untuk upgrade ke **POS Pro** (cloud sync) & plugin (printer thermal).

**Stack:** Vue 3 · Vite · TypeScript · Tailwind v4 · shadcn-vue · Pinia · Capacitor 8 · SQLite

## Jalankan (web dev)

```bash
npm install
npm run dev            # otomatis copy sql-wasm.wasm, buka http://localhost:5173
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server (web) |
| `npm run build` | Typecheck + build produksi |
| `npm run typecheck` | Cek tipe saja |
| `node scripts/smoke.mjs` | Smoke test end-to-end (butuh dev server jalan) |
| `npm run cap:sync` | Build + sync ke platform native |

## Build Android (Phase 7 — butuh Android SDK)

```bash
# set ANDROID_HOME dulu, lalu:
npx cap add android
npm run cap:sync
npx cap run android
```

## Dokumentasi

- `docs/PRD.md` — kebutuhan produk & scope
- `docs/architecture.md` — arsitektur teknis (storage, sync, plugin)
- `docs/CHANGELOG.md` — riwayat per phase
- `docs/features/*.md` — spec per fitur

## Status Phase

- ✅ **Phase 0** — Fondasi (DB, sync-ready schema, outbox, capabilities, home, setelan)
- ✅ **Phase 1** — Manajemen Produk (CRUD produk & kategori)
- 🔜 Phase 2 POS+checkout · Phase 3 Kasir · Phase 4 Cashflow · Phase 5 Login/PIN · Phase 6 Sync POS Pro

## Catatan

- Uang disimpan sebagai **INTEGER** rupiah (tanpa float).
- `sql.js` di-pin `1.11.0` agar cocok dengan wasm `jeep-sqlite@2.8`.
- v1 DB `no-encryption`; keamanan = PIN app-level (Phase 5).
