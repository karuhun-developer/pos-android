# Fitur: Cashflow Ledger

**Status:** ✅ Selesai (Phase 4) · **Route:** `/cashflow`, `/cashflow/new`, `/cashflow/:id/edit`, `/cashflow/categories`

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
- Kesembilan kategori bawaan (termasuk Pendapatan Lain, Sewa Tempat, Listrik &
  Air, dan Lain-lain) adalah baseline **device-local**. Saat seed awal, boot,
  atau reset lokal, semuanya dibuat bersih (`dirty=0`) tanpa `outbox`, sehingga
  tidak terunggah ke POS Pro. Setelah pengguna mengubahnya, kategori tersebut
  kembali menjadi perubahan bisnis normal dan ikut mekanisme outbox/sync.
- Migrasi legacy v6 hanya membersihkan **seluruh cohort seed lengkap**: pada
  satu `created_at` harus ada tepat sembilan row total; masing-masing wajib
  aktif, non-enqueued, `dirty=1`, `sync_version=0`, `remote_id` null,
  `created_at=updated_at`, dan cocok tepat sekali dengan satu default historis
  menurut `name`/`type`/`is_system`/`sort_order`. Satu row ekstra, diubah,
  remote, terhapus, versioned, atau outboxed memblokir pembersihan seluruh
  cohort. Row tanpa provenance permanen tidak dapat dibedakan bila persis
  menggantikan default dalam cohort sembilan-row yang sama.
- `cashflow_entries`: `category_id`, `direction` (`debit`=masuk / `credit`=keluar),
  `amount`, `source` (`manual`/`sale`), `source_ref`, `note`, `occurred_at`, `session_id`.
- Entri dari checkout dibuat otomatis (`source='sale'`) — read-only di ledger.
- `direction` diturunkan dari `type` kategori (income→debit, expense→credit).
- **Filter tanggal** (preset Hari ini/Kemarin/Minggu ini/Bulan ini + kustom) —
  `entries`, ringkasan, & breakdown mengikuti rentang aktif. Default bulan berjalan.
- **Export Excel** (ikon unduh di header) → modal filter tanggal + tombol export
  (loading state). Menghasilkan `.xlsx` 2 sheet: `Cashflow` (per entri) +
  `Ringkasan` (total per kategori + pemasukan/pengeluaran/saldo). Native → share
  sheet, web → unduh. Lihat `cashflow.buildExport()` + `src/lib/xlsx.ts`.

## Kode
- `src/repositories/cashflowCategory.repo.ts`, `cashflowEntry.repo.ts`
- `src/stores/cashflow.ts` — `monthSummary` (income/expense/net bulan ini),
  `byCategory`, `createEntry`/`updateEntry`/`deleteEntry`, CRUD kategori.
- `src/pages/cashflow/CashflowPage.vue` — ringkasan bulan + breakdown kategori +
  ledger per hari; entri `source='sale'` terkunci (ikon gembok), entri manual
  bisa diklik untuk diedit.
- `src/pages/cashflow/CashflowEntryFormPage.vue` — tambah/edit entri manual
  (toggle Pemasukan/Pengeluaran, pilih kategori, nominal, catatan); link
  `session_id` ke sesi kasir aktif saat dibuat.
- `src/pages/cashflow/CashflowCategoriesPage.vue` — kelola kategori; kategori
  sistem (mis. Penjualan) terkunci.
- `src/lib/datetime.ts` — `monthKey`/`formatMonth` untuk agregasi bulanan.
