import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { ProductRepository } from '@/repositories/product.repo'
import type { Product } from '@/db/types'
// Type-only: modul productIo balik meng-import ProductInput dari sini, jadi
// import nilainya sengaja dinamis di bulkImport() biar gak siklik saat runtime.
import type { ParsedProduct } from '@/services/products/productIo'

export type ProductInput = Omit<
  Product,
  keyof import('@/db/types').SyncEntity
>

/**
 * Row produk → ProductInput. Return type-nya lengkap, jadi tiap kolom produk
 * baru yang lupa dipetakan langsung ketahuan `vue-tsc` — bukan diam-diam
 * ke-reset jadi undefined pas user buka form edit.
 * Dipakai form edit & builder export produk.
 */
export function toProductInput(p: Product): ProductInput {
  return {
    category_id: p.category_id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    barcode_type: p.barcode_type,
    price: p.price,
    cost: p.cost,
    track_stock: p.track_stock,
    stock: p.stock,
    image_path: p.image_path,
    active: p.active,
  }
}

export const useProductsStore = defineStore('products', () => {
  const items = ref<Product[]>([])
  const loading = ref(false)
  const query = ref('')
  const categoryFilter = ref<string | null>(null)

  function repo() {
    return new ProductRepository(getDb())
  }

  const filtered = computed(() => {
    let list = items.value
    if (categoryFilter.value) {
      list = list.filter((p) => p.category_id === categoryFilter.value)
    }
    const q = query.value.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q),
      )
    }
    return list
  })

  const count = computed(() => items.value.length)

  async function load() {
    loading.value = true
    items.value = await repo().listAll()
    loading.value = false
  }

  async function getById(id: string) {
    return repo().findById(id)
  }

  async function create(input: ProductInput) {
    const p = await repo().create(input)
    await load()
    return p
  }

  async function update(id: string, patch: Partial<ProductInput>) {
    await repo().update(id, patch)
    await load()
  }

  async function remove(id: string) {
    await repo().softDelete(id)
    await load()
  }

  /** Lookup barcode dari list yang sudah dimuat — dipakai mode scan kasir. */
  function byBarcode(code: string): Product | undefined {
    const c = code.trim()
    if (!c) return undefined
    return items.value.find((p) => p.barcode === c)
  }

  /**
   * Impor massal dari CSV/XLSX. `load()` cuma sekali di akhir — create() biasa
   * me-reload seluruh list tiap baris, yang bikin impor ratusan produk merangkak.
   */
  async function bulkImport(
    rows: ParsedProduct[],
    onProgress?: (done: number, total: number) => void,
  ) {
    const { importProducts } = await import('@/services/products/productIo')
    const result = await importProducts(rows, onProgress)
    await load()
    return result
  }

  return {
    items,
    loading,
    query,
    categoryFilter,
    filtered,
    count,
    load,
    getById,
    create,
    update,
    remove,
    byBarcode,
    bulkImport,
  }
})
