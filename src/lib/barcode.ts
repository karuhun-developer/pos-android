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

/** Atribut yang di-set `SVGRenderer.setSvgAttributes()`. Kalau gak ikut dibuang,
 *  `<svg>` yang gagal render tetap punya ukuran & viewBox gambar sebelumnya. */
const JSBARCODE_SVG_ATTRS = ['width', 'height', 'x', 'y', 'viewBox', 'xmlns', 'version']

/**
 * Kosongkan `<svg>` total — JANGAN pernah percaya JsBarcode buat ini.
 *
 * Untuk input tak sah, `ErrorHandler.handleCatch()` memanggil `valid(false)`
 * lalu mengganti `api.render` jadi no-op. Akibatnya `SVGRenderer.prepareSVG()`
 * — satu-satunya tempat yang menghapus anak `<svg>` — gak pernah jalan, dan
 * gambar lama nyangkut alih-alih hilang.
 */
function clearSvg(el: SVGElement): void {
  while (el.firstChild) el.removeChild(el.firstChild)
  for (const a of JSBARCODE_SVG_ATTRS) el.removeAttribute(a)
}

/**
 * Baca balik angka yang BENAR-BENAR digambar dari `<text>` hasil render.
 *
 * EAN-13 memecah teksnya jadi tiga `<text>` (digit pertama + 6 kiri + 6 kanan),
 * dan teks guard bar diisi string kosong — jadi menggabung semuanya berurutan
 * persis sama dengan yang kebaca mata.
 */
function readSvgText(el: SVGElement): string {
  return Array.from(el.querySelectorAll('text'))
    .map((t) => t.textContent ?? '')
    .join('')
}

/** Rumus check digit EAN/UPC/ITF: bobot selang-seling, lalu `(10 - sum%10) % 10`.
 *  Sengaja disalin dari encoder JsBarcode supaya form bisa kasih tahu user tanpa
 *  harus narik chunk JsBarcode-nya duluan. */
function checkDigit(digits: string, firstWeight: 1 | 3): string {
  const sum = digits
    .split('')
    .reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? firstWeight : 4 - firstWeight), 0)
  return String((10 - (sum % 10)) % 10)
}

/**
 * Nilai yang bakal tergambar untuk `value`. EAN/UPC/ITF menambah check digit
 * sendiri kalau input-nya kurang satu digit — jadi angka di bawah barcode BISA
 * beda dari yang tersimpan, dan itu memang by design, bukan bug.
 */
export function effectiveBarcodeValue(value: string, type: string): string {
  const v = value.trim()
  switch (normalizeBarcodeType(type)) {
    case 'EAN13':
      return /^\d{12}$/.test(v) ? v + checkDigit(v, 1) : v
    case 'EAN8':
      return /^\d{7}$/.test(v) ? v + checkDigit(v, 3) : v
    case 'UPC':
      return /^\d{11}$/.test(v) ? v + checkDigit(v, 3) : v
    // ITF14.js nulis rumusnya `Math.ceil(res/10)*10 - res` — beda cuma pas
    // `res` kelipatan 10: dia balik 10 (jadi 15 digit → malah gak sah), kita
    // balik 0. Gak jadi soal: hasilnya cuma dipakai kalau barcode-nya sah.
    case 'ITF14':
      return /^\d{13}$/.test(v) ? v + checkDigit(v, 3) : v
    default:
      return v
  }
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

export interface RenderResult {
  /** `false` = nilai gak sah untuk simbologinya. `<svg>` dijamin sudah kosong. */
  ok: boolean
  /** Angka yang benar-benar tergambar (check digit otomatis sudah termasuk).
   *  String kosong kalau `ok === false`. */
  rendered: string
}

/** Render ke elemen `<svg>` yang sudah ada di DOM. Elemennya SELALU dikosongkan
 *  dulu — lihat `clearSvg()` soal kenapa ini gak boleh diserahkan ke JsBarcode. */
export async function renderBarcodeSvg(
  el: SVGElement,
  value: string,
  type: string,
  opts: RenderOptions = {},
): Promise<RenderResult> {
  // Bersihkan SEBELUM await: begitu barcode berubah, gambar lama harus langsung
  // hilang walau chunk JsBarcode-nya masih diunduh.
  clearSvg(el)
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
  if (!ok) {
    clearSvg(el) // jaga-jaga kalau render sempat nulis sebagian
    return { ok: false, rendered: '' }
  }
  return { ok: true, rendered: readSvgText(el) }
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
