# Fitur: Manajemen Produk

**Status:** ✅ Selesai (Phase 1) · **Route:** `/products`, `/products/new`, `/products/:id/edit`, `/categories`

## Tujuan
Kelola katalog produk & kategori sebagai dasar transaksi kasir.

## User Flow
1. Buka **Produk** dari home / bottom nav.
2. Lihat daftar produk (cari via nama/SKU/barcode, filter per kategori).
3. **+ Tambah Produk** → isi form (termasuk **foto**) → Simpan.
4. Tap produk → edit / hapus.
5. Tombol **Kategori** di header → kelola **Kategori** (tambah/rename/hapus).

## Foto produk (sync-ready)
- Pilih foto: **Tambah Foto** → native pakai kamera/galeri (`@capacitor/camera`),
  web pakai file picker. Otomatis **di-downscale ke JPEG ≤512px** (`src/lib/image.ts`).
- Byte gambar disimpan di **tabel `media` terpisah** (base64), bukan inline di row
  produk. `products.image_path` cuma nyimpen ref pendek `media://<id>`.
- **Kenapa terpisah:** `outbox` menyalin seluruh row produk tiap edit; kalau base64
  nempel di produk, tiap ganti harga/stok ikut nge-push ulang gambar. Dengan tabel
  `media`, byte gambar cuma sekali masuk outbox (saat media di-insert), edit produk
  tetap ringan. Media = `SyncEntity` → ikut outbox → **sync otomatis**.
- **Dedup:** hash SHA-256 konten; foto identik pakai ulang media yang sama.
- **Seam POS Pro:** kolom `remote_url` disiapkan — nanti transport bisa di-swap ke
  object storage (isi `remote_url`, drop `data`) tanpa ubah kode produk.

## Data
- Tabel `products`: `name`, `category_id`, `price`, `cost`, `sku`, `barcode`,
  `track_stock`, `stock`, `active`, `image_path` (ref `media://<id>`) (+ kolom sync).
- Tabel `categories`: `name`, `sort_order`, `color` (+ kolom sync).
- Tabel `media`: `mime`, `width`, `height`, `bytes`, `hash`, `data` (base64),
  `remote_url` (+ kolom sync).

## Aturan Bisnis
- `name` wajib. Harga & modal dalam **INTEGER rupiah**.
- Stok hanya dilacak bila `track_stock=1`; kalau off, `stock` di-set 0.
- Hapus = **soft delete** (`deleted_at`), row tetap ada untuk sync.
- Hapus kategori tidak menghapus produk — produk jadi "Tanpa kategori".
- `active=0` → produk disembunyikan di layar kasir (Phase 2).

## Kode Terkait
- `src/repositories/product.repo.ts`, `category.repo.ts`, `media.repo.ts`
- `src/stores/products.ts`, `categories.ts`, `media.ts`
- `src/lib/image.ts` (pick/downscale/hash)
- `src/pages/products/ProductsPage.vue`, `ProductFormPage.vue`, `CategoriesPage.vue`
- `src/components/common/MoneyInput.vue`

## Verifikasi
Smoke test (`scripts/smoke.mjs`): buat kategori → buat produk **+ upload foto** →
cek DB (`price`, `dirty=1`, `image_path='media://…'`, row `media` berisi data+hash)
→ `outbox` mencatat insert produk **dan** media → **edit harga** buktikan payload
produk tetap kecil & `media` gak nambah → reload (persist) → soft delete.
