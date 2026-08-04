import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { ProductRepository } from '@/repositories/product.repo'
import type { Product } from '@/db/types'

export type ProductInput = Omit<
  Product,
  keyof import('@/db/types').SyncEntity
>

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
  }
})
