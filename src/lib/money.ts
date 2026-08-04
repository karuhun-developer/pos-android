/**
 * Money is stored as INTEGER minor units (rupiah bulat — no sen).
 * Untuk IDR, 1 unit = Rp 1. Kita tetap simpan sebagai integer supaya
 * konsisten & bebas floating point error di seluruh app.
 */

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const plain = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** 26000 -> "Rp 26.000" */
export function formatRupiah(amount: number): string {
  return idr.format(Math.round(amount || 0))
}

/** 26000 -> "26.000" (tanpa prefix Rp) */
export function formatNumber(amount: number): string {
  return plain.format(Math.round(amount || 0))
}

/** "Rp 26.000" / "26.000" / "26000" -> 26000 */
export function parseRupiah(input: string): number {
  if (!input) return 0
  const digits = input.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}
