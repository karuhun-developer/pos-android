# Fitur: Akun & Setelan (Login lokal)

**Status:** 🟡 Sebagian (Phase 0/5) · **Route:** `/settings`, `/settings/lock`

## Sudah ada (Phase 0)
- Profil toko (nama, pemilik) — tampil di header & struk.
- **Toggle "Aktifkan Login"** — **default OFF** (tanpa login).
- Toggle mode gelap. Info device ID + versi.
- Kartu **POS Pro** (placeholder, disabled).

## Direncanakan (Phase 5)
- Set/ubah **PIN** (disimpan sebagai hash salted SHA-256, tak pernah plaintext).
- **LockPage** + router guard: jika `login_enabled=1` & app terkunci → `/settings/lock`.
- Auto-lock saat app kembali ke foreground (opsional).

## Data & Aturan
- Tabel `settings` (key-value): `login_enabled`, `pin_hash`, `store_name`,
  `store_owner`, `device_id`, `theme`.
- `device_id` dibuat sekali (prefix nomor struk).
- Login **tidak** memblokir apa pun saat default OFF.

## Kode
- `src/stores/settings.ts`, `src/stores/auth.ts` (Phase 5)
- `src/pages/settings/SettingsPage.vue`, `LockPage.vue` (Phase 5)
