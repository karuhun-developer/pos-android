/**
 * Satu-satunya modul yang tahu soal JsBarcode. Semua render & validasi barcode
 * lewat sini, jadi ganti library nanti cuma nyentuh satu file.
 *
 * JsBarcode di-lazy-import (pola sama dengan `lib/xlsx.ts`) supaya ~30 KB-nya
 * gak ikut chunk awal — halaman produk baru narik pas dibutuhkan.
 */

export interface BarcodeTypeDef {
  /** Nilai yang disimpan di kolom `products.barcode_type` (= format JsBarcode). */
  value: string
  label: string
  /** Petunjuk singkat buat pesan validasi di form. */
  hint: string
}

/** Set kurasi buat retail — bukan semua format yang didukung JsBarcode.
 *  EAN-13 ditaruh pertama karena itu standar barcode produk ritel Indonesia. */
export const BARCODE_TYPES: BarcodeTypeDef[] = [
  { value: 'EAN13', label: 'EAN-13 (standar ritel)', hint: '13 digit angka' },
  { value: 'CODE128', label: 'CODE128 (bebas)', hint: 'huruf & angka, panjang bebas' },
  { value: 'EAN8', label: 'EAN-8', hint: '8 digit angka' },
  { value: 'UPC', label: 'UPC-A', hint: '12 digit angka' },
  { value: 'CODE39', label: 'CODE39', hint: 'huruf kapital, angka, - . $ / + %' },
  { value: 'ITF14', label: 'ITF-14', hint: '14 digit angka' },
]

export const DEFAULT_BARCODE_TYPE = 'EAN13'

const VALID_TYPES = new Set(BARCODE_TYPES.map((t) => t.value))

/** Normalisasi nilai dari file import / data lama → selalu tipe yang dikenal. */
export function normalizeBarcodeType(raw: unknown): string {
  const v = String(raw ?? '').trim().toUpperCase().replace(/[\s_-]/g, '')
  if (VALID_TYPES.has(v)) return v
  // Alias yang sering diketik orang.
  if (v === 'UPCA') return 'UPC'
  if (v === 'EAN' || v === 'EAN13') return 'EAN13'
  if (v === 'ITF' || v === 'ITF14') return 'ITF14'
  if (v === 'CODE128A' || v === 'CODE128B' || v === 'CODE128C') return 'CODE128'
  return DEFAULT_BARCODE_TYPE
}

export function barcodeTypeLabel(type: string): string {
  return BARCODE_TYPES.find((t) => t.value === type)?.label ?? type
}

export function barcodeTypeHint(type: string): string {
  return BARCODE_TYPES.find((t) => t.value === type)?.hint ?? ''
}

type JsBarcodeFn = (
  el: unknown,
  value: string,
  options: Record<string, unknown>,
) => void

let jsBarcodePromise: Promise<JsBarcodeFn> | null = null

async function loadJsBarcode(): Promise<JsBarcodeFn> {
  jsBarcodePromise ??= import('jsbarcode').then(
    (m) => (m.default ?? m) as unknown as JsBarcodeFn,
  )
  return jsBarcodePromise
}

function newSvg(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg')
}

/**
 * Cek apakah `value` sah untuk simbologi `type`.
 *
 * Wajib lewat callback `valid` — tanpa itu JsBarcode **melempar** untuk input
 * yang gak sah (dan check digit EAN/UPC cuma dia yang tahu). try/catch tetap
 * dipasang buat jaga-jaga.
 */
export async function isValidBarcode(value: string, type: string): Promise<boolean> {
  const v = value.trim()
  if (!v) return false
  const JsBarcode = await loadJsBarcode()
  let ok = false
  try {
    JsBarcode(newSvg(), v, {
      format: normalizeBarcodeType(type),
      valid: (isValid: boolean) => {
        ok = isValid
      },
    })
  } catch {
    ok = false
  }
  return ok
}

/** Tipe pertama yang cocok buat `value` — dipakai import & prefill hasil scan. */
export async function guessBarcodeType(value: string): Promise<string> {
  const v = value.trim()
  if (!v) return DEFAULT_BARCODE_TYPE
  // Urutan sengaja: yang paling spesifik (panjang tetap) dicoba duluan,
  // CODE128 terakhir karena hampir apa pun valid untuk dia.
  for (const t of ['EAN13', 'UPC', 'EAN8', 'ITF14', 'CODE39', 'CODE128']) {
    if (await isValidBarcode(v, t)) return t
  }
  return DEFAULT_BARCODE_TYPE
}

export interface RenderOptions {
  width?: number
  height?: number
  fontSize?: number
  displayValue?: boolean
  margin?: number
  background?: string
  lineColor?: string
}

const RENDER_DEFAULTS: RenderOptions = {
  width: 2,
  height: 80,
  fontSize: 16,
  displayValue: true,
  margin: 10,
  background: '#ffffff',
  lineColor: '#000000',
}

/** Render ke elemen `<svg>` yang sudah ada di DOM. `false` = barcode gak valid. */
export async function renderBarcodeSvg(
  el: SVGElement,
  value: string,
  type: string,
  opts: RenderOptions = {},
): Promise<boolean> {
  const JsBarcode = await loadJsBarcode()
  let ok = false
  try {
    JsBarcode(el, value.trim(), {
      ...RENDER_DEFAULTS,
      ...opts,
      format: normalizeBarcodeType(type),
      valid: (isValid: boolean) => {
        ok = isValid
      },
    })
  } catch {
    ok = false
  }
  return ok
}

/** Render ke canvas lepas → PNG data URL. Dipakai tombol bagikan/simpan gambar. */
export async function barcodeToPngDataUrl(
  value: string,
  type: string,
  opts: RenderOptions = {},
): Promise<string | null> {
  const JsBarcode = await loadJsBarcode()
  const canvas = document.createElement('canvas')
  let ok = false
  try {
    JsBarcode(canvas, value.trim(), {
      ...RENDER_DEFAULTS,
      width: 3,
      height: 120,
      ...opts,
      format: normalizeBarcodeType(type),
      valid: (isValid: boolean) => {
        ok = isValid
      },
    })
  } catch {
    return null
  }
  return ok ? canvas.toDataURL('image/png') : null
}
