/**
 * QRIS statis → dinamis.
 *
 * Merchant upload QRIS statis (nominal diisi manual pembeli). Fitur ini nyuntik
 * nominal tagihan ke payload EMV-nya lalu bikin QR baru, jadi pembeli scan
 * langsung dengan jumlah pas — gak salah ketik nominal.
 *
 * Algoritma diadaptasi dari verssache/qris-dinamis:
 *   1. Buang 4 char CRC terakhir (setelah tag "6304").
 *   2. Ubah tag "010211" (statis) → "010212" (dinamis).
 *   3. Sisipkan tag "54" + panjang + nominal SEBELUM "5802ID".
 *   4. Hitung ulang CRC16-CCITT (0xFFFF, poly 0x1021) → 4 hex uppercase.
 */

import jsQR from 'jsqr'
import QRCode from 'qrcode'

/** CRC16-CCITT (FALSE) — dipakai QRIS untuk tag 63. */
export function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  const hex = (crc & 0xffff).toString(16).toUpperCase()
  return hex.padStart(4, '0')
}

/** Validasi kasar: payload QRIS EMV diawali "00020101" dan punya tag negara. */
export function isValidQris(payload: string): boolean {
  const p = payload.trim()
  return /^0002010/.test(p) && p.includes('5802ID') && p.length > 40
}

/**
 * Bangun payload QRIS dinamis dengan nominal (minor units rupiah = angka bulat).
 * `payload` = string QRIS statis hasil decode. Lempar error kalau bukan QRIS valid.
 */
export function makeDynamicPayload(payload: string, amount: number): string {
  const src = payload.trim()
  if (!isValidQris(src)) throw new Error('QRIS statis tidak valid')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal tidak valid')

  // 1. buang CRC lama (4 char terakhir).
  const withoutCrc = src.slice(0, -4)
  // 2. statis → dinamis.
  const dynamic = withoutCrc.replace('010211', '010212')
  // 3. sisipkan nominal sebelum tag negara "5802ID".
  const nominal = String(Math.round(amount))
  const amountTag = `54${String(nominal.length).padStart(2, '0')}${nominal}`
  const [head, tail] = dynamic.split('5802ID')
  const body = `${head}${amountTag}5802ID${tail}`
  // 4. CRC16 baru atas body (yang diakhiri "6304").
  return body + crc16(body)
}

/** Decode gambar QR (data URL) → string payload. Null kalau gagal baca. */
export async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(data, width, height)
  return result?.data ?? null
}

/** Render payload → data URL PNG QR (buat ditampilkan/di-scan). */
export function encodeQrToDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = src
  })
}
