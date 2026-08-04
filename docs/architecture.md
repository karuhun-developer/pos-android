# Arsitektur — POS Kacaw

## Stack

Vue 3 + Vite + TypeScript · Tailwind v4 · shadcn-vue (reka-ui) · Pinia · vue-router ·
Capacitor 8 (Android + web dev). Storage: SQLite.

## Lapisan

```
UI (pages / components)
   └─ Pinia stores            ← state; tidak menyentuh SQL
        └─ Services            ← orkestrasi transaksi multi-repo (checkout, kasir)
             └─ Repositories   ← query domain (extends BaseRepository)
                  └─ Db (interface)  ← wrapper di sqlite.ts
                       └─ @capacitor-community/sqlite / jeep-sqlite
```

Aturan: **UI & store tidak pernah menulis SQL.** Semua lewat repository/service.

## Storage & platform

- Satu wrapper `Db` (`src/db/sqlite.ts`) — `query/run/execute/transaction`.
- **Web (dev):** `jeep-sqlite` (web component) menjalankan SQLite via WebAssembly
  (`sql.js`) dan persist ke IndexedDB. `initWebStore()` dipanggil sekali sebelum query.
  `sql-wasm.wasm` di-copy ke `public/assets/` (script `copy:wasm`).
- **Android:** SQLite native `@capacitor-community/sqlite`, tanpa bootstrap web.
- Repositori identik di dua platform — perbedaan hanya di `sqlite.ts`.

> **Penting:** `sql.js` di-pin `1.11.0` agar ABI wasm cocok dengan `jeep-sqlite@2.8`.
> Versi lebih baru (1.14) menyebabkan `LinkError` saat instantiate wasm.

## Kontrak sync (sync-ready sejak hari 1)

Tiap tabel bisnis punya: `id` (UUID v4), `created_at`, `updated_at`, `deleted_at`
(soft delete), `dirty` (1=belum push), `sync_version`, `remote_id`.

`BaseRepository.create/update/softDelete` **selalu** menulis satu baris `outbox`
(`insert|update|delete` + payload JSON) di **transaksi yang sama** dengan perubahan
datanya. Jadi tidak ada perubahan yang bisa hilang. `SyncEngine` nanti tinggal
membaca `outbox` untuk push dan `updated_at`/`sync_version` untuk pull (last-write-wins).

Detail uang: **INTEGER minor units** (rupiah bulat). `sale_items` menyimpan
`name_snapshot`+`price_snapshot`. `sales.number` di-prefix `device_id` agar unik offline.

## Sync abstraction (inert di v1)

`AuthProvider` (sumber token) · `SyncAdapter` (push/pull REST) · `SyncEngine`
(loop + status). v1 memakai `NullAuthProvider` dan tanpa adapter → engine `disabled`.
POS Pro nanti menambah `JwtAuthProvider` + `HttpSyncAdapter` **tanpa mengubah repo**.

## Capability / plugin

`CapabilityRegistry` menyimpan kemampuan opsional. Core memanggil
`capabilities.get('printer')`; jika null, tombol cetak disembunyikan. v1 mendaftar
`WebPreviewPrinter`. Printer thermal = tambah `ThermalPrinter implements
PrinterCapability` di `capabilities/bootstrap.ts`, tanpa menyentuh core.

## Struktur folder

Lihat README / plan. Ringkas: `src/db` (sqlite, migrations, BaseRepository),
`src/repositories`, `src/services` (auth, sync, capabilities), `src/stores`,
`src/pages`, `src/components` (ui, layout, common), `src/lib` (utils, money, uuid, datetime).

## Bootstrap (`main.ts`)

`initDb()` → `registerCapabilities()` → Pinia → `settings.load()` → router → mount.
UI hanya tampil setelah DB & setelan siap.
