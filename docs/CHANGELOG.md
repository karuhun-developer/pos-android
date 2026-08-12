# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/) & [SemVer](https://semver.org/).
Tiap phase = satu rilis minor.

## [Unreleased]

### Added — Barcode: tipe, render, scan kasir, impor/ekspor produk
- **Kolom `products.barcode_type`** (migrasi client **v4**, default **`EAN13`**) +
  index `idx_products_barcode`. Ikut sync **tanpa perubahan kode sync** — outbox
  mengirim row penuh, server memfilter kolom lewat `Schema::getColumnListing()`.
- **`src/lib/barcode.ts`** — satu-satunya modul yang tahu JsBarcode (lazy import):
  daftar simbologi ritel (EAN13/CODE128/EAN8/UPC/CODE39/ITF14), validasi lewat
  callback `valid` bawaan JsBarcode (termasuk check digit), tebak tipe dari nilai,
  render ke SVG/PNG.
- **Form produk**: pilihan tipe barcode, validasi live (peringatan, **tidak**
  memblokir simpan), tombol **scan** untuk mengisi field dari kamera, dan prefill
  dari `?barcode=…`.
- **Sheet "lihat barcode"** di daftar produk — barcode dirender di kartu putih
  (kontras, bukan warna tema) + **Bagikan / Simpan Gambar** (PNG).
- **Mode scan kasir `/pos/scan`** — kamera **45dvh di atas (bukan fullscreen)**,
  keranjang di bawah, total + Bayar di footer. Barcode dikenal → langsung masuk
  keranjang (getar + beep + toast); produk nonaktif/habis → toast merah; barcode
  asing → tawaran **Buat Produk Baru**. Anti-dobel 1500 ms/kode.
  Bayar → `/pos?pay=1` supaya **checkout tetap satu jalur** di `PosPage`.
- **`ScannerCapability`** di capability registry (pola sama dengan printer).
  `WebScanner` (`getUserMedia` + `<video>` inline) dipakai di web **dan** Android;
  decode `BarcodeDetector` bawaan platform → fallback `@zxing/browser`, ROI pita
  tengah, ~10 fps. Manifest Android menambah izin `CAMERA` (+ fitur kamera/autofocus
  `required=false`).
- **Impor/ekspor produk CSV & XLSX** — header Bahasa Indonesia (+ alias EN),
  kategori sebagai nama (dibuat otomatis saat impor), tombol unduh template.
  **Baris yang barcode-nya sudah ada dilewati** (termasuk duplikat di dalam file);
  baris tanpa barcode tetap diimpor. Penulisan per chunk 300 baris di atas handle
  `tx`, `load()` sekali di akhir.
- Baris keranjang di-extract jadi `components/pos/CartLines.vue` (dipakai
  `CartSheet` + `ScanPage`), helper simpan/bagikan file jadi `src/lib/download.ts`
  (dipakai xlsx, csv, dan PNG barcode).
- Docs: **`docs/features/barcode-scan.md`** (baru) + pembaruan
  `product-management.md`, `point-of-sale.md`, `architecture.md`,
  `api/pos-pro-api-v1.md`.

### Fixed
- `scripts/smoke.mjs`: `getByRole('link', { name: 'Kasir' })` ambigu sejak sidebar
  tablet menambah "Sesi Kasir" → dikunci dengan `exact: true`.

## [0.2.0] — 2026-08-06

### Changed — Redesign UI + dukungan tablet/iPad
- **Tema warna baru — monokrom** (`src/assets/index.css`): latar **abu-abu netral
  sejuk** + kartu putih + **aksen hitam/charcoal** (`--primary`) untuk tombol, chip
  terpilih & nav aktif. **Biru (`--info`) khusus harga/uang**, dan **`--hero`**
  (charcoal, konsisten light & dark) untuk header gelap. Dark mode = charcoal dengan
  aksen terang. Terang jadi default, dark tetap didukung. `--radius` 0.75rem →
  **1rem**. Semua chrome ikut otomatis karena berbasis token. Referensi: Kopag
  Mobile POS. Spec lengkap di **`docs/DESIGN.md`** (baru).
