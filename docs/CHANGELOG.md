# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/) & [SemVer](https://semver.org/).
Tiap phase = satu rilis minor.

## [Unreleased]

### Added — Phase 3: Buka/Tutup Kasir
- **Sesi kasir** (`cashier_sessions`): buka dengan modal awal, tutup dengan
  menghitung uang fisik vs perkiraan laci.
- `CashierService.open` (tolak bila masih ada sesi terbuka) / `close` (kunci
  `expected_cash`, simpan `counted_cash` + `difference`).
- **Expected cash** = modal awal + penjualan tunai (dari `sales`, bukan cashflow,
  agar QRIS/transfer tak ikut) + kas masuk manual − kas keluar manual; cashflow
  otomatis `source='sale'` di-skip agar tidak dobel-hitung.
- **CashierPage**: kartu sesi aktif dengan ringkasan live (transaksi, tunai,
  perkiraan laci), sheet tutup dengan rincian + selisih live, riwayat sesi.
- POS **link `session_id`** ke sesi aktif tiap checkout + banner status kasir
  (buka/tutup + perkiraan laci); penjualan tetap jalan tanpa sesi (opsional).
- Smoke test diperluas: buka kasir → sale ter-link sesi → tutup dgn selisih.

### Added — Phase 2: Point of Sale + Checkout
- **PosPage**: grid produk + pencarian, tambah ke keranjang, sheet keranjang
  (stepper qty, hormati stok bila `track_stock`), bar keranjang ter-pin di bawah.
- **PaymentDialog**: metode Tunai/QRIS/Transfer, saran nominal uang pas +
  pembulatan, hitung kembalian.
- **CheckoutService** — satu transaksi atomic menulis `sales` + `sale_items`
  (dengan `name_snapshot`/`price_snapshot`) + kurangi stok + `cashflow_entries`
  income kategori sistem *Penjualan*; tiap tulisan punya baris `outbox` sendiri.
- Nomor struk device-prefixed `<PREFIX>-<YYYYMMDD>-<seq>` (prefix dari `device_id`).
- Riwayat transaksi (`TransactionsPage`, dikelompokkan per hari + ringkasan hari ini)
  & detail transaksi (`TransactionDetailPage`) dengan cetak ulang struk.
- Struk lewat `WebPreviewPrinter` (`src/lib/receipt.ts`, dua kolom monospace).
- Perbaikan korektness: `Db.inTransaction` + guard `persist()` di `BaseRepository`
  agar `saveToStore` tidak menutup transaksi checkout di tengah jalan (repo
  dibangun di atas handle `tx` karena `SqliteDb.transaction` reentran).

### Added — QRIS Dinamis
- Setelan **Pembayaran QRIS**: upload gambar QRIS statis toko sekali (decode via
  `jsqr`), disimpan sebagai payload EMV di `settings.qris_payload`.
- Saat pembayaran metode QRIS, PaymentDialog merender QR untuk di-scan pembeli
  dengan tombol **Sudah Bayar** / **Batal**:
  - **QRIS statis** (dinamis mati) → QR toko apa adanya, pembeli ketik nominal manual.
  - **QRIS Dinamis** (`settings.qris_dynamic`, default OFF, aktif bila QRIS statis
    di-upload) → nominal tagihan disuntik ke payload lalu QR baru dirender
    (`qrcode`) — pembeli scan langsung dengan jumlah pas, tanpa ketik manual.
- Algoritma `src/lib/qris.ts` (adaptasi verssache/qris-dinamis): buang CRC lama →
  `010211`→`010212` → sisipkan tag `54<len><nominal>` sebelum `5802ID` → hitung
  ulang CRC16-CCITT (0xFFFF, poly 0x1021). CRC diverifikasi dgn check-vector
  standar (`crc16("123456789") === 29B1`) dan round-trip self-CRC payload dinamis.

### Added — Foto produk (sync-ready)
- Upload foto produk lintas-platform: `@capacitor/camera` (native) / file picker (web),
  otomatis di-downscale ke JPEG ≤512px (`src/lib/image.ts`).
