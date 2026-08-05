#!/usr/bin/env bash
#
# Buka project Android (Capacitor) di Android Studio Windows — dari WSL.
# Build web + sync dulu supaya perubahan kode ikut, lalu launch Studio ke
# folder `android/` lewat path UNC (\\wsl.localhost\...) yang dikenali Windows.
#
# Pakai:  npm run android:open      (lihat package.json)  atau  bash scripts/open-android.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STUDIO="/mnt/c/Program Files/Android/Android Studio/bin/studio64.exe"
if [[ ! -f "$STUDIO" ]]; then
  echo "✗ Android Studio tidak ketemu di: $STUDIO" >&2
  echo "  Set variabel STUDIO di script ini kalau lokasinya beda." >&2
  exit 1
fi

echo "→ Build web + sync ke android/ ..."
npm run build
npx cap sync android

WIN_ANDROID="$(wslpath -w "$ROOT/android")"
echo "→ Membuka Android Studio: $WIN_ANDROID"
# nohup + disown supaya Studio jalan mandiri, terminal WSL bebas lagi.
nohup "$STUDIO" "$WIN_ANDROID" >/dev/null 2>&1 &
disown
echo "✔ Android Studio sedang dibuka. Tunggu Gradle sync selesai, colok HP, lalu Run ▶."
