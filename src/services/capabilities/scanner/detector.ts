import type { ScanResult } from '../registry'

/**
 * Pemilihan engine decode barcode, dua tingkat:
 *
 * 1. **`BarcodeDetector` bawaan platform** — ini jalur Android WebView
 *    (Chromium + Play Services, mesinnya ML Kit juga). Nol tambahan bundle,
 *    tercepat, dan `detect()` bisa langsung dikasih elemen `<video>`.
 * 2. **`@zxing/browser` (JS murni)** — fallback buat Chrome/Firefox desktop
 *    waktu `npm run dev` dan WebView lama.
 *
 * Sengaja TIDAK pakai ponyfill berbasis wasm: default-nya narik `.wasm` dari
 * CDN, dan app ini offline-first.
 */

/** Format yang dipedulikan kasir retail. */
const WEB_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
  'qr_code',
] as const

export type DecodeSource = HTMLVideoElement | HTMLCanvasElement

export interface Detector {
  readonly engine: 'native' | 'zxing'
  detect(source: DecodeSource): Promise<ScanResult[]>
  /** True kalau engine mau di-feed canvas ROI, bukan elemen video langsung. */
  readonly wantsCanvas: boolean
  close(): void
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>
}

interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

function nativeCtor(): BarcodeDetectorCtor | null {
  const g = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return g.BarcodeDetector ?? null
}

async function tryNative(): Promise<Detector | null> {
  const Ctor = nativeCtor()
  if (!Ctor) return null
  let supported: string[] = []
  try {
    supported = await Ctor.getSupportedFormats()
  } catch {
    return null
  }
  // Beberapa WebView expose class-nya tapi balikin daftar kosong = tidak berguna.
  const formats = WEB_FORMATS.filter((f) => supported.includes(f))
  if (!formats.length) return null

  const det = new Ctor({ formats })
  return {
    engine: 'native',
    wantsCanvas: false,
    async detect(source) {
      const found = await det.detect(source)
      return found.map((b) => ({ value: b.rawValue, format: b.format }))
    },
    close() {},
  }
}

async function zxing(): Promise<Detector> {
  const [{ BrowserMultiFormatReader }, zx] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])

  const hints = new Map()
  hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
    zx.BarcodeFormat.EAN_13,
    zx.BarcodeFormat.EAN_8,
    zx.BarcodeFormat.UPC_A,
    zx.BarcodeFormat.UPC_E,
    zx.BarcodeFormat.CODE_128,
    zx.BarcodeFormat.CODE_39,
    zx.BarcodeFormat.ITF,
    zx.BarcodeFormat.CODABAR,
    zx.BarcodeFormat.QR_CODE,
  ])
  hints.set(zx.DecodeHintType.TRY_HARDER, true)

  const reader = new BrowserMultiFormatReader(hints)

  return {
    engine: 'zxing',
    wantsCanvas: true,
    async detect(source) {
      try {
        // decodeFromCanvas lempar NotFoundException tiap frame kosong — normal.
        const res = reader.decodeFromCanvas(source as HTMLCanvasElement)
        return [{ value: res.getText(), format: zx.BarcodeFormat[res.getBarcodeFormat()] }]
      } catch {
        return []
      }
    },
    close() {},
  }
}

let cached: Promise<Detector> | null = null

export function getDetector(): Promise<Detector> {
  cached ??= tryNative().then((d) => d ?? zxing())
  return cached
}
