# Fitur: Manajemen Produk

**Status:** ✅ Selesai (Phase 1) · **Route:** `/products`, `/products/new`, `/products/:id/edit`, `/categories`

## Tujuan
Kelola katalog produk & kategori sebagai dasar transaksi kasir.

## User Flow
1. Buka **Produk** dari home / bottom nav.
2. Lihat daftar produk (cari via nama/SKU/barcode, filter per kategori).
3. **+ Tambah Produk** → isi form → Simpan.
4. Tap produk → edit / hapus.
5. Ikon tag di header → kelola **Kategori** (tambah/rename/hapus).

## Data
- Tabel `products`: `name`, `category_id`, `price`, `cost`, `sku`, `barcode`,
  `track_stock`, `stock`, `active` (+ kolom sync).
- Tabel `categories`: `name`, `sort_order`, `color` (+ kolom sync).

## Aturan Bisnis
- `name` wajib. Harga & modal dalam **INTEGER rupiah**.
- Stok hanya dilacak bila `track_stock=1`; kalau off, `stock` di-set 0.
- Hapus = **soft delete** (`deleted_at`), row tetap ada untuk sync.
- Hapus kategori tidak menghapus produk — produk jadi "Tanpa kategori".
- `active=0` → produk disembunyikan di layar kasir (Phase 2).

## Kode Terkait
- `src/repositories/product.repo.ts`, `category.repo.ts`
- `src/stores/products.ts`, `categories.ts`
- `src/pages/products/ProductsPage.vue`, `ProductFormPage.vue`, `CategoriesPage.vue`
- `src/components/common/MoneyInput.vue`

## Verifikasi
Smoke test (`scripts/smoke.mjs`): buat kategori → buat produk → cek DB (`price`,
`dirty=1`) → cek `outbox` mencatat insert → reload (persist) → soft delete.
