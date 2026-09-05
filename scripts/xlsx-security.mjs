import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173'
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? await mkdtemp(join(tmpdir(), 'pos-kacaw-xlsx-security-'))
const PRODUCT_COLUMNS = ['nama', 'kategori', 'sku', 'barcode', 'tipe_barcode', 'harga_jual', 'harga_modal', 'lacak_stok', 'stok', 'aktif']
const REJECTED_PRODUCT_NAMES = ['Formula product', 'CSV formula product', 'Macro product', 'Linked product']
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function check(condition, message) {
  assert.equal(condition, true, message)
}

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}

function u16(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff)
}

function u32(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function concat(parts) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function zip(entries) {
  const files = entries.map(([name, content]) => ({ name: encoder.encode(name), content: encoder.encode(content) }))
  let offset = 0
  const local = []
  const central = []
  for (const file of files) {
    const crc = crc32(file.content)
    const header = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.content.length), u32(file.content.length), u16(file.name.length), u16(0), file.name, file.content])
    local.push(header)
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.content.length), u32(file.content.length), u16(file.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), file.name]))
    offset += header.length
  }
  const directory = concat(central)
  return concat([...local, directory, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)])
}

function xml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function column(index) {
  let result = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result
  return result
}

function cell(reference, value, formula) {
  if (formula) return '<c r="' + reference + '" t="str"><f>' + xml(formula) + '</f><v>' + xml(value) + '</v></c>'
  return '<c r="' + reference + '" t="inlineStr"><is><t>' + xml(String(value)) + '</t></is></c>'
}

