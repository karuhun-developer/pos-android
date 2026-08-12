/**
 * Gerbang anti-scan-dobel. Kamera baca ~10 frame/detik, jadi satu barcode yang
 * nempel di depan lensa bakal kebaca puluhan kali — tanpa gerbang ini satu
 * produk langsung nambah 20 qty.
 *
 * Dua aturan:
 * - `sameCodeMs`: kode yang SAMA ditolak selama jeda ini (kasir sengaja scan
 *   dua kali buat qty 2 tinggal tunggu sebentar).
 * - `anyCodeMs`: kode APAPUN ditolak sesaat setelah accept terakhir, biar dua
 *   barcode yang bersebelahan di rak gak keduanya masuk sekaligus.
 */
export interface ScanGate {
  accept(code: string): boolean
  reset(): void
}

export function createScanGate(
  opts: { sameCodeMs?: number; anyCodeMs?: number } = {},
): ScanGate {
  const sameCodeMs = opts.sameCodeMs ?? 1500
  const anyCodeMs = opts.anyCodeMs ?? 400

  let lastCode: string | null = null
  let lastCodeAt = 0
  let lastAcceptAt = 0

  return {
    accept(code: string): boolean {
      const now = Date.now()
      if (now - lastAcceptAt < anyCodeMs) return false
      if (code === lastCode && now - lastCodeAt < sameCodeMs) return false
      lastCode = code
      lastCodeAt = now
      lastAcceptAt = now
      return true
    },
    reset() {
      lastCode = null
      lastCodeAt = 0
      lastAcceptAt = 0
    },
  }
}

let audioCtx: AudioContext | null = null

/** Bip pendek + getar sebagai konfirmasi scan. Tanpa file aset. */
export function scanFeedback(ok = true): void {
  try {
    navigator.vibrate?.(ok ? 40 : [30, 60, 30])
  } catch {
    /* device tanpa vibrator — abaikan */
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    audioCtx ??= new Ctor()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = ok ? 1760 : 320
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
  } catch {
    /* autoplay policy belum unlock — cuma bip yang hilang, scan tetap jalan */
  }
}