- **Layout responsif** — di **≥md (tablet/iPad)** muncul **sidebar kiri**
  (`src/components/layout/SideNav.vue`, menu lengkap) & bottom-nav disembunyikan;
  di HP tetap `BottomNav`. Sumber item nav disatukan di
  **`src/components/layout/navItems.ts`** (dipakai BottomNav + SideNav). Frame app
  tak lagi di-cap `max-w-md` global (`src/App.vue`).
- **Home** (`src/pages/HomePage.vue`): tetap desain awal — **header hero gelap**
  (gradient charcoal) berisi profil toko + banner POS Pro, lalu panel menu
  membulat (`-mt-6 rounded-t-3xl`) yang menimpa hero; grid menu responsif `2→3→4`.
- **Warna semantik konsisten** — `emerald/rose/amber` yang di-hardcode di
  Cashflow/POS/Kasir/Transaksi/Reports dirutekan ke token **`success`/`destructive`/
  `warning`**; header summary pakai **`hero`**; harga produk pakai **`text-info`**
  (biru). Grid produk & POS melebar di tablet; FAB & save-bar diposisikan ulang
  agar benar di layout lebar. Grafik Reports: penjualan charcoal, kas hijau/merah.
- **Tombol "Masuk dengan Google"** (`src/pages/settings/ConnectPage.vue`) dibuat
  sesuai brand guideline Google: tombol putih ber-border, **logo G 4 warna**, +
  spinner saat loading.

### Fixed — Kategori cashflow default dijamin selalu ada
- Sebelumnya default cuma di-seed **sekali** di migration v2 → setelah **pindah
  outlet** (`resetLocalBusinessData` menghapus `cashflow_categories`, termasuk
  sistem **'Penjualan'**) kategori hilang & tak terisi ulang; checkout lalu
  mencatat pemasukan `category_id = null` ("Tanpa kategori").
- **`src/db/seedCashflow.ts`** baru: `seedDefaultCashflowCategories(db)` —
  **idempotent by name** (skip yang sudah ada), device-local (`dirty=1`, tanpa
  outbox → tak di-push). Dipanggil **tiap boot** (`initDb` setelah migrasi) &
  **setelah reset** (`resetLocalBusinessData`), jadi 'Penjualan' & kawan-kawan
  selalu balik. Migration v2 kini memanggil fungsi yang sama (sumber tunggal).
- **Logout tidak menghapus data lokal** (perilaku tetap) — cukup dijamin ada.
- Set default diperluas jadi 9: income **Penjualan** (sistem), **Modal / Setoran**,
  **Pendapatan Lain**; expense **Belanja Stok**, **Gaji Karyawan**, **Sewa Tempat**,
  **Listrik & Air**, **Operasional**, **Lain-lain**. Install lama otomatis dapat
  kategori baru saat boot (idempotent, tanpa migration tambahan).

### Added — Laporan/analitik (grafik ApexCharts)
- **Menu "Laporan" baru** di Home → `/reports` (`src/pages/reports/ReportsPage.vue`
  + store read-only `src/stores/reports.ts`, terpisah agar tak mengganggu `range`
  store sales/cashflow). Melengkapi item PRD "Laporan/analitik lanjutan — menyusul".
- **KPI "Hari ini"** (selalu hari ini, independen filter): penjualan hari ini
  (total + jumlah transaksi) dan pemasukan vs pengeluaran hari ini.
- **Grafik tren ApexCharts** (`apexcharts` + `vue3-apexcharts`, di-import lokal di
  page → masuk chunk lazy `/reports`, bundle utama tetap ramping): **toggle sumber
  Transaksi/Cashflow** — sales = 1 seri bar total/hari, cashflow = 2 seri
  (pemasukan debit vs pengeluaran credit)/hari. Sumbu-x dari daftar hari rentang
  (termasuk hari kosong), ikut `DateRangeFilter` (default Minggu ini), tooltip &
  label sumbu-Y pakai `formatRupiah`, tema grafik ikut dark/light.
