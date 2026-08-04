import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDb } from '@/db/sqlite'
import { CategoryRepository } from '@/repositories/category.repo'
import type { Category } from '@/db/types'

export const useCategoriesStore = defineStore('categories', () => {
  const items = ref<Category[]>([])
  const loading = ref(false)

  function repo() {
    return new CategoryRepository(getDb())
  }

  async function load() {
    loading.value = true
    items.value = await repo().listAll()
    loading.value = false
  }

  async function create(name: string, color?: string) {
    await repo().create({
      name: name.trim(),
      color: color ?? null,
      sort_order: items.value.length,
    })
    await load()
  }

  async function rename(id: string, name: string) {
    await repo().update(id, { name: name.trim() })
    await load()
  }

  async function remove(id: string) {
    await repo().softDelete(id)
    await load()
  }

  function nameOf(id: string | null): string {
    if (!id) return 'Tanpa kategori'
    return items.value.find((c) => c.id === id)?.name ?? 'Tanpa kategori'
  }

  return { items, loading, load, create, rename, remove, nameOf }
})
