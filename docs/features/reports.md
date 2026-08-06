# Fitur: Laporan/Analitik

**Status:** ✅ Selesai · **Route:** `/reports`

## Tujuan
Ringkasan bisnis harian + grafik tren dari data **transaksi** (penjualan) dan
**cashflow**, dengan export Excel. Melengkapi item PRD "Laporan/analitik lanjutan
(grafik, export Excel)".

## User Flow
1. **Home → Laporan** → halaman ringkasan.
2. **KPI Hari ini** tampil di atas (selalu data hari ini, tak ikut filter):
   penjualan hari ini (total + jumlah transaksi) dan pemasukan vs pengeluaran.
3. **Grafik tren** — pilih **sumber** (Transaksi / Cashflow) + **rentang tanggal**
   (Hari ini/Minggu ini/Bulan ini + kustom).
4. **Export Excel** (ikon unduh di header) → modal filter tanggal + tombol export,
   sesuai sumber aktif.

## Data & Aturan
- **KPI hari ini** dihitung dari query `presetRange('today')` — independen dari
  rentang grafik. Penjualan = jumlah `total` sale `status='completed'`; pemasukan
  = Σ `direction='debit'`, pengeluaran = Σ `direction='credit'`.
- **Grafik tren** mengikuti `DateRangeFilter` (default **Minggu ini**). Sumbu-x =
  daftar hari dalam rentang (termasuk hari kosong = 0).
  - Sumber **Transaksi** → 1 seri bar: total penjualan (`completed`) per hari.
  - Sumber **Cashflow** → 2 seri bar: Pemasukan (debit) vs Pengeluaran (credit)/hari.
- Grafik pakai **ApexCharts**; tooltip & label sumbu-Y pakai `formatRupiah`, tema
  ikut dark/light (`document.documentElement` class `dark`).
- **Export Excel** *reuse* `sales.buildExport()` / `cashflow.buildExport()` lewat
  `ExportDialog` (prop `buildSheets` di-switch sesuai sumber). Tidak ada kode export
  baru. Lihat `src/lib/xlsx.ts`.

## Kode
- `src/stores/reports.ts` — store read-only khusus laporan (terpisah dari store
  sales/cashflow agar tak mengubah `range` halaman lain): `todaySalesSummary`,
  `todayCashflow`, `chart` (categories + series), `hasChartData`, `setSource`,
  `setRange`. Query via `SaleRepository.listBetween` & `CashflowEntryRepository.listBetween`.
- `src/pages/reports/ReportsPage.vue` — KPI hari ini, toggle sumber, `DateRangeFilter`,
  grafik `<VueApexCharts>` (di-import lokal → chunk lazy `/reports`), `ExportDialog`.
- Reuse: `src/components/common/ExportDialog.vue`, `DateRangeFilter.vue`,
  `src/lib/dateRange.ts` (`presetRange`/`rangeLabel`), `src/lib/money.ts`,
  `src/lib/datetime.ts` (`dayKey`/`startOfDay`).

## Dependency
- `apexcharts` + `vue3-apexcharts` — di-import lokal di `ReportsPage.vue` supaya
  hanya masuk chunk `/reports` (lazy), bundle utama tetap ramping.
