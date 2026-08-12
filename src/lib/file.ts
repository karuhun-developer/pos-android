import { Capacitor } from '@capacitor/core'

/**
 * Pilih file data (CSV/XLSX) lewat hidden `<input type="file">`.
 *
 * Kenapa bukan plugin native: WebView Capacitor sudah meng-handle
 * `onShowFileChooser`, jadi tap tombol ini tetap membuka picker sistem
 * (Files/Drive) di Android — nol dependency tambahan.
 *
 * Di native `accept` sengaja dibiarkan `* /*`: Android memetakan `accept`
 * ke MIME lewat MimeTypeMap, dan `.xlsx` sering gak kepetakan sehingga
 * filenya jadi abu-abu & gak bisa dipilih. Ekstensinya divalidasi di JS
 * setelah user milih, jadi filternya cuma pindah tempat, bukan hilang.
 *
 * Validasi ekstensi diserahkan ke pemanggil supaya "batal" bisa dibedakan dari
 * "salah format" — kalau disamakan, tap Batal bakal memunculkan pesan error.
 *
 * @param exts ekstensi yang diterima, huruf kecil, dengan titik (mis. `['.csv']`)
 * @returns file terpilih, atau null kalau dibatalkan
 */
export function pickDataFile(exts: string[]): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = Capacitor.isNativePlatform() ? '*/*' : exts.join(',')
    input.style.display = 'none'

    let settled = false
    const done = (v: File | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(v)
    }

    input.addEventListener('change', () => done(input.files?.[0] ?? null))
    // `cancel` didukung browser modern & WebView Android; kalau gak ada,
    // promise-nya menggantung sampai user milih (input keburu di-remove
    // saat komponennya unmount).
    input.addEventListener('cancel', () => done(null))

    document.body.appendChild(input)
    input.click()
  })
}

/** true kalau nama file berekstensi `.csv`. */
export function isCsvFile(name: string): boolean {
  return name.toLowerCase().endsWith('.csv')
}