- **Export Excel** reuse `sales.buildExport`/`cashflow.buildExport` via
  `ExportDialog` (prop `buildSheets` di-switch sesuai sumber aktif).

### Changed — DateRangeFilter dirapikan (anti-overflow)
- Preset **"Kemarin" dihapus** (`today/week/month` + Kustom) agar barisan pill tak
  overflow/terpotong di layar sempit. Berdampak ke Transaksi, Cashflow, Laporan,
  dan semua dialog Export yang berbagi komponen ini.
- Mode **Kustom**: input **Dari/Sampai** jadi 2 kolom grid + tombol **Terapkan**
  full-width di bawah — sebelumnya tombol overflow saat sempit.

### Changed — Banner "Sambungkan ke POS Pro" di Home
- Badge **"Segera"** dihapus dari banner — fitur login online/sync sudah nyata di
  halaman **Setelan** (kartu POS Pro), jadi label "Segera" tak lagi relevan.
  Banner tetap ada & tetap mengarah ke `/settings`.

### Added — CI: build APK otomatis saat Release + versioning dari tag
- **Workflow `.github/workflows/release-apk.yml`** (trigger `release: published`):
  tiap bikin **Release** di GitHub → APK ke-build & **otomatis ditempel** ke Release
  itu (`softprops/action-gh-release`). Runner: Node 22, JDK 21 (temurin), Android SDK
  36 (`platforms;android-36` + `build-tools;36.0.0`) → `npm ci` → `npm run build` →
  `npx cap sync android` → `./gradlew assembleDebug`.
- **Versioning otomatis dari tag** `vX.Y.Z`: `versionName = X.Y.Z`,
  `versionCode = X*10000 + Y*100 + Z` (mis. `v1.3.0` → `10300`, selalu naik). Tag
  non-semver → build gagal dengan pesan jelas. `android/app/build.gradle` kini baca
  `-PappVersionCode/-PappVersionName` (fallback `1`/`"1.0"` untuk build lokal).
- **Debug-signed** (pakai `android/debug.keystore` yang di-commit) → **nol secret**,
  APK langsung bisa side-load & Google Sign-In tetap jalan (SHA-1 sudah terdaftar).
  Env web opsional dari **repo Variables** `VITE_API_BASE_URL` & `VITE_GOOGLE_CLIENT_ID`
  (kalau kosong, APK tetap ke-build; login/sync aktif setelah Variables diisi).

### Fixed — Tombol back hardware Android
- Sebelumnya back hardware **menutup app** dari halaman mana pun (tak ada listener
  `backButton`). Kini `@capacitor/app` dipasang + handler di `useHardwareBack()`
  (`src/composables/`, dipakai di `App.vue`):
  - **Home** → tekan back **2×** untuk keluar (hint "Tekan sekali lagi untuk keluar"
    ~2 detik; back kedua <2s → `App.exitApp()`).
  - **Halaman lain** → mundur sesuai riwayat (`router.back()`), fallback ke Home
    bila riwayat kosong (`goBackOrHome`).
  - **`/lock`** → back di-swallow (tetap terkunci).
- Tombol back di `AppHeader` ikut pakai `goBackOrHome()` → aman saat riwayat kosong.
- Listener hanya aktif di native (`Capacitor.isNativePlatform()`); web tak berubah.

### Added — Printer thermal: transport native Bluetooth & USB
- **Plugin native `ThermalPrinter`** (`android/app/src/main/java/.../
  ThermalPrinterPlugin.java`, didaftarkan di `MainActivity.java`): `listBluetooth`,
  `listUsb`, `print({connection,id,data(base64)})`.
- **Bluetooth Classic (SPP):** `BluetoothSocket` UUID `0x1101`, IO di background
  thread, izin **BLUETOOTH_CONNECT** (API 31+) via sistem izin Capacitor; hanya
  device paired (tanpa SCAN/lokasi).
- **USB:** cari interface printer (kelas 7) → bulk-OUT endpoint → izin per-device
  (`UsbManager.requestPermission` + `BroadcastReceiver`) → `bulkTransfer` per 16KB.
