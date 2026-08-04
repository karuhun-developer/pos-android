# Fitur: Buka/Tutup Kasir

**Status:** 🔜 Direncanakan (Phase 3) · **Route:** `/cashier`

## Tujuan
Kelola sesi kasir harian untuk rekonsiliasi uang tunai.

## User Flow
1. **Buka Kasir** → input modal awal (`opening_cash`) → sesi `status='open'`.
2. Selama sesi: semua `sales` & `cashflow_entries` tunai ter-link ke `session_id`.
3. **Tutup Kasir** → sistem hitung `expected_cash` = modal + penjualan tunai +
   kas masuk − kas keluar. Kasir input `counted_cash` (uang fisik).
4. `difference = counted_cash − expected_cash` ditampilkan (lebih/kurang).

## Data & Aturan
- Tabel `cashier_sessions`: `opened_at`, `closed_at`, `opening_cash`,
  `expected_cash`, `counted_cash`, `difference`, `status`.
- Hanya boleh **satu sesi open** dalam satu waktu.
- Menutup sesi mengunci `expected_cash` dari agregasi entri bertanda `session_id`.

## Kode (rencana)
- `src/repositories/cashierSession.repo.ts`, `src/services/cashier.service.ts`
- `src/stores/cashier.ts`, `src/pages/cashier/CashierPage.vue`
