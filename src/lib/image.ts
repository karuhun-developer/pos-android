import { Capacitor } from '@capacitor/core'

/** Hasil gambar yang siap disimpan ke tabel `media`. */
export interface ProcessedImage {
  data: string // base64 (tanpa prefix data:)
  mime: string
  width: number
  height: number
  bytes: number // perkiraan ukuran biner
}

/**
 * Pilih gambar lintas-platform.
 * - Native (Android): `@capacitor/camera` (kamera / galeri lewat prompt).
 * - Web: hidden `<input type="file">` — nol dependency tambahan.
 * Balikin data URL (`data:<mime>;base64,…`) atau null kalau dibatalkan.
 */
export async function pickImage(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { Camera, CameraResultType, CameraSource } = await import(
      '@capacitor/camera'
    )
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      })
      return photo.dataUrl ?? null
    } catch {
      // user batal / tolak izin
      return null
    }
  }
  return pickImageWeb()
}

function pickImageWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    let settled = false
    const done = (v: string | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(v)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return done(null)
      const reader = new FileReader()
      reader.onload = () => done(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => done(null)
      reader.readAsDataURL(file)
    })
    // Kalau dialog ditutup tanpa milih, `change` gak kepanggil — biarin promise
    // menggantung sampai pilihan berikutnya; input tetap di DOM (hidden).
    document.body.appendChild(input)
    input.click()
  })
}

export interface DownscaleOptions {
  maxDim?: number
  quality?: number
  /** Output mime — pakai 'image/png' buat logo agar transparansi kejaga. */
  mime?: 'image/jpeg' | 'image/png'
}

/**
 * Downscale + kompres lewat <canvas>. Jaga aspect ratio, sisi terpanjang ≤ maxDim.
 * Default JPEG (foto produk). Untuk logo pakai `mime: 'image/png'` (transparan).
 * Output base64 tanpa prefix.
 */
export function downscale(
  dataUrl: string,
  opts: DownscaleOptions = {},
): Promise<ProcessedImage> {
  const { maxDim = 512, quality = 0.7, mime = 'image/jpeg' } = opts
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width: w, height: h } = img
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const outW = Math.max(1, Math.round(w * scale))
      const outH = Math.max(1, Math.round(h * scale))

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas 2d context tidak tersedia'))
      ctx.drawImage(img, 0, 0, outW, outH)

      const out = canvas.toDataURL(mime, quality)
      const data = stripDataUrlPrefix(out)
      resolve({
        data,
        mime,
        width: outW,
        height: outH,
        bytes: estimateBase64Bytes(data),
      })
    }
    img.onerror = () => reject(new Error('gagal memuat gambar'))
    img.src = dataUrl
  })
}

/** SHA-256 hex dari string base64 — buat dedup & deteksi perubahan. */
export async function sha256Hex(base64: string): Promise<string> {
  const bytes = new TextEncoder().encode(base64)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Susun data URL dari row media buat dipajang di <img>. */
export function toDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`
}

function stripDataUrlPrefix(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

function estimateBase64Bytes(base64: string): number {
  const pad = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - pad)
}