- **Tanpa dependency eksternal (bukan DantSu):** byte ESC/POS sudah dibentuk di JS,
  jadi lapisan native cuma "kabel" — pakai API Android bawaan, nol dep Gradle.
- **JS:** `printers/nativePlugin.ts` (`registerPlugin('ThermalPrinter')`) +
  `printers/capacitorThermalTransport.ts`; dipasang di `bootstrap.ts` lewat
  `setPrinterTransport(...)` (native saja) — **tanpa ubah encoder/capability/UI/
  checkout**. Manifest: BLUETOOTH(+ADMIN) `maxSdkVersion=30`, BLUETOOTH_CONNECT,
  `uses-feature usb.host`.

### Added — Printer thermal (layer software ESC/POS)
- **Encoder ESC/POS** (`src/lib/escpos.ts`): `encodeReceipt(job) → Uint8Array`
  (init, align, bold, ukuran, potong). Murni & bebas hardware.
- **Seam transport** (`printers/transport.ts`): interface `PrinterTransport`
  (available/connections/list/print) + `nullTransport` default; plugin native
  BT/USB dipasang belakangan via `setPrinterTransport()` — **tanpa ubah core**.
- **`ThermalPrinter`** capability (`printers/thermalPrinter.ts`) menggantikan
  WebPreviewPrinter di build native; `isAvailable()` = transport ada + printer
  terpilih. Web tetap pakai WebPreviewPrinter (dialog browser).
- **Halaman Printer** dirombak: pilih koneksi (Bluetooth/USB) → pindai → pilih
  device (tersimpan device-local di `settings`), pilih lebar kertas 58mm/80mm,
  Test Print + Hapus, dan status "transport belum terpasang" yang informatif.
  `src/stores/printer.ts` dimuat saat boot → cetak ulang pakai lebar kertas benar.
- Catatan: **belum ada plugin Capacitor 8 tunggal untuk BT Classic + USB** →
  transport native (rencana: bungkus DantSu ESCPOS-ThermalPrinter-Android)
  menyusul; layer software di atas sudah final. Lihat
  `docs/features/printer-plugin.md`.

### Added — Export Excel (Transaksi & Cashflow)
- **Export ke Excel `.xlsx`** dari halaman Transaksi & Cashflow (ikon unduh di
  header → **modal** dengan **filter tanggal** yang sama seperti di halaman:
  preset Hari ini/Kemarin/Minggu ini/Bulan ini + kustom) + **loading state**
  ("Menyiapkan…") saat file dibangun.
- **Native (Android):** file ditulis ke cache lalu dibuka via **share sheet**
  (WA/Drive/email). **Web:** unduh langsung. (`src/lib/xlsx.ts`,
  `@capacitor/filesystem` + `@capacitor/share`.)
- **Transaksi** → 2 sheet: `Transaksi` (per struk: metode, status, subtotal,
  diskon, pajak, total, bayar, kembali) + `Item` (rincian item per struk).
  **Cashflow** → 2 sheet: `Cashflow` (per entri) + `Ringkasan` (total per kategori
  + pemasukan/pengeluaran/saldo). Uang diekspor sebagai angka mentah agar bisa
  dijumlah di Excel.
- Query per rentang independen dari filter halaman (`SaleItemRepository.listBetween`
  join `sales`); SheetJS di-*lazy-load* (chunk terpisah, hanya saat export).
- Komponen `src/components/common/ExportDialog.vue` (reusable: date filter +
  loading + error state).

### Added — Phase 7: Build Android
- **Platform Android (Capacitor) ditambahkan & terverifikasi jalan** di device via
  Android Studio. Workflow: `npm run build && npx cap sync android`, atau
  `npm run android:open` (WSL → Android Studio Windows, `scripts/open-android.sh`).
- `org.gradle.vfs.watch=false` (`android/gradle.properties`) — atasi error
  "Incorrect function" saat Gradle build file di filesystem WSL 9p lewat Windows.
