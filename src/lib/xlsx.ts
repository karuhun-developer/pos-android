import { saveOrShare, utf8ToBase64 } from './download'

/** Satu sheet = nama tab + baris objek (key kolom → nilai). */
export interface ExportSheet {
  name: string
  rows: Record<string, string | number>[]
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Bikin file `.xlsx` dari beberapa sheet lalu simpan/bagikan lewat
 * `saveOrShare` (native: share sheet, web: download).
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
  const base64 = write(wb, { type: 'base64', bookType: 'xlsx' }) as string
  await saveOrShare(filename, base64, XLSX_MIME)
}

/**
 * Bikin file `.csv` dari satu sheet. Diawali BOM UTF-8 supaya Excel (locale ID)
 * buka file-nya sebagai UTF-8, bukan ANSI — tanpa ini nama produk beraksen
 * berubah jadi mojibake.
 */
export async function exportCsv(filename: string, sheet: ExportSheet): Promise<void> {
  const { utils } = await import('xlsx')
  const ws = utils.json_to_sheet(sheet.rows)
  const csv = utils.sheet_to_csv(ws)
  const BOM = '\uFEFF'
  await saveOrShare(filename, utf8ToBase64(BOM + csv), 'text/csv;charset=utf-8')
}

/** Baris mentah hasil baca file — semua nilai string (lihat `raw: false`). */
export type RawRow = Record<string, string>

/**
 * Baca sheet pertama dari file `.csv`/`.xlsx`/`.xls` jadi array objek.
 *
 * Dua detail yang gak boleh diubah:
 * - CSV dibaca sebagai **teks**, bukan ArrayBuffer — lewat ArrayBuffer SheetJS
 *   nebak codepage 1252 dan nama beraksen jadi mojibake.
 * - `raw: false` → semua sel dikembalikan sebagai string. Tanpa ini barcode
 *   13 digit ke-parse jadi number dan keluar sebagai `8.99123e+12`.
 */
export async function readTabular(
  file: File | Blob,
  isCsv: boolean,
): Promise<RawRow[]> {
  const XLSX = await import('xlsx')
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })

  const first = wb.SheetNames[0]
  if (!first) return []
  const ws = wb.Sheets[first]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<RawRow>(ws, { raw: false, defval: '' })
}
