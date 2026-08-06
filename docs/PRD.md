# PRD — POS Kacaw

**Versi dokumen:** 0.1 · **Status:** aktif · **App id:** `com.karuhundeveloper.poskacaw`

## 1. Ringkasan

POS Kacaw adalah aplikasi **Point of Sale offline-first** untuk warung/UMKM. Semua
fitur inti (kelola produk, transaksi, kasir, cashflow) jalan **100% tanpa internet**.
Data disimpan lokal di SQLite pada perangkat. Arsitektur disiapkan agar bisa
**upgrade ke "POS Pro"** (cloud): login online, sinkronisasi dua arah, dan plugin
tambahan (mis. printer thermal) — tanpa menulis ulang aplikasi.

## 2. Masalah & Tujuan

| Masalah | Tujuan |
| --- | --- |
| Aplikasi kasir sering butuh koneksi & mahal | Gratis dipakai, jalan penuh offline |
| Pemilik UMKM tidak paham pembukuan | Cashflow sederhana debit/kredit per kategori |
| Data kasir terkunci di 1 device | Skema sync-ready sejak awal → bisa multi-device saat POS Pro aktif |
| Hardware bervariasi (printer dll) | Sistem plugin/capability yang bisa dipasang belakangan |

**Success criteria (v1):** pemilik bisa buat produk, jual, lihat pemasukan &
pengeluaran, tutup kasir harian — semuanya offline, data tidak hilang saat app ditutup.

## 3. Persona

- **Pemilik/Kasir tunggal** — warung kecil, 1 HP Android, tanpa staf IT. Butuh cepat & simpel.
- **(Future) Pemilik multi-outlet** — mau lihat data gabungan dari cloud (POS Pro).

## 4. Scope Fitur

| Fitur | Deskripsi | Phase |
| --- | --- | --- |
| Home launcher | Grid menu + profil toko + banner POS Pro | 0 |
| Manajemen produk | CRUD produk, kategori, harga, stok opsional | 1 |
| Point of Sale | Cart, checkout, auto-catat pemasukan | 2 |
| Transaksi | Riwayat penjualan + detail struk | 2 |
| Buka/Tutup kasir | Sesi kasir: modal awal, hitung akhir, selisih | 3 |
| Cashflow ledger | Debit/kredit per kategori, entri manual (gaji dll) | 4 |
| Akun & setelan | Toggle login (default OFF), PIN, profil toko, tema | 5 |
| Sync POS Pro | Login online/Google + sync REST/JWT (interface siap) | 6 |
| Plugin printer | Printer thermal via capability registry | 6/7 |
| Laporan/analitik | KPI hari ini + grafik tren (ApexCharts) + export Excel | 7+ |

## 5. Non-Goals (v1)

- Multi-user role & permission kompleks.
- Pembayaran non-tunai terintegrasi (QRIS gateway) — menyusul.
- Enkripsi DB at-rest (v1 `no-encryption`; keamanan = PIN app-level).

## 6. Prinsip Teknis (ringkas)

1. **Offline-first** — DB lokal SQLite adalah sumber kebenaran.
2. **Sync-ready sejak hari 1** — tiap tabel punya `id (uuid)`, `updated_at`,
   `deleted_at`, `dirty`; tiap perubahan tercatat di `outbox` pada transaksi yang sama.
3. **Uang = INTEGER** (rupiah bulat), tanpa float.
4. **Core tidak tergantung hardware** — kemampuan opsional lewat capability registry.

Lihat `architecture.md` untuk detail teknis.