- README diperbarui (status Phase 0–7, cara build Android, konfigurasi `.env`).

### Fixed
- **Frame app full-width di HP** (`App.vue`): `max-w-md` sebelumnya di-cap untuk
  semua ukuran → gutter kiri-kanan di HP >448px CSS-px. Kini full-width default;
  center + cap + shadow hanya di layar `≥sm` (tablet/desktop).

### Added — Google Sign-In native (Android)
- **Login Google di-handle native** di Android (`@capgo/capacitor-social-login`):
  `webClientId` = Web OAuth Client ID dipakai sebagai `server_client_id`, plugin
  balikin **ID token** yang diverifikasi server (`POST /auth/google`). Web tetap
  email/password.
- **Debug keystore bersama di-commit** (`android/debug.keystore`, kredensial
  standar `android`) + `signingConfigs.debug` di `android/app/build.gradle` →
  **SHA-1 konsisten di semua mesin** (WSL/Windows/CI), cukup daftar SHA-1 sekali.
  Keystore debug bukan rahasia.
- `mapGoogleError()` (`src/services/auth/google.ts`): error native → pesan
  actionable (DEVELOPER_ERROR/SHA-1, code 10, cancel, network).
- Docs baru `docs/features/google-signin-android.md`: langkah registrasi OAuth di
  Google Cloud Console (package `com.karuhundeveloper.poskacaw` + SHA-1
  `55:E5:…:7E:9C`), pakai **Web** Client ID di `VITE_GOOGLE_CLIENT_ID`.

### Added — Phase 6C: Integrasi FE ↔ POS Pro (sync aktif)
- **HTTP client** (`src/services/api/`): `ApiClient` (auth/sync/stores/health) +
  `config.ts` baca `VITE_API_BASE_URL` & `VITE_GOOGLE_CLIENT_ID` dari `.env`.
- **Store akun** (`stores/account.ts`): token Sanctum + toko aktif (device-local
  di tabel `settings`), login **email/password**, **register**, Google native, dan
  ganti toko. **Store sync** (`stores/sync.ts`) + `SyncEngine`: push outbox → pull
  per-entity (LWW/tombstone, cursor), auto-sync saat online (`@capacitor/network`).
- **Halaman Sambungkan** (`/connect`, `ConnectPage.vue`): tab **Masuk / Daftar**
  (register isi nama + konfirmasi sandi), pilih toko, status sync + "Sync sekarang".
  Base URL diambil dari `.env` (tak ditampilkan). Google Sign-In dibatasi
  **Android-only** (di web pakai email/password).
- **Manajemen outlet in-app**: dari halaman Sambungkan bisa **tambah outlet baru**
  & **ganti nama outlet** (khusus owner) + pilih outlet aktif —
  `account.createStore/renameStore` → `POST/PATCH /stores`.
- **Kartu POS Pro** dipindah ke paling atas halaman Setelan.

### Added
- **Filter tanggal di Transaksi & Cashflow**: komponen `DateRangeFilter` dengan
  preset **Hari ini / Kemarin / Minggu ini / Bulan ini** + rentang **kustom
  (dari–sampai)**. Query per rentang lewat `SaleRepository.listBetween` &
  `CashflowEntryRepository.listBetween`; ringkasan atas (total penjualan / saldo,
  pemasukan, pengeluaran, per-kategori) ikut mengikuti rentang yang dipilih.
  Default = bulan berjalan. Helper `src/lib/dateRange.ts` + `startOfDay/endOfDay`.

### Fixed
- **Isolasi data antar-outlet**: SQLite lokal single-tenant, jadi saat **pindah
  outlet** data outlet lama tidak lagi ikut tampil. `resetLocalBusinessData()`
  (`src/db/reset.ts`) membuang 8 tabel bisnis + outbox + `sync_state`, cache media
  in-memory dikosongkan (`media.clear()`), lalu sync menarik ulang data outlet
  baru dari nol. `settings` (device-local) dipertahankan. `ConnectPage` push
  antrean outlet lama dulu sebelum reset supaya perubahan tak hilang. Scoping
  `store_id` di server tetap lewat header `X-Store-Id` tiap push/pull.
