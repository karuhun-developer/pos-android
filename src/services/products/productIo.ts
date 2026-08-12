import { getDb, persist } from '@/db/sqlite'
import type { Category, Product } from '@/db/types'
import { ProductRepository } from '@/repositories/product.repo'
import { CategoryRepository } from '@/repositories/category.repo'
import { DEFAULT_BARCODE_TYPE, guessBarcodeType, normalizeBarcodeType } from '@/lib/barcode'
import type { ExportSheet, RawRow } from '@/lib/xlsx'
import type { ProductInput } from '@/stores/products'

/**
 * Impor/ekspor produk lewat CSV & XLSX.
 *
 * Aturan utama (diminta user): baris yang barcode-nya **sudah ada** di DB
 * di-skip — termasuk duplikat di dalam file itu sendiri. Baris **tanpa**
 * barcode selalu diimpor (banyak produk warung memang gak punya barcode).
 */

/** Header kolom file, urut. Pakai Bahasa Indonesia biar gampang diedit user. */
export const PRODUCT_COLUMNS = [
  'nama',
  'kategori',
  'sku',
  'barcode',
  'tipe_barcode',
  'harga_jual',
  'harga_modal',
  'lacak_stok',
  'stok',
  'aktif',
] as const

/** Alias header supaya file hasil edit/ekspor tool lain tetap kebaca. */
const HEADER_ALIASES: Record<string, string> = {
  name: 'nama',
  nama_produk: 'nama',
  product_name: 'nama',
  category: 'kategori',
  kategori_produk: 'kategori',
  code: 'sku',
  kode: 'sku',
  barcode_type: 'tipe_barcode',
  tipe: 'tipe_barcode',
  simbologi: 'tipe_barcode',
  price: 'harga_jual',
  harga: 'harga_jual',
  sell_price: 'harga_jual',
  cost: 'harga_modal',
  modal: 'harga_modal',
  cost_price: 'harga_modal',
  track_stock: 'lacak_stok',
  stock: 'stok',
  qty: 'stok',
  jumlah: 'stok',
  active: 'aktif',
  status: 'aktif',
}

export interface RowError {
  /** Nomor baris di file (baris 1 = header). */
  line: number
  message: string
}

/** Satu baris valid, siap diimpor. Kategori masih berupa nama. */
export interface ParsedProduct {
  line: number
  categoryName: string | null
  input: Omit<ProductInput, 'category_id'>
}

export interface ParseResult {
  rows: ParsedProduct[]
  errors: RowError[]
}

export interface ImportResult {
  imported: number
  /** Di-skip karena barcode-nya sudah ada (di DB atau di baris sebelumnya). */
  skippedDuplicate: number
  createdCategories: number
  errors: RowError[]
}

// ── Ekspor ───────────────────────────────────────────────────────────────────

/**
 * Susun sheet ekspor. Kategori ditulis sebagai **nama**, bukan UUID, supaya
 * filenya bisa dibaca & diedit manusia — dan waktu diimpor balik, kategori
 * yang belum ada dibuat otomatis.
 *
 * `id` sengaja TIDAK diekspor: impor selalu bikin produk baru, jadi kolom id
 * cuma bikin user salah sangka file ini bisa dipakai buat update massal.
 */
export function buildProductSheet(products: Product[], categories: Category[]): ExportSheet {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return {
    name: 'Produk',
    rows: products.map((p) => ({
      nama: p.name,
      kategori: p.category_id ? (nameById.get(p.category_id) ?? '') : '',
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      tipe_barcode: p.barcode_type,
      harga_jual: p.price,
      harga_modal: p.cost,
      lacak_stok: p.track_stock ? 'ya' : 'tidak',
      stok: p.stock,
      aktif: p.active ? 'ya' : 'tidak',
    })),
  }
}