function workbook({ rows, formula = false, macro = false, external = false }) {
  const rowXml = [PRODUCT_COLUMNS, ...rows].map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cell(column(columnIndex) + String(rowIndex + 1), value, formula && rowIndex === 1 && columnIndex === 0 ? 'CONCAT("unsafe", " formula")' : null)).join('')
    return '<row r="' + String(rowIndex + 1) + '">' + cells + '</row>'
  }).join('')
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Produk" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' + (external ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://example.invalid/book.xlsx" TargetMode="External"/>' : '') + '</Relationships>'],
    ['xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rowXml + '</sheetData></worksheet>'],
    ...(macro ? [['xl/vbaProject.bin', 'macro']] : []),
  ])
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function unzip(bytes) {
  let end = bytes.length - 22
  while (end >= 0 && readU32(bytes, end) !== 0x06054b50) end--
  check(end >= 0, 'Export archive is unreadable')
  const count = readU16(bytes, end + 10)
  let cursor = readU32(bytes, end + 16)
  const entries = new Map()
  for (let index = 0; index < count; index++) {
    check(readU32(bytes, cursor) === 0x02014b50, 'Export central directory is unreadable')
    const compression = readU16(bytes, cursor + 10)
    const compressedSize = readU32(bytes, cursor + 20)
    const nameLength = readU16(bytes, cursor + 28)
    const extraLength = readU16(bytes, cursor + 30)
    const commentLength = readU16(bytes, cursor + 32)
    const localOffset = readU32(bytes, cursor + 42)
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const packed = bytes.slice(start, start + compressedSize)
    entries.set(name, compression === 0 ? packed : new Uint8Array(inflateRawSync(packed)))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function unescapeXml(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
}

function text(value) {
  return unescapeXml([...value.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(''))
}

function exportedRows(bytes) {
  const files = unzip(bytes)
  const shared = decoder.decode(files.get('xl/sharedStrings.xml') ?? new Uint8Array())
  const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => text(match[1]))
  const sheet = decoder.decode(files.get('xl/worksheets/sheet1.xml') ?? new Uint8Array())
  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
    const type = /\bt="([^"]+)"/.exec(cellMatch[1])?.[1]
    const value = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] ?? ''
    return type === 's' ? strings[Number(value)] ?? '' : type === 'inlineStr' ? text(cellMatch[2]) : unescapeXml(value)
  }))
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message))
  page.on('requestfailed', (request) => errors.push('requestfailed: ' + request.url() + ' ' + (request.failure()?.errorText ?? 'unknown error')))
  const productCount = async () => {
    const header = await page.locator('header').getByText(/^\d+ item$/).textContent()
    const match = /^(\d+) item$/.exec(header?.trim() ?? '')
    check(match !== null, 'Product count is not visible in the production UI')
    return Number(match[1])
  }
  const openImport = async () => {
    const choose = page.getByRole('button', { name: 'Pilih File' })
    if (!await choose.isVisible()) await page.getByTitle('Impor / ekspor produk').click()
    await choose.waitFor()
  }
  const upload = async (name, buffer) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Pilih File' }).click()])
    await chooser.setFiles({ name, mimeType: name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(buffer) })
  }
  const reject = async (name, buffer, expected) => {
    await openImport()
    await upload(name, buffer)
    const error = page.getByText(expected, { exact: true })
    await error.waitFor()
    check(await error.isVisible(), 'Rejected upload reached import preview')
    check(await page.getByRole('button', { name: /^Impor \d+ Baris$/ }).count() === 0, 'Rejected upload reached import preview')
  }

  try {
    await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
    await page.getByTitle('Impor / ekspor produk').waitFor()
    check(await productCount() === 0, 'Fresh production browser context did not start with zero products')

    await reject('formula.xlsx', workbook({ rows: [['Formula product', '', '', '', 'CODE128', '1', '1', 'tidak', '0', 'ya']], formula: true }), 'Berkas spreadsheet tidak valid atau tidak didukung.')

    const valid = workbook({ rows: [['Security valid product', 'Security category', 'SEC-001', '8991002101234', 'EAN13', '15000', '10000', 'ya', '24', 'ya']] })
    await openImport()
    await upload('valid.xlsx', valid)
    await page.getByText('1 baris siap diimpor').waitFor()
    await page.getByRole('button', { name: 'Impor 1 Baris' }).click()
    await page.getByText('1 produk diimpor').waitFor()
    check(await productCount() === 1, 'Valid workbook did not write exactly one product')
    await page.getByRole('button', { name: 'Selesai' }).click()
    await page.getByText('Security valid product', { exact: true }).waitFor()

    await openImport()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()])
    const exportPath = join(ARTIFACT_DIR, 'produk-export.xlsx')
    await download.saveAs(exportPath)
    const [headers, data] = exportedRows(new Uint8Array(await readFile(exportPath)))
    check(headers?.length === PRODUCT_COLUMNS.length && headers.every((value, index) => value === PRODUCT_COLUMNS[index]), 'Export headers changed')
    check(data?.length === PRODUCT_COLUMNS.length && data[0] === 'Security valid product' && data[3] === '8991002101234', 'Export data changed')
    await page.getByRole('button', { name: 'Pilih File' }).waitFor()

    await upload('produk-export.xlsx', await readFile(exportPath))
    await page.getByText('1 baris siap diimpor').waitFor()
    await page.getByRole('button', { name: 'Impor 1 Baris' }).click()
    await page.getByText('1 dilewati (barcode sudah ada)').waitFor()
    check(await productCount() === 1, 'Re-imported export wrote a product')
    await page.getByRole('button', { name: 'Selesai' }).click()

    await openImport()
    const [templateDownload] = await Promise.all([page.waitForEvent('download'), page.getByTitle('Unduh template').click()])
    const templatePath = join(ARTIFACT_DIR, 'template-produk.xlsx')
    await templateDownload.saveAs(templatePath)
    const [templateHeaders, templateData] = exportedRows(new Uint8Array(await readFile(templatePath)))
    check(templateHeaders?.length === PRODUCT_COLUMNS.length && templateHeaders.every((value, index) => value === PRODUCT_COLUMNS[index]), 'Template headers changed')
    check(templateData?.[0] === 'Contoh Produk' && templateData[3] === '8991002101234', 'Template data changed')
    await upload('template-produk.xlsx', await readFile(templatePath))
    await page.getByText('1 baris siap diimpor').waitFor()
    await page.getByRole('button', { name: 'Impor 1 Baris' }).click()
    await page.getByText('1 dilewati (barcode sudah ada)').waitFor()
    check(await productCount() === 1, 'Re-imported template wrote a product')
    await page.getByRole('button', { name: 'Selesai' }).click()

    await reject('malformed.xlsx', encoder.encode('not an xlsx archive'), 'Berkas spreadsheet tidak valid atau tidak didukung.')
    await reject('macro.xlsx', workbook({ rows: [['Macro product', '', '', '', 'CODE128', '1', '1', 'tidak', '0', 'ya']], macro: true }), 'Berkas spreadsheet tidak valid atau tidak didukung.')
    await reject('external-link.xlsx', workbook({ rows: [['Linked product', '', '', '', 'CODE128', '1', '1', 'tidak', '0', 'ya']], external: true }), 'Berkas spreadsheet tidak valid atau tidak didukung.')
    await reject('formula.csv', encoder.encode(PRODUCT_COLUMNS.join(',') + '\nCSV formula product,,=1+1,,CODE128,1,1,tidak,0,ya'), 'Berkas spreadsheet tidak valid atau tidak didukung.')
    const formulaCsvError = page.getByText('Berkas spreadsheet tidak valid atau tidak didukung.', { exact: true })
    await writeFile(join(ARTIFACT_DIR, 'formula-csv-rejection.txt'), `${await formulaCsvError.textContent() ?? ''}\n`)
    await page.screenshot({ path: join(ARTIFACT_DIR, 'formula-csv-rejection.png'), fullPage: true })
    await reject('legacy.xls', encoder.encode('legacy spreadsheet'), 'File harus berformat .csv atau .xlsx.')

    await openImport()
    await upload('duplicate.csv', encoder.encode(PRODUCT_COLUMNS.join(',') + '\nSecurity CSV duplicate,Security category,SEC-CSV,8991002101234,EAN13,15000,10000,ya,24,ya'))
    await page.getByText('1 baris siap diimpor').waitFor()
    await page.getByRole('button', { name: 'Impor 1 Baris' }).click()
    await page.getByText('1 dilewati (barcode sudah ada)').waitFor()
    check(await productCount() === 1, 'Valid CSV duplicate wrote a product')
    await page.getByRole('button', { name: 'Selesai' }).click()

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Security valid product', { exact: true }).waitFor()
    check(await productCount() === 1, 'Rejected uploads changed the visible product count')
    for (const name of REJECTED_PRODUCT_NAMES) check(!await page.getByText(name, { exact: true }).isVisible(), 'Rejected upload wrote ' + name)
    const screenshotPath = join(ARTIFACT_DIR, 'products-after-security-check.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const summaryPath = join(ARTIFACT_DIR, 'summary.json')
    await writeFile(summaryPath, JSON.stringify({ base: BASE, exportPath, screenshotPath, productCount: await productCount(), browserErrors: errors }, null, 2) + '\n')
    check(errors.length === 0, 'Browser emitted errors')
    console.log('PASS xlsx-security export=' + exportPath + ' screenshot=' + screenshotPath + ' summary=' + summaryPath)
  } finally {
    await context.close()
    await browser.close()
  }
}

await main()