- **`device_id` = UUID v7** (timestamp-ordered, unik) via `deviceUuid()`; prefix
  struk pendek diturunkan dari ekor acak (`devicePrefixOf`). Id lama <36 char
  di-upgrade otomatis.
- `.env` / `.env.example`: `VITE_API_BASE_URL` default `http://localhost:8000/api/v1`.

### Added — Phase 6: Kontrak API v1 & backend POS Pro
- **Kontrak API v1 difinalisasi** (`docs/api/pos-pro-api-v1.md`) — sumber kebenaran
  FE↔BE: endpoint auth/sync/stores, payload per entity, LWW/tombstone, RBAC, media.
- **Backend POS Pro** dibangun di `/var/www/html/pos-pro`
  (repo `git@github.com:karuhun-developer/pos-web.git`): Laravel + Sanctum, sync
  push/pull, multi-toko, RBAC spatie, media storage, OpenAPI Scramble.
- `docs/features/sync-pospro.md` diperbarui menunjuk kontrak; adapter FE
  (`HttpSyncAdapter`/`GoogleAuthProvider` + UI Sync) ditandai **Phase 6C**.

### Added — Phase 5: Login lokal & Kunci PIN
- **Kunci PIN app** (default OFF): toggle "Aktifkan Login" di Setelan membuka
  sheet buat PIN 6 digit (enter → konfirmasi); login aktif setelah PIN tersimpan.
- **PIN bergaram** (`src/lib/crypto.ts`): `makePinHash`/`verifyPin` — SHA-256 via
  Web Crypto, salt 16 byte acak, disimpan `"<saltHex>:<hashHex>"` di
  `settings.pin_hash` (tak pernah plaintext).
- **`stores/auth.ts`**: `isLocked` (login on + PIN ada + belum unlock), `verify`,
  `setPin`, `enableLogin`, `disableLogin` (bersihkan PIN), `lock`.
- **LockPage** (`/lock`) + **router guard** `beforeEach`: app terkunci → semua
  rute dialihkan ke `/lock` (simpan tujuan di `?redirect=`), PIN benar kembali ke
  tujuan; reload = terkunci lagi (status unlock hidup di memori).
- **PinPad** (`components/common/PinPad.vue`): titik PIN + keypad numerik, animasi
  shake saat salah; dipakai LockPage & sheet PIN.
- Setelan Keamanan: **Ubah PIN** & **Kunci Sekarang** saat login aktif.
- Smoke test diperluas: aktifkan login → set PIN → reload terkunci → PIN salah
  ditolak → PIN benar buka + balik ke tujuan → matikan login (bersih).

### Added — Phase 4: Cashflow Ledger
- **CashflowPage**: ringkasan saldo bulan berjalan (pemasukan/pengeluaran/net),
  breakdown per kategori, ledger dikelompokkan per hari dengan net harian.
- **Entri manual** (`CashflowEntryFormPage`): toggle Pemasukan/Pengeluaran,
  pilih kategori, nominal, catatan — mis. gaji karyawan atau belanja stok.
  `direction` diturunkan dari `type` kategori (income→debit, expense→credit),
  `source='manual'`, dan ter-link `session_id` ke sesi kasir aktif saat dibuat.
- Entri dari checkout (`source='sale'`) tampil terkunci (read-only) di ledger.
- **Kelola kategori** (`CashflowCategoriesPage`): tambah/rename/hapus kategori
  income/expense; kategori sistem (Penjualan) terkunci.
- `src/lib/datetime.ts`: `monthKey`/`formatMonth` untuk agregasi bulanan.
- Smoke test diperluas: entri manual pengeluaran → assert `direction='credit'` +
  `source='manual'` + ke-link sesi + memengaruhi `expected_cash` saat tutup kasir.
- Perbaikan smoke test: langkah soft-delete kini buka halaman edit langsung &
  menunggu navigasi balik (hilangkan balapan render yang bikin flaky).

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