/** Sheet contoh berisi satu baris — dipakai tombol "Unduh template". */
export function buildTemplateSheet(): ExportSheet {
  return {
    name: 'Produk',
    rows: [
      {
        nama: 'Contoh Produk',
        kategori: 'Minuman',
        sku: 'SKU-001',
        barcode: '8991002101234',
        tipe_barcode: DEFAULT_BARCODE_TYPE,
        harga_jual: 15000,
        harga_modal: 10000,
        lacak_stok: 'ya',
        stok: 24,
        aktif: 'ya',
      },
    ],
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function normalizeHeader(key: string): string {
  const k = key.trim().toLowerCase().replace(/\s+/g, '_')
  return HEADER_ALIASES[k] ?? k
}

/** Ambil nilai kolom dari baris yang header-nya sudah dinormalisasi. */
function cell(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim()
}

/**
 * Angka rupiah dari sel teks. Semua pemisah ribuan ("18.000", "18,000",
 * "Rp 18.000") dibuang; harga di app ini memang bilangan bulat rupiah.
 */
function parseAmount(raw: string): number | null {
  if (!raw) return 0
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

const TRUTHY = new Set(['ya', 'y', 'yes', 'true', '1', 'aktif', 'on'])
const FALSY = new Set(['tidak', 'no', 'n', 'false', '0', 'nonaktif', 'off', ''])

function parseFlag(raw: string, fallback: number): number | null {
  const v = raw.toLowerCase()
  if (!v) return fallback
  if (TRUTHY.has(v)) return 1
  if (FALSY.has(v)) return 0
  return null
}

/**
 * Baris mentah → produk. Baris yang gak valid masuk `errors` (dengan nomor
 * baris file) dan sisanya tetap jalan — satu typo gak boleh menggagalkan
 * seluruh impor.
 */
export async function parseProductRows(raw: RawRow[]): Promise<ParseResult> {
  const rows: ParsedProduct[] = []
  const errors: RowError[] = []

  for (const [i, original] of raw.entries()) {
    const line = i + 2 // +1 index 0-based, +1 baris header
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(original)) {
      row[normalizeHeader(k)] = typeof v === 'string' ? v : String(v ?? '')
    }

    const name = cell(row, 'nama')
    if (!name) {
      errors.push({ line, message: 'Kolom "nama" kosong' })
      continue
    }

    const barcode = cell(row, 'barcode')
    // Excel memperlakukan barcode 13 digit sebagai angka → "8.99123E+12".
    // Nilainya sudah rusak di file, jadi lebih jujur ditolak daripada diimpor salah.
    if (/e\+\d/i.test(barcode)) {
      errors.push({
        line,
        message: `Barcode "${barcode}" kebaca sebagai notasi ilmiah — format kolom barcode sebagai Teks dulu di Excel`,
      })
      continue
    }

    const price = parseAmount(cell(row, 'harga_jual'))
    if (price === null) {
      errors.push({ line, message: `Harga jual "${cell(row, 'harga_jual')}" bukan angka` })
      continue
    }
    const cost = parseAmount(cell(row, 'harga_modal'))
    if (cost === null) {
      errors.push({ line, message: `Harga modal "${cell(row, 'harga_modal')}" bukan angka` })
      continue
    }

    const trackStock = parseFlag(cell(row, 'lacak_stok'), 0)
    if (trackStock === null) {
      errors.push({ line, message: `Lacak stok "${cell(row, 'lacak_stok')}" harus ya/tidak` })
      continue
    }
    const active = parseFlag(cell(row, 'aktif'), 1)
    if (active === null) {
      errors.push({ line, message: `Aktif "${cell(row, 'aktif')}" harus ya/tidak` })
      continue
    }

    const stock = parseAmount(cell(row, 'stok'))
    if (stock === null) {
      errors.push({ line, message: `Stok "${cell(row, 'stok')}" bukan angka` })
      continue
    }

    // Tipe kosong → tebak dari panjang barcode, biar user gak wajib ngisi kolom ini.
    const typeCell = cell(row, 'tipe_barcode')
    const barcodeType = typeCell
      ? normalizeBarcodeType(typeCell)
      : barcode
        ? await guessBarcodeType(barcode)
        : DEFAULT_BARCODE_TYPE

    const category = cell(row, 'kategori')
    rows.push({
      line,
      categoryName: category || null,
      input: {
        name,
        sku: cell(row, 'sku') || null,
        barcode: barcode || null,
        barcode_type: barcodeType,
        price,
        cost,
        track_stock: trackStock,
        stock: trackStock ? stock : 0,
        image_path: null,
        active,
      },
    })
  }

  return { rows, errors }
}

// ── Impor ────────────────────────────────────────────────────────────────────

/** Ditulis per transaksi, bukan per baris — satu commit besar bikin UI beku. */
const CHUNK = 300

/**
 * Tulis baris hasil parse ke SQLite.
 *
 * Repo dibangun di atas handle `tx` (bukan `getDb()`) karena
 * `db.transaction()` reentrant-nya **per objek Db**: repo yang megang instance
 * luar bakal buka `beginTransaction` kedua dan meledak. Pola ini sama persis
 * dengan `CheckoutService`.
 *
 * Outbox tetap 1 baris per produk — memang harus, supaya semuanya ke-push ke
 * POS Pro. `persist()` (flush IndexedDB di web) dipanggil sekali per chunk,
 * bukan per produk.
 */
export async function importProducts(
  rows: ParsedProduct[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const db = getDb()

  const existing = await db.query<{ barcode: string }>(
    `SELECT barcode FROM products
     WHERE barcode IS NOT NULL AND barcode <> '' AND deleted_at IS NULL`,
  )
  const seen = new Set(existing.map((r) => r.barcode))

  const cats = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM categories WHERE deleted_at IS NULL`,
  )
  const catByName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]))

  const result: ImportResult = {
    imported: 0,
    skippedDuplicate: 0,
    createdCategories: 0,
    errors: [],
  }
  let sortOrder = cats.length

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK)

    await db.transaction(async (tx) => {
      const products = new ProductRepository(tx)
      const categories = new CategoryRepository(tx)

      for (const row of chunk) {
        const barcode = row.input.barcode
        if (barcode && seen.has(barcode)) {
          result.skippedDuplicate++
          continue
        }

        let categoryId: string | null = null
        if (row.categoryName) {
          const key = row.categoryName.toLowerCase()
          categoryId = catByName.get(key) ?? null
          if (!categoryId) {
            const created = await categories.create({
              name: row.categoryName,
              color: null,
              sort_order: sortOrder++,
            })
            categoryId = created.id
            catByName.set(key, created.id)
            result.createdCategories++
          }
        }

        try {
          await products.create({ ...row.input, category_id: categoryId })
          if (barcode) seen.add(barcode)
          result.imported++
        } catch (err) {
          result.errors.push({
            line: row.line,
            message: err instanceof Error ? err.message : 'Gagal menyimpan',
          })
        }
      }
    })

    await persist()
    onProgress?.(Math.min(start + CHUNK, rows.length), rows.length)
  }

  return result
}
