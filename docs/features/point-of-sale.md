# Fitur: Point of Sale + Transaksi

**Status:** ✅ Selesai (Phase 2) · **Route:** `/pos`, `/transactions`, `/transactions/:id`

## Tujuan
Layar jualan cepat: pilih produk → keranjang → bayar → struk, sekaligus otomatis
mencatat pemasukan ke cashflow.

## User Flow
1. Buka **Kasir** (Point of Sale).
2. Grid produk (produk `active=1`) + pencarian; tap untuk menambah ke keranjang.
3. Bar **Lihat Keranjang** ter-pin di bawah → sheet keranjang: atur qty (stepper,
   dibatasi stok bila `track_stock`), hapus baris, kosongkan.
4. **Bayar** → dialog pembayaran: total, metode (Tunai / QRIS / Transfer).
   - Tunai: input uang diterima + saran nominal (uang pas & pembulatan), kembalian.
   - QRIS: bila **QRIS Dinamis** aktif, QR dengan nominal pas dirender untuk di-scan.
5. **Selesaikan Pembayaran** → transaksi tersimpan atomic, layar sukses (total +
   kembalian) → **Cetak Struk** atau **Transaksi Baru**.
6. **Transaksi** menampilkan riwayat (dikelompokkan per hari + ringkasan hari ini)
   dan detail per struk (cetak ulang struk).

## Data & Aturan
- `sales` + `sale_items` (dengan `name_snapshot`/`price_snapshot` → history aman
  walau produk diedit/dihapus).
- Checkout = **satu transaksi atomic** (`CheckoutService.checkout`):
  1. insert `sales` + `sale_items`,
  2. kurangi `stock` untuk produk `track_stock`,
  3. insert `cashflow_entries` (`direction='debit'`, kategori sistem *Penjualan*,
     `source='sale'`, `source_ref=sales.id`),
  4. `session_id` = sesi kasir aktif (bila ada, Phase 3).
  Tiap tulisan menghasilkan baris `outbox`-nya sendiri (sync-ready).
- `sales.number` = `{PREFIX}-{YYYYMMDD}-{seq}`; `PREFIX` dari `device_id`, `seq` =
  jumlah sale hari yang sama + 1 → unik walau offline & multi-device.
- Uang = INTEGER minor units (rupiah bulat), tanpa float.
- **Riwayat transaksi:** filter tanggal (preset + kustom, default bulan berjalan) +
  **Export Excel** (ikon unduh di header → modal filter + loading). `.xlsx` 2 sheet:
  `Transaksi` (per struk) + `Item` (rincian item). Native → share sheet, web →
  unduh. Lihat `sales.buildExport()` + `SaleItemRepository.listBetween` + `src/lib/xlsx.ts`.

### Catatan korektness transaksi
- `SqliteDb.transaction` **reentran** pada instance yang sama (`this.inTx`); di
  dalam transaksi callback menerima handle `tx` baru (`inTransaction=true`).
  `CheckoutService` membangun **semua repo di atas `tx`** agar tidak membuka
  transaksi bersarang.
- `persist()` (= `saveToStore`) menutup transaksi SQLite aktif. `BaseRepository`
  men-guard `persist()` dengan `if (!this.db.inTransaction)`, dan checkout
  memanggil `persist()` **sekali** setelah commit terluar.

## QRIS di checkout
Bila metode = QRIS **dan** `settings.qris_payload` ada, PaymentDialog merender QR
untuk di-scan pembeli, dengan tombol **Sudah Bayar** / **Batal** (bukan langsung
"Selesaikan Pembayaran"):
- `qris_dynamic` **aktif** → `makeDynamicPayload(payload, total)`: QR nominal-pas,
  pembeli tidak perlu ketik jumlah.
- `qris_dynamic` **mati** → tampilkan QRIS statis apa adanya; pembeli scan lalu
  ketik nominal manual (caption mengingatkan jumlahnya).

Bila QRIS statis belum di-upload, metode QRIS jatuh ke fallback "dianggap lunas".
Detail algoritma & setelan: lihat `settings-auth.md` (bagian QRIS).

## Kode
- `src/services/checkout.service.ts`
- `src/repositories/sale.repo.ts`, `saleItem.repo.ts`,
  `cashflowCategory.repo.ts`, `cashflowEntry.repo.ts`
- `src/stores/cart.ts`, `src/stores/sales.ts`
- `src/lib/receipt.ts` (struk dua kolom monospace)
- `src/pages/pos/PosPage.vue`, `src/components/pos/{CartSheet,PaymentDialog}.vue`,
  `src/components/common/BottomSheet.vue`
- `src/pages/transactions/{TransactionsPage,TransactionDetailPage}.vue`

## Verifikasi
Smoke test (Playwright): jual Bolu Coklat → sale (total 27000 / paid 50000 /
change 23000 / completed), `sale_items` (qty 1, line_total 27000), stok 10→9,
`cashflow_entries` (debit +27000), dan `outbox` memuat `sales` + `sale_items` +
`cashflow_entries` — **lulus**.
