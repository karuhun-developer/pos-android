# Design System — POS Kacaw

Rujukan visual untuk seluruh app. Tujuan: tampilan **konsisten & matang** dan
**responsif dari HP sampai iPad**. Gaya: **monokrom** — **latar abu-abu netral
sejuk** + **kartu putih** + **aksen hitam/charcoal** (tombol, chip terpilih, nav
aktif). **Biru (`--info`) hanya untuk harga/uang** sebagai aksen tipis. Header
"hero" gelap (`--hero`) dipakai konsisten di light & dark. (Referensi: Kopag
Mobile POS — bukan cream/kuning, bukan olive/hijau.)

Prinsip inti: **warna & radius lewat token**, bukan hardcode per-elemen. Ubah
token di `src/assets/index.css` → seluruh app ikut. Jangan tambah warna mentah
(`emerald-*`, `rose-*`, `amber-*`) di halaman — pakai token semantik di bawah.

## 1. Token warna (`src/assets/index.css`)

Didefinisikan sebagai CSS variable oklch di `:root` (terang, default) & `.dark`
(gelap), diekspos jadi utility Tailwind lewat `@theme inline` (mis. `bg-primary`,
`text-muted-foreground`, `border-border`).

| Token | Terang (netral/charcoal) | Gelap (charcoal) | Peran |
|---|---|---|---|
| `--background` | `oklch(0.96 0.002 240)` | `oklch(0.26 0.015 250)` | latar app (abu netral) |
| `--foreground` | `oklch(0.24 0.01 250)` | `oklch(0.95 0.005 95)` | teks utama |
| `--card` | `oklch(0.995 0.001 240)` | `oklch(0.3 0.018 250)` | permukaan kartu (putih) |
| `--primary` | `oklch(0.28 0.02 255)` charcoal | `oklch(0.92 0.005 250)` terang | **aksen hitam** (tombol, chip terpilih, nav aktif) |
| `--primary-foreground` | `oklch(0.99 0.002 240)` | `oklch(0.24 0.02 255)` | teks di atas aksen |
| `--info` | `oklch(0.55 0.2 260)` biru | `oklch(0.7 0.16 260)` | **harga/uang** (aksen tipis) |
| `--hero` | `oklch(0.26 0.02 255)` charcoal | `oklch(0.26 0.02 255)` (sama) | header gelap (Home/summary) |
| `--secondary` / `--muted` | abu netral, C rendah | charcoal terang | chip/isi lembut |
| `--muted-foreground` | `oklch(0.5 0.012 250)` | `oklch(0.7 0.015 250)` | teks sekunder |
| `--accent` | `oklch(0.94 0.004 250)` netral | `oklch(0.36 0.02 250)` | hover/highlight |
| `--success` | `oklch(0.6 0.13 145)` | `oklch(0.68 0.13 145)` | **pemasukan / sukses** |
| `--warning` | `oklch(0.75 0.15 75)` | `oklch(0.78 0.14 75)` | **belum bayar / perhatian** |
| `--destructive` | `oklch(0.58 0.2 27)` | `oklch(0.62 0.19 27)` | **pengeluaran / hapus** |
| `--border` / `--input` | `oklch(0.9 0.003 240)` | `oklch(1 0 0 / 12%)` | garis & field |
| `--ring` | = `--primary` | = `--primary` | fokus |

**Catatan monokrom:** di dark mode `--primary` justru **terang** (tombol putih di
atas gelap) — ini disengaja. `--hero` tetap charcoal di kedua tema supaya header
gelap tidak berubah jadi putih saat dark mode.

Default app = **terang**; dark mode di-toggle via class `.dark` di
`document.documentElement` (setelan tema yang sudah ada).

## 2. Radius & spacing

- `--radius: 1rem` (dinaikkan dari `0.75rem` → sudut lebih lembut). Skala Tailwind
  turunannya: `rounded-sm/md/lg/xl` mengikuti `--radius`.
- Kartu: `rounded-2xl`. Chip ikon: `rounded-xl`. Pill/segment: `rounded-full`.
- Padding kartu standar `p-4`; jarak antar-elemen `gap-3`/`gap-4`.

