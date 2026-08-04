# Fitur: Point of Sale + Transaksi

**Status:** 🔜 Direncanakan (Phase 2) · **Route:** `/pos`, `/transactions`, `/transactions/:id`

## Tujuan
Layar jualan cepat: pilih produk → cart → bayar → struk, sekaligus otomatis
mencatat pemasukan ke cashflow.

## User Flow
1. Buka **Point of Sale**.
2. Grid produk (produk `active=1`), tap untuk menambah ke cart, atur qty.
3. **Bayar** → dialog: total, uang diterima, kembalian, metode (tunai dulu).
4. **Proses** → transaksi tersimpan, struk tampil (cetak via capability printer).
5. **Transaksi** menampilkan riwayat + detail per struk.

## Data & Aturan
- `sales` + `sale_items` (dengan `name_snapshot`/`price_snapshot`).
- Checkout = **satu transaksi atomic** (`CheckoutService`):
  1. insert `sales` + `sale_items`,
  2. kurangi `stock` untuk produk `track_stock`,
  3. insert `cashflow_entries` (income, kategori sistem *Penjualan*, `source='sale'`, `source_ref=sales.id`),
  4. `session_id` = sesi kasir aktif (bila ada, Phase 3).
- `sales.number` = `{device_id}-{urut}` agar unik offline.

## Kode (rencana)
- `src/services/checkout.service.ts`
- `src/repositories/sale.repo.ts`, `saleItem.repo.ts`
- `src/stores/cart.ts`
- `src/pages/pos/PosPage.vue`, `src/components/pos/*`
