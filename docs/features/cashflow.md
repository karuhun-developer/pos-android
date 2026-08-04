# Fitur: Cashflow Ledger

**Status:** 🔜 Direncanakan (Phase 4) · **Route:** `/cashflow`, `/cashflow/new`, `/cashflow/categories`

## Tujuan
Pembukuan sederhana: pemasukan & pengeluaran per kategori (debit/kredit),
termasuk entri manual seperti gaji karyawan atau belanja stok.

## User Flow
1. **Cashflow** → ringkasan saldo + daftar entri (dikelompokkan per hari).
2. **+ Entri** → pilih kategori, jumlah, catatan, tanggal → simpan.
3. Kelola kategori cashflow (income/expense).
4. Filter per kategori / rentang tanggal; lihat total per kategori.

## Data & Aturan
- `cashflow_categories`: `name`, `type` (`income`/`expense`), `is_system`, `sort_order`.
  Seed bawaan: **Penjualan** (sistem, non-hapus), Modal/Setoran, Belanja Stok,
  Gaji Karyawan, Operasional.
- `cashflow_entries`: `category_id`, `direction` (`debit`=masuk / `credit`=keluar),
  `amount`, `source` (`manual`/`sale`), `source_ref`, `note`, `occurred_at`, `session_id`.
- Entri dari checkout dibuat otomatis (`source='sale'`) — read-only di ledger.
- `direction` diturunkan dari `type` kategori (income→debit, expense→credit).

## Kode (rencana)
- `src/repositories/cashflowCategory.repo.ts`, `cashflowEntry.repo.ts`
- `src/stores/cashflow.ts`, `src/pages/cashflow/*`
