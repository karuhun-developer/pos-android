# Fitur: Barcode — Render, Scan, Impor/Ekspor

**Status:** ✅ Selesai · **Route:** `/pos/scan` (mode scan kasir)

## Tujuan
Bikin barcode berguna, bukan sekadar teks yang tersimpan: bisa **dirender & dibagikan**,
bisa **di-scan** buat jualan cepat, dan bisa dipakai sebagai kunci **impor massal**.

---

## 1. Tipe barcode (`products.barcode_type`)

Migrasi client **v4** (`src/db/migrations.ts`) menambah kolom
`barcode_type TEXT NOT NULL DEFAULT 'EAN13'` + index `idx_products_barcode`.
Server dapat kolom yang sama lewat
`2026_08_12_100000_add_barcode_type_to_products_table.php`.

**EAN-13 jadi default** — itu simbologi barcode produk ritel yang paling umum.

Tipe yang didukung (`src/lib/barcode.ts`, satu-satunya modul yang tahu JsBarcode):
`EAN13` · `CODE128` · `EAN8` · `UPC` · `CODE39` · `ITF14`.

Validasi memakai callback `valid` bawaan JsBarcode — otoritatif, termasuk check
digit EAN/UPC. Tanpa callback itu JsBarcode **melempar** untuk input tak sah.

> **Validasi sifatnya peringatan, bukan blokir.** Barcode lama yang tak sesuai
> simbologi tetap bisa disimpan; user cuma diberi tahu bahwa barcode-nya nanti
> tak bisa dirender/dicetak.

**Sync:** tanpa perubahan kode sync sama sekali. Outbox mengirim row penuh, dan
server memfilter kolom lewat `Schema::getColumnListing()`. Catatan operasional:
`ApplyChange::$columnCache` static per-proses → **restart worker/Octane setelah
migrate**.

**Keunikan barcode tidak ditegakkan di server.** `PushChanges` cuma menangkap
`SyncRejection`; unique constraint bakal melempar `QueryException` mentah dan
menggagalkan seluruh batch push — plus baris outbox yang ditolak berstatus
`failed` permanen, dan flag `dirty=1`-nya bakal terus memblokir `applyPull` untuk
produk itu. Duplikat dicegah di client: validasi form + skip saat impor.

## 2. Lihat / bagikan barcode

Baris di daftar produk = `RouterLink` + tombol barcode **bersebelahan** (bukan
tombol di dalam link — kalau bersarang, tap tombolnya ikut menavigasi ke form edit).
Tombol cuma muncul kalau produknya punya barcode.

`src/components/products/BarcodeSheet.vue` merender ke `<svg>` di atas **kartu
putih** — scanner membaca kontras, bukan warna tema, jadi latar ini tetap putih
walau app dalam dark mode. Tombol **Bagikan / Simpan Gambar** merender ulang ke
`<canvas>` → PNG → `saveOrShare()` (native: share sheet, web: unduh).

> Cetak barcode ke printer thermal **di luar scope**: `ThermalPrinter` jalur ESC/POS
> teks; cetak raster butuh command image terpisah.

## 3. Scan barcode di kasir (`/pos/scan`)

Layout sesuai permintaan — kamera **tidak** fullscreen:

```
┌─────────────────────────┐
│   KAMERA (45dvh)        │  bingkai sasaran + torch + toast
├─────────────────────────┤
│ Indomie Goreng    − 2 + │  keranjang, scroll
│ Aqua 600ml        − 1 + │
├─────────────────────────┤
│ Total          Rp 24.000│
│ [        Bayar        ] │
└─────────────────────────┘
```

**Arsitektur:** `ScannerCapability` di `src/services/capabilities/registry.ts`
(pola sama dengan printer). Satu implementasi terdaftar: `WebScanner`
(`getUserMedia` + `<video>` inline), dipakai di **web dan Android**.

Kenapa bukan plugin ML Kit native: mesin decode-nya sama (`BarcodeDetector` di
Android memakai ML Kit), izin kamera runtime-nya sudah di-handle
`BridgeWebChromeClient` WebView Capacitor, dan yang menentukan — ML Kit merender
kamera **di belakang webview** (butuh seluruh halaman ditransparankan), yang
langsung bentrok dengan layout kamera-setengah-layar di atas. Kalau nanti tetap
perlu engine native, tinggal daftarkan implementasi lain di `bootstrap.ts`;
`ScannerCapability` yang jadi kontraknya.

**Decode** (`scanner/detector.ts`) dua tingkat:
1. `BarcodeDetector` bawaan platform (dicek lewat `getSupportedFormats()`),
2. fallback lazy `@zxing/browser`.
   Ponyfill wasm sengaja dihindari — mereka menarik file dari CDN, dan app ini
   offline-first.

Loop decode di-throttle ~10 fps dan cuma membaca **ROI pita tengah** (100% lebar ×
40% tinggi) — jauh lebih murah untuk jalur ZXing dan mengurangi salah baca.

**Anti-dobel** (`scanner/scanGate.ts`): kode yang sama diabaikan bila < 1500 ms
dari scan sebelumnya, kode apa pun minimal berjarak 400 ms. Umpan balik =
`navigator.vibrate` + beep WebAudio (oscillator, tanpa file aset).

