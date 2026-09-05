import { saveOrShare, utf8ToBase64 } from './download'
import type { CellValue } from 'read-excel-file/browser'
import type { SheetData } from 'write-excel-file'

export interface ExportSheet {
  name: string
  rows: Record<string, string | number>[]
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRIES = 256
const MAX_ROWS = 10_000
const MAX_COLUMNS = 64
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const UNSUPPORTED_SPREADSHEET_MESSAGE = 'Berkas spreadsheet tidak valid atau tidak didukung.'

class UnsupportedSpreadsheetError extends Error {
  readonly name = 'UnsupportedSpreadsheetError'

  constructor() {
    super(UNSUPPORTED_SPREADSHEET_MESSAGE)
  }
}

function rejectSpreadsheet(): never {
  throw new UnsupportedSpreadsheetError()
}

function stringCell(value: CellValue<string> | null): string {
  if (value === null || value === Date) return ''
  return String(value)
}

function sheetHeaders(rows: ExportSheet['rows']): string[] {
  const headers: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }
  return headers
}

function tabularRows(sheet: ExportSheet): (string | number)[][] {
  const headers = sheetHeaders(sheet.rows)
  return [headers, ...sheet.rows.map((row) => headers.map((header) => row[header] ?? ''))]
}

function sheetData(sheet: ExportSheet): SheetData {
  return tabularRows(sheet).map((row) => row.map((value) => ({ value })))
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function exportXlsx(filename: string, sheets: ExportSheet[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file')
  const blob = await writeXlsxFile(sheets.map(sheetData), {
    sheets: sheets.map((sheet) => sheet.name.slice(0, 31)),
  })
  await saveOrShare(filename, await blobToBase64(blob), XLSX_MIME)
}

function csvCell(value: string | number): string {
  const text = /^[=+\-@]/.test(String(value).trimStart()) ? `'${value}` : String(value)
  return /[\",\r\n]/.test(text) ? `\"${text.replaceAll('\"', '\"\"')}\"` : text
}

export async function exportCsv(filename: string, sheet: ExportSheet): Promise<void> {
  const csv = tabularRows(sheet).map((row) => row.map(csvCell).join(',')).join('\r\n')
  await saveOrShare(filename, utf8ToBase64(`\uFEFF${csv}`), 'text/csv;charset=utf-8')
}

export type RawRow = Record<string, string>

function readUint16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) rejectSpreadsheet()
  return view.getUint16(offset, true)
}

function readUint32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) rejectSpreadsheet()
  return view.getUint32(offset, true)
}

function endOfCentralDirectory(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65_557); offset--) {
    if (readUint32(view, offset) === 0x06054b50 && offset + 22 + readUint16(view, offset + 20) === view.byteLength) {
      return offset
    }
  }
  return rejectSpreadsheet()
}

function zipEntryNames(bytes: Uint8Array): Set<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = endOfCentralDirectory(view)
  if (readUint16(view, end + 4) !== 0 || readUint16(view, end + 6) !== 0) rejectSpreadsheet()

  const count = readUint16(view, end + 10)
  const directorySize = readUint32(view, end + 12)
  const directoryOffset = readUint32(view, end + 16)
  if (!count || count > MAX_ZIP_ENTRIES || directoryOffset + directorySize > end) rejectSpreadsheet()

  const names = new Set<string>()
  let totalUncompressed = 0
  let offset = directoryOffset
  for (let index = 0; index < count; index++) {
    if (readUint32(view, offset) !== 0x02014b50) rejectSpreadsheet()
    const flags = readUint16(view, offset + 8)
    const compression = readUint16(view, offset + 10)
    const compressedSize = readUint32(view, offset + 20)
    const uncompressedSize = readUint32(view, offset + 24)
    const nameLength = readUint16(view, offset + 28)
    const extraLength = readUint16(view, offset + 30)
    const commentLength = readUint16(view, offset + 32)
    const localOffset = readUint32(view, offset + 42)
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength
    if (entryEnd > directoryOffset + directorySize || flags & 1 || (compression !== 0 && compression !== 8)) rejectSpreadsheet()

    const name = UTF8_DECODER.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || names.has(name)) rejectSpreadsheet()
    if (readUint32(view, localOffset) !== 0x04034b50) rejectSpreadsheet()
    const dataOffset = localOffset + 30 + readUint16(view, localOffset + 26) + readUint16(view, localOffset + 28)
    if (dataOffset + compressedSize > bytes.byteLength) rejectSpreadsheet()

    names.add(name)
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) rejectSpreadsheet()
    offset = entryEnd
  }
  if (offset !== directoryOffset + directorySize) rejectSpreadsheet()
  return names
}