- Migration **v3** `media-table`: tabel `media` (SyncEntity) menyimpan byte gambar
  base64 terpisah; `products.image_path` hanya menyimpan ref `media://<id>`.
- Alasan desain: `outbox` menyalin seluruh row produk tiap edit — menaruh base64 di
  produk akan membengkakkan payload tiap ganti harga/stok. Media terpisah → gambar
  hanya sekali masuk outbox, edit produk tetap ringan. Dedup via hash SHA-256.
- `remote_url` disiapkan untuk swap ke object storage saat POS Pro aktif (tanpa ubah core).
- UI: kartu foto + preview di form produk, thumbnail di daftar produk, tombol
  **Kategori** berlabel (menggantikan ikon polos) agar kelola kategori lebih terlihat.
- Smoke test diperluas: upload foto, verifikasi `media` + `outbox` media insert, dan
  bukti edit harga tidak menyeret base64 ke payload / tidak menambah media.

### Added — Logo toko & splash screen
- **Logo toko** dapat di-set di Profil Toko (setelan). Disimpan lewat tabel `media`
  yang sama (PNG ≤256px agar transparansi terjaga), `settings.store_logo` menyimpan
  ref `media://<id>`.
- Logo tampil **live** di header Home & splash begitu diganti — Home, Setelan, dan
  splash berbagi cache `mediaStore` singleton, jadi update ref langsung ter-render.
- **Splash screen in-app** (`SplashScreen.vue`) tampil ~1.5s saat boot lalu fade-out;
  bukan splash native (itu Phase 7). **Default mati**, bisa diaktifkan & pilih latar:
  **Brand** (gradient primary, default), **Terang**, atau **Gelap**.
- Setelan baru: `settings.splash_enabled` (default OFF) & `settings.splash_bg`
  (default `brand`).

### Direncanakan
- Phase 4: Cashflow ledger (debit/kredit per kategori, entri manual).
- Phase 5: Login lokal + PIN (default OFF), lock screen.
- Phase 6: Aktivasi kontrak sync POS Pro (REST/JWT) + plugin printer thermal.

## [0.1.0] — Phase 0 & 1

### Added — Phase 0 (Fondasi)
- Scaffold Vue 3 + Vite + TypeScript + Tailwind v4 + shadcn-vue + Capacitor 8.
- Layer DB SQLite offline-first: `@capacitor-community/sqlite` (Android) +
  `jeep-sqlite`/`sql.js` wasm (web dev), lewat satu wrapper `Db`.
- Skema lengkap **sync-ready** semua tabel (products, categories, cashier_sessions,
  sales, sale_items, cashflow_categories, cashflow_entries, settings) + infra sync
  (`outbox`, `sync_state`, `schema_migrations`).
- `BaseRepository` generik: CRUD otomatis menulis `outbox` + set `dirty` dalam satu transaksi.
- Interface sync inert (`AuthProvider`/`SyncAdapter`/`SyncEngine`) siap POS Pro (REST/JWT).
- Capability registry + `WebPreviewPrinter` (cetak struk via dialog browser).
- Home launcher (grid menu ala referensi), bottom nav, halaman setelan (profil,
  toggle login default OFF, tema gelap), halaman printer (test print).

### Added — Phase 1 (Manajemen Produk)
- CRUD produk: nama, kategori, harga jual/modal, SKU, barcode, stok opsional, status aktif.
- Kelola kategori (tambah, rename, hapus).
- Daftar produk dengan pencarian + filter kategori.

### Verified
- Smoke test end-to-end (Playwright): boot DB, seed, CRUD, `dirty` flag, pencatatan
  `outbox`, persistensi setelah reload, dan soft delete — **semua lulus**.

### Notes
- v1 DB `no-encryption`; keamanan lewat PIN app-level (Phase 5).
- `sql.js` di-pin ke 1.11.0 agar cocok dengan wasm yang diharapkan `jeep-sqlite` 2.8.
