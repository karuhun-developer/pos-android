import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Satu sheet = nama tab + baris objek (key kolom → nilai). */
export interface ExportSheet {
  name: string
  rows: Record<string, string | number>[]
}

/**
 * Bikin file `.xlsx` dari beberapa sheet lalu simpan/bagikan:
 * - **Native (Android):** tulis ke cache lalu buka share sheet (WA, Drive, email…).
 * - **Web:** trigger download `<a download>`.
 *
 * Nama sheet Excel dibatasi 31 char → dipotong otomatis.
 */
export async function exportXlsx(filename: string, sheets: ExportSheet[]): Promise<void> {
  // Lazy-load SheetJS: cuma ke-download saat benar-benar export (bukan saat buka halaman).
  const { utils, write } = await import('xlsx')
  const wb = utils.book_new()
  for (const s of sheets) {
    const ws = utils.json_to_sheet(s.rows)
    utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }

  if (Capacitor.isNativePlatform()) {
    const base64 = write(wb, { type: 'base64', bookType: 'xlsx' }) as string
    const res = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Bagikan / simpan export' })
  } else {
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}
