# Fitur: Buka/Tutup Kasir

**Status:** ✅ Selesai (Phase 3) · **Route:** `/cashier`

## Tujuan
Kelola sesi kasir harian untuk rekonsiliasi uang tunai (modal awal vs isi laci
saat tutup).

## User Flow
1. **Buka Kasir** → input modal awal (`opening_cash`) + catatan opsional → sesi
   `status='open'`. Tolak bila masih ada sesi terbuka.
2. Selama sesi: setiap transaksi POS ter-link ke `session_id` sesi aktif
   (PosPage mengisi `sessionId` dari sesi terbuka; opsional — penjualan tetap
   jalan tanpa sesi). POS menampilkan banner status sesi + perkiraan laci live.
3. **Tutup Kasir** → sheet menampilkan rincian `expected_cash`; kasir input
   `counted_cash` (uang fisik) → selisih tampil live.
4. Sesi disimpan `status='closed'` dengan `expected_cash`, `counted_cash`,
   `difference` (lebih/kurang/pas). Riwayat sesi tampil di halaman kasir.

## Data & Aturan
- Tabel `cashier_sessions`: `opened_at`, `closed_at`, `opening_cash`,
  `expected_cash`, `counted_cash`, `difference`, `status`, `opened_by`, `note`.
- Hanya boleh **satu sesi open** dalam satu waktu (`CashierService.open` menolak
  bila `current()` masih ada).
- **Perhitungan expected cash** (`CashierSessionRepository.summary`):
  ```
  expected_cash = opening_cash
                + Σ(sales.total  WHERE payment_method='cash')   -- tunai nambah laci
                + Σ(cashflow debit source='manual')             -- kas masuk manual
                − Σ(cashflow credit source='manual')            -- kas keluar manual
  ```
  Cash sales diambil langsung dari `sales` (bukan cashflow) supaya QRIS/transfer
  tidak ikut, dan cashflow otomatis `source='sale'` tidak dobel-dihitung. Entri
  cashflow manual (Phase 4) diperlakukan sebagai pergerakan kas laci.
- `difference = counted_cash − expected_cash` (positif = lebih, negatif = kurang).

## Kode
- `src/repositories/cashierSession.repo.ts` (`current`, `listRecent`, `summary`)
- `src/services/cashier.service.ts` (`open`, `close`, `summary`)
- `src/stores/cashier.ts`, `src/pages/cashier/CashierPage.vue`
- Integrasi: `src/pages/pos/PosPage.vue` (link `session_id` + banner status)

## Verifikasi
Smoke test: buka kasir (modal 100000) → jual tunai 27000 → sale ter-link ke
`session_id` → tutup dengan hitung 130000 → `expected_cash=127000`,
`difference=+3000` (lebih). **Lulus.**
