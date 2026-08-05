# Fitur: Google Sign-In (native Android)

**Status:** ✅ Kode siap · butuh registrasi OAuth di Google Cloud Console ·
**Route:** `/connect` (tab Masuk) · **Platform:** Android only (web pakai email/password)

## Tujuan
Login Google di Android di-handle **native** (Google Sign-In Android SDK, bukan
web redirect) lewat `@capgo/capacitor-social-login`. Plugin mengembalikan
**ID token** yang diverifikasi server (`POST /auth/google { id_token }`) → server
terbitkan Sanctum bearer token. Web tetap pakai email/password (Google native
tidak tersedia di WebView dev).

## Cara kerja
1. `SocialLogin.initialize({ google: { webClientId } })` — `webClientId` = **Web
   application** OAuth Client ID (dipakai sebagai `server_client_id` supaya
   `id_token.aud` cocok dengan yang server verifikasi).
2. `SocialLogin.login({ provider: 'google' })` → buka picker akun Google native →
   balikin `result.idToken`.
3. FE kirim `id_token` ke server; server verifikasi `aud` = Web Client ID →
   `firstOrCreate` user → balas token + stores.

Kode: `src/services/auth/google.ts` (`signInWithGoogle` / `signOutGoogle`).
`mapGoogleError()` menerjemahkan error native jadi pesan actionable (mis.
DEVELOPER_ERROR = SHA-1 belum terdaftar, code 10, cancel, network).

## Setup Google Cloud Console (WAJIB sekali)
Google mencocokkan **package name + SHA-1** aplikasi Android. Tanpa ini login
gagal dengan `DEVELOPER_ERROR` (code 10).

1. **Buat 2 OAuth Client ID** di Google Cloud Console → *APIs & Services →
   Credentials*:
   - **Web application** → salin Client ID-nya ke `.env` →
     `VITE_GOOGLE_CLIENT_ID=<web-client-id>`. Ini yang dipakai FE **dan** server
     sebagai `server_client_id`.
   - **Android** → isi:
     - **Package name:** `com.karuhundeveloper.poskacaw`
     - **SHA-1 (debug):** `55:E5:0E:C5:98:06:46:69:35:9B:9D:F7:94:97:EE:88:A3:B4:7E:9C`
   > Client ID Android **tidak** dimasukkan ke kode — cukup terdaftar di GCP agar
   > Google mengenali aplikasi. Yang dipakai di app tetap **Web** Client ID.
2. **OAuth consent screen** diisi (nama app, email support) + tambahkan akun
   penguji bila masih *Testing*.

## SHA-1 & keystore
- **Debug keystore di-commit** di `android/debug.keystore` (kredensial standar:
  storepass/keypass `android`, alias `androiddebugkey`) supaya **SHA-1 konsisten
  di semua mesin** (WSL, Windows, CI) — jadi cukup daftar SHA-1 sekali. Keystore
  debug bukan rahasia. Dipasang lewat `signingConfigs.debug` di
  `android/app/build.gradle`.
- **SHA-1 (debug):** `55:E5:0E:C5:98:06:46:69:35:9B:9D:F7:94:97:EE:88:A3:B4:7E:9C`
- **SHA-256:** `31:9F:FC:59:B1:B8:2D:77:CF:14:66:B4:D5:6F:ED:81:D3:62:B7:25:C7:81:F9:F4:DD:B8:83:69:E0:11:DC:C3`
- Cek ulang kapan pun:
  ```bash
  keytool -list -v -keystore android/debug.keystore \
    -alias androiddebugkey -storepass android -keypass android
  ```
- **Rilis nanti:** buat keystore release terpisah, daftarkan **SHA-1 release**-nya
  sebagai OAuth Client Android kedua (atau pakai Play App Signing → daftar SHA-1
  dari Play Console).

## Data & Aturan
- `.env` (gitignored) menyimpan `VITE_GOOGLE_CLIENT_ID` = **Web** Client ID.
  `.env.example` hanya berisi key kosong + catatan.
- Tidak ada rahasia di repo selain debug keystore (memang publik).
- Login Google hanya muncul di Android (`Capacitor.isNativePlatform()`); web
  menyembunyikannya.

## Kode
- `src/services/auth/google.ts` — init + login + map error.
- `src/services/api/config.ts` — `ENV_GOOGLE_CLIENT_ID`.
- `android/app/build.gradle` — `signingConfigs.debug` (storeFile `../debug.keystore`).
- `android/debug.keystore` — keystore debug bersama.
- `src/stores/account.ts` / `src/pages/settings/ConnectPage.vue` — pemanggil.
