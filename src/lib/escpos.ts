import type { ReceiptJob } from '@/services/capabilities/registry'

/**
 * Encoder ESC/POS: ubah `ReceiptJob` (baris + align/bold/size) jadi byte mentah
 * yang dikirim ke printer thermal. Murni (tanpa I/O) → gampang diuji & dipakai
 * transport apa pun (Bluetooth/USB) tanpa tahu detail hardware.
 *
 * Referensi perintah: ESC @ (init), ESC a n (align), ESC E n (bold),
 * GS ! n (ukuran), LF (0x0A), GS V m (potong kertas).
 */
export interface EscposOpts {
  /** Baris kosong sebelum potong (biar teks lolos dari head). Default 3. */
  feed?: number
  /** Kirim perintah potong kertas di akhir. Default true (aman walau tanpa cutter). */
  cut?: boolean
}

export function encodeReceipt(job: ReceiptJob, opts: EscposOpts = {}): Uint8Array {
  const bytes: number[] = []
  const push = (...b: number[]) => {
    for (const x of b) bytes.push(x)
  }
  // Teks: printer thermal pakai charset 1-byte. Codepoint > 0xFF (emoji, dsb)
  // tak bisa dicetak → ganti '?'. ASCII & Latin-1 diteruskan apa adanya.
  const text = (s: string) => {
    for (const ch of s) {
      const c = ch.codePointAt(0) ?? 0x3f
      push(c > 0xff ? 0x3f : c)
    }
  }

  push(0x1b, 0x40) // ESC @ — inisialisasi

  // Lacak state agar tak kirim perintah berulang tiap baris.
  let curAlign = -1
  let curBold = -1
  let curSize = -1
  for (const line of job.lines) {
    const align = line.align === 'center' ? 1 : line.align === 'right' ? 2 : 0
    if (align !== curAlign) {
      push(0x1b, 0x61, align) // ESC a n
      curAlign = align
    }
    const bold = line.bold ? 1 : 0
    if (bold !== curBold) {
      push(0x1b, 0x45, bold) // ESC E n
      curBold = bold
    }
    // GS ! n — bit tinggi = tinggi ganda, bit rendah = lebar ganda. large = 0x11.
    const size = line.size === 'large' ? 0x11 : 0x00
    if (size !== curSize) {
      push(0x1d, 0x21, size) // GS ! n
      curSize = size
    }
    text(line.text ?? '')
    push(0x0a) // LF
  }

  // Reset gaya ke normal.
  push(0x1b, 0x61, 0x00) // align kiri
  push(0x1b, 0x45, 0x00) // bold off
  push(0x1d, 0x21, 0x00) // ukuran normal

  const feed = opts.feed ?? 3
  for (let i = 0; i < feed; i++) push(0x0a)
  if (opts.cut ?? true) push(0x1d, 0x56, 0x01) // GS V 1 — potong sebagian

  return Uint8Array.from(bytes)
}
