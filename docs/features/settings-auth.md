# Fitur: Akun & Setelan (Login lokal)

**Status:** ✅ Selesai (Phase 0 + 5) · **Route:** `/settings`, `/lock`

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

## Login lokal / Kunci PIN (Phase 5)
- **Aktifkan Login** (default OFF): menyalakan toggle membuka sheet **Buat PIN**
  (6 digit, masukкан → konfirmasi). Login baru benar-benar aktif setelah PIN
  tersimpan. Mematikan toggle sekalian **membersihkan** `pin_hash`.
- **PIN** disimpan sebagai hash bergaram `"<saltHex>:<hashHex>"` (SHA-256 via
  Web Crypto) di `settings.pin_hash` — **tak pernah plaintext**. Salt 16 byte
  acak per-PIN (`crypto.getRandomValues`). Lihat `src/lib/crypto.ts`.
- **LockPage** (`/lock`) + router guard (`router.beforeEach`): saat
  `login_enabled=1` **dan** `pin_hash` terisi **dan** sesi belum dibuka →
  semua rute dialihkan ke `/lock` (menyimpan tujuan asli di `?redirect=`).
  PIN benar → buka kunci & kembali ke tujuan; PIN salah → shake + reset.
- **Ubah PIN** & **Kunci Sekarang** tersedia di bagian Keamanan saat login aktif.
- Status terkunci hidup di memori (`authStore.unlocked`) → **reload = terkunci
  lagi**. Tidak ada kaitan dengan sync/cloud (itu ranah `AuthProvider`).

## Data & Aturan
- Tabel `settings` (key-value): `login_enabled`, `pin_hash`, `store_name`,
  `store_owner`, `store_logo`, `splash_enabled`, `splash_bg`, `qris_payload`,
  `qris_dynamic`, `device_id`, `theme`.
- `device_id` dibuat sekali (prefix nomor struk).
- Login **tidak** memblokir apa pun saat default OFF.

## Kode
- `src/stores/settings.ts`, `src/stores/auth.ts`
- `src/lib/crypto.ts` — `makePinHash`/`verifyPin` (SHA-256 bergaram).
- `src/pages/settings/SettingsPage.vue`, `src/pages/settings/LockPage.vue`
- `src/components/common/PinPad.vue` — dots + keypad numerik (dipakai LockPage & sheet PIN).
- `src/router/index.ts` — route `/lock` + guard `beforeEach`.