function decodeXml(entries: Record<string, Uint8Array>, name: string): string {
  const content = entries[name]
  if (!content) rejectSpreadsheet()
  const xml = UTF8_DECODER.decode(content)
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) rejectSpreadsheet()
  return xml
}

async function preflightXlsx(bytes: Uint8Array): Promise<void> {
  const names = zipEntryNames(bytes)
  const required = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels']
  if (required.some((name) => !names.has(name)) || ![...names].some((name) => name.startsWith('xl/worksheets/') && name.endsWith('.xml'))) rejectSpreadsheet()
  if ([...names].some((name) => name.startsWith('xl/externalLinks/') || name.startsWith('xl/embeddings/') || /(?:^|\/)vbaProject(?:Signature)?\.bin$/i.test(name))) rejectSpreadsheet()

  const { unzipSync } = await import('fflate')
  const entries = unzipSync(bytes)
  const contentTypes = decodeXml(entries, '[Content_Types].xml')
  if (!/spreadsheetml\.sheet\.main\+xml/i.test(contentTypes) || /macroEnabled|vbaProject/i.test(contentTypes)) rejectSpreadsheet()

  for (const [name, content] of Object.entries(entries)) {
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue
    const xml = UTF8_DECODER.decode(content)
    if (/<!DOCTYPE|<!ENTITY|\bTargetMode\s*=\s*["']External["']/i.test(xml)) rejectSpreadsheet()
    if (name.startsWith('xl/worksheets/') && /<(?:[A-Za-z_][\w.-]*:)?f(?:\s|\/|>)/i.test(xml)) rejectSpreadsheet()
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let afterQuote = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          quoted = false
          afterQuote = true
        }
      } else {
        cell += character
      }
      continue
    }
    if (afterQuote && character !== ',' && character !== '\r' && character !== '\n') rejectSpreadsheet()
    if (character === '"') {
      if (cell) rejectSpreadsheet()
      quoted = true
      afterQuote = false
    } else if (character === ',') {
      row.push(cell)
      cell = ''
      afterQuote = false
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      afterQuote = false
    } else {
      cell += character
    }
  }
  if (quoted) rejectSpreadsheet()
  if (cell || row.length || afterQuote) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function recordsFromRows(rows: string[][]): RawRow[] {
  const [headers, ...data] = rows
  if (!headers?.length || headers.some((header) => !header.trim()) || new Set(headers).size !== headers.length) return []
  return data
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

function assertTableLimits(rows: string[][]): void {
  if (rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLUMNS)) rejectSpreadsheet()
}

async function readCsv(file: File | Blob): Promise<RawRow[]> {
  if (file.size > MAX_FILE_BYTES) rejectSpreadsheet()
  const text = UTF8_DECODER.decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  assertTableLimits(rows)
  if (rows.some((row) => row.some((cell) => /^[=+\-@]/.test(cell.trimStart())))) rejectSpreadsheet()
  return recordsFromRows(rows)
}

async function readXlsx(file: File | Blob): Promise<RawRow[]> {
  if (file.size > MAX_FILE_BYTES) rejectSpreadsheet()
  const buffer = await file.arrayBuffer()
  await preflightXlsx(new Uint8Array(buffer))
  const { readSheet } = await import('read-excel-file/browser')
  const rows = await readSheet<string>(buffer, 1, { parseNumber: (value) => value })
  const normalizedRows = rows.map((row) => row.map((cell) => stringCell(cell)))
  assertTableLimits(normalizedRows)
  return recordsFromRows(normalizedRows)
}

export async function readTabular(file: File | Blob, isCsv: boolean): Promise<RawRow[]> {
  try {
    return isCsv ? await readCsv(file) : await readXlsx(file)
  } catch (error) {
    if (error instanceof UnsupportedSpreadsheetError) throw error
    throw new UnsupportedSpreadsheetError()
  }
}
