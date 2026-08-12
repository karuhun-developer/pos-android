import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** base64 (tanpa prefix `data:`) → Blob, buat jalur download di web. */
function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Simpan/bagikan satu file ke user:
 * - **Native (Android):** tulis ke cache lalu buka share sheet (WA, Drive, email…).
 * - **Web:** trigger download `<a download>`.
 *
 * Satu-satunya tempat yang tahu soal Filesystem/Share — dipakai export xlsx,
 * export csv, dan simpan gambar barcode.
 */
export async function saveOrShare(
  filename: string,
  base64: string,
  mime: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Bagikan / simpan file' })
    return
  }

  const url = URL.createObjectURL(base64ToBlob(base64, mime))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** `data:image/png;base64,AAA…` → base64 mentah. */
export function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

/** UTF-8 string → base64 (aman buat karakter non-ASCII di CSV). */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
