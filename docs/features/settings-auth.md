# Fitur: Akun & Setelan (Login lokal)

**Status:** 🟡 Sebagian (Phase 0/5) · **Route:** `/settings`, `/settings/lock`

## Sudah ada (Phase 0)
- Profil toko (nama, pemilik) — tampil di header & struk.
- **Logo toko** — upload lewat tabel `media` (PNG ≤256px), disimpan sebagai ref
  `media://<id>` di `settings.store_logo`. Tampil **live** di header Home & splash
  begitu diganti (berbagi cache `mediaStore` singleton).
- **Splash screen** — toggle **default OFF** (`settings.splash_enabled`) + pilih
  latar `brand`/`light`/`dark` (`settings.splash_bg`, default `brand`).
- **Toggle "Aktifkan Login"** — **default OFF** (tanpa login).
- Toggle mode gelap. Info device ID + versi.
- **Pembayaran QRIS** — upload gambar QRIS statis toko (decode via `jsqr`,
  disimpan sebagai payload EMV di `settings.qris_payload`) + toggle **QRIS Dinamis**
  (`settings.qris_dynamic`, default OFF, disabled sampai QRIS di-upload).
- Kartu **POS Pro** (placeholder, disabled).

## QRIS Dinamis
Merchant upload QRIS statis sekali. Saat pembayaran metode QRIS dengan mode
dinamis aktif, nominal tagihan disuntik ke payload lalu QR baru dirender di
PaymentDialog — pembeli scan dgn jumlah pas tanpa ketik manual.

Algoritma (`src/lib/qris.ts`, adaptasi verssache/qris-dinamis):
1. buang 4 char CRC lama (setelah tag `6304`),
2. ubah `010211` (statis) → `010212` (dinamis),
3. sisipkan tag `54<len><nominal>` sebelum tag negara `5802ID`,
4. hitung ulang CRC16-CCITT (init `0xFFFF`, poly `0x1021`) → 4 hex uppercase.

Menghapus QRIS statis otomatis mematikan mode dinamis. Nominal = INTEGER
rupiah bulat (tanpa desimal, konsisten dgn `sale.total`).

## Direncanakan (Phase 5)
- Set/ubah **PIN** (disimpan sebagai hash salted SHA-256, tak pernah plaintext).
- **LockPage** + router guard: jika `login_enabled=1` & app terkunci → `/settings/lock`.
- Auto-lock saat app kembali ke foreground (opsional).

## Data & Aturan
- Tabel `settings` (key-value): `login_enabled`, `pin_hash`, `store_name`,
  `store_owner`, `store_logo`, `splash_enabled`, `splash_bg`, `qris_payload`,
  `qris_dynamic`, `device_id`, `theme`.
- `device_id` dibuat sekali (prefix nomor struk).
- Login **tidak** memblokir apa pun saat default OFF.

## Kode
- `src/stores/settings.ts`, `src/stores/auth.ts` (Phase 5)
- `src/pages/settings/SettingsPage.vue`, `LockPage.vue` (Phase 5)