**Perilaku scan** (`src/pages/pos/ScanPage.vue`):

| Kondisi | Hasil |
|---|---|
| Barcode dikenal & tersedia | masuk keranjang + getar/beep + toast nama & harga |
| Produk `active=0` | toast merah, tidak masuk keranjang |
| Stok habis / qty sudah = stok | toast merah (`cart.add` menolak diam-diam, jadi dicek eksplisit) |
| Barcode asing | kartu inline "belum terdaftar" → **Buat** (`/products/new?barcode=…`) / **Lewati** |

Tombol **Bayar** mematikan kamera lalu `router.replace('/pos?pay=1')` — checkout
tetap **satu jalur** di `PosPage` (sesi kasir, cetak struk, layar sukses), jadi tidak
ada logika pembayaran yang terduplikasi.

**Lifecycle kamera:** mati saat komponen unmount, saat halaman ke background
(`visibilitychange`), dan sebelum navigasi keluar. Izin ditolak → empty state
dengan arahan ke Setelan + tombol "Coba lagi".

**Android:** `AndroidManifest.xml` mendeklarasikan `CAMERA` +
`uses-feature camera/autofocus` dengan `required="false"` (app tetap bisa dipasang
di perangkat tanpa kamera).

## 4. Impor / Ekspor produk (CSV + XLSX)

Header kolom Bahasa Indonesia:
`nama, kategori, sku, barcode, tipe_barcode, harga_jual, harga_modal, lacak_stok, stok, aktif`.
Header EN & variasi umum dialiaskan (`name`, `price`, `stock`, …), jadi file hasil
edit orang tetap kebaca. Kategori ditulis sebagai **nama**, bukan UUID; kategori
yang belum ada **dibuat otomatis** saat impor. Kolom `id` sengaja tidak diekspor —
impor selalu membuat produk baru.

**Aturan skip (permintaan user):** baris yang barcode-nya **sudah ada** dilewati,
termasuk duplikat **di dalam file itu sendiri**. Baris **tanpa** barcode selalu
diimpor.

Dua detail parsing yang tak boleh diubah (`src/lib/xlsx.ts`):
- `raw: false` → semua sel dibaca sebagai **string**; tanpa ini barcode 13 digit
  ke-parse jadi number dan keluar sebagai `8.99123e+12`. Baris yang terlanjur
  rusak seperti itu ditolak dengan pesan yang menyuruh format kolomnya sebagai Teks.
- CSV dibaca sebagai **teks**, bukan ArrayBuffer — lewat ArrayBuffer SheetJS menebak
  codepage 1252 dan nama beraksen jadi mojibake. Ekspor CSV diawali BOM UTF-8 dengan
  alasan yang sama (Excel locale ID).

**Penulisan** (`src/services/products/productIo.ts`): repo dibangun di atas handle
`tx`, bukan `getDb()` — `db.transaction()` reentrant-nya **per objek `Db`**, jadi
repo yang memegang instance luar akan membuka `beginTransaction` kedua dan meledak.
Ditulis per chunk 300 baris (satu commit raksasa membekukan UI), `persist()` sekali
per chunk. Outbox tetap 1 baris per produk — memang harus, supaya semuanya ke-push.

Store punya `bulkImport()` yang memanggil `load()` **sekali di akhir**; `create()`
biasa me-reload seluruh list tiap baris dan bikin impor ratusan produk merangkak.

**Pemilihan file** (`src/lib/file.ts`): hidden `<input type="file">` — WebView
Capacitor sudah meng-handle `onShowFileChooser`, jadi tanpa plugin native pun picker
sistem terbuka. Di native `accept` dibiarkan `*/*` karena Android memetakan `accept`
ke MIME lewat MimeTypeMap dan `.xlsx` sering tak terpetakan sehingga file-nya
abu-abu; ekstensinya divalidasi di JS setelah user memilih.

## Kode Terkait
- `src/lib/barcode.ts`, `src/lib/download.ts`, `src/lib/file.ts`, `src/lib/xlsx.ts`
- `src/services/capabilities/registry.ts`, `scanner/{detector,scanGate,webScanner}.ts`
- `src/components/pos/{CameraScanner,ScannerSheet,CartLines}.vue`
- `src/components/products/{BarcodeSheet,ProductIoSheet}.vue`
- `src/pages/pos/ScanPage.vue`, `src/services/products/productIo.ts`

## Verifikasi
Smoke test (`scripts/smoke.mjs`):
- kolom `barcode_type` ada (migrasi v4) & nilainya **bertahan saat form edit dibuka
  ulang** — regresi klasik kolom baru yang lupa dipetakan;
- payload `outbox` produk memuat `barcode_type`;
- sheet barcode merender bar lewat JsBarcode;
- impor CSV 4 baris → 2 masuk, 1 dilewati (barcode sama), 1 error (tanpa nama),
  kategori baru dibuat, outbox terisi;
- mode scan (`window.__scan`, hook khusus dev): barcode dikenal masuk keranjang,
  barcode asing memunculkan tawaran buat produk.

Server: `./vendor/bin/pest` — push dengan `barcode_type`, push **tanpa** kolom itu
(klien lama → jatuh ke default `EAN13`), dan pull menyertakannya.