## 3. Tipografi

- Font: stack sistem (di `@layer base` `index.css`) — tidak menambah web-font.
- Judul halaman: `text-lg font-bold`. Label seksi: `text-xs font-semibold
  uppercase tracking-wide text-muted-foreground`. Angka KPI: `text-2xl font-bold`.

## 4. Breakpoint & layout (responsif)

Satu-satunya breakpoint pemisah shell adalah **`md` (768px)**:

| Lebar | Navigasi | Konten |
|---|---|---|
| `< md` (HP) | `BottomNav` (5 tab) di bawah | kolom penuh |
| `md`+ (tablet/iPad/desktop) | `SideNav` kiri (`w-64`) | area fleksibel, grid multi-kolom |

Aturan:
- `SideNav` = `hidden md:flex`; `BottomNav` = `md:hidden`.
- Frame app **tidak lagi** di-cap `max-w-md` global; di `md`+ konten mengisi
  ruang di sebelah sidebar (boleh diberi `max-w` konten yang longgar + padding).
- Grid melebar bertahap: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (menu/produk).
- **POS** di `md`+ jadi **master-detail**: daftar produk kiri + cart menetap
  kanan (bukan bottom-sheet). Di HP tetap sheet.
- Overlay (`BottomSheet`, dialog, success POS) dipusatkan relatif viewport,
  bukan lagi mengikat lebar frame HP.

## 5. Warna semantik (WAJIB — stop hardcode)

Halaman **tidak boleh** memakai `emerald-*`/`rose-*`/`amber-*` langsung. Pakai:

| Makna | Token/utility | Contoh dipakai |
|---|---|---|
| Pemasukan / lunas / sukses | `text-success`, `bg-success`, Badge `variant="success"` | Cashflow debit, POS paid, sesi kasir |
| Pengeluaran / hapus / gagal | `text-destructive`, `bg-destructive` | Cashflow credit, tombol hapus |
| Belum bayar / perhatian | `text-warning`, Badge `variant="warning"` | status POS unpaid |
| Harga / uang (katalog) | `text-info` | harga produk di POS & daftar Produk |
| Aksen/brand & tautan aktif | `text-primary`, `bg-primary`, `bg-primary/10` | tombol, chip terpilih, menu aktif, ikon utama |
| Header hero gelap | `bg-hero text-hero-foreground` (+ gradient) | header Home, Cashflow, Transaksi, KPI Reports |
| Netral/sekunder | `text-muted-foreground`, `bg-muted`, `bg-secondary` | deskripsi, chip |

`Badge` sudah punya varian `success`/`warning`/`destructive`/`outline` — pakai itu.

## 6. Pola komponen

- **Kartu KPI**: `rounded-2xl bg-card border border-border p-4` — label kecil
  `text-muted-foreground`, angka `text-2xl font-bold`, aksen `text-primary`/
  `text-success`/`text-destructive` sesuai makna.
- **List-row**: baris `flex items-center gap-3 py-3 border-b border-border`,
  judul `font-medium`, nilai kanan berwarna semantik.
- **Chip ikon** (menu/aksi): kotak `size-11 rounded-xl bg-primary/10 text-primary`.
  Hindari palet pelangi; pakai aksen tema (boleh variasi tipis `bg-accent`).
- **Header halaman**: `AppHeader` (title/subtitle/back + slot `#actions`) untuk
  semua halaman kecuali Home (header toko) & LockPage (full-screen PIN).
- **Nav aktif**: `text-primary` + (di sidebar) `bg-primary/10 rounded-lg`.
- **Grafik (ApexCharts/Reports)**: seri penjualan pakai charcoal (`#3f4756`,
  atau `#a1a1aa` di dark), pemasukan `--success`, pengeluaran `--destructive`;
  tema chart ikut `.dark`.

## 7. Sumber nav bersama

Item navigasi didefinisikan sekali di `src/components/layout/navItems.ts` dan
dipakai oleh `BottomNav.vue` (5 utama) & `SideNav.vue` (lengkap). Menambah menu =
cukup ubah satu file itu.
