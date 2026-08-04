import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { CashflowEntryRepository } from '@/repositories/cashflowEntry.repo'
import { CashflowCategoryRepository } from '@/repositories/cashflowCategory.repo'
import type { CashflowCategory, CashflowEntry } from '@/db/types'
import { nowMs, monthKey } from '@/lib/datetime'

export interface NewEntry {
  categoryId: string
  amount: number
  note?: string | null
  occurredAt?: number
  sessionId?: string | null
}

export const useCashflowStore = defineStore('cashflow', () => {
  const entries = ref<CashflowEntry[]>([])
  const categories = ref<CashflowCategory[]>([])
  const loading = ref(false)

  function entryRepo() {
    return new CashflowEntryRepository(getDb())
  }
  function catRepo() {
    return new CashflowCategoryRepository(getDb())
  }

  function category(id: string | null): CashflowCategory | undefined {
    if (!id) return undefined
    return categories.value.find((c) => c.id === id)
  }
  function categoryName(id: string | null): string {
    return category(id)?.name ?? 'Tanpa kategori'
  }
  function categoriesOfType(type: 'income' | 'expense') {
    return categories.value.filter((c) => c.type === type)
  }

  // Ringkasan bulan berjalan.
  const monthSummary = computed(() => {
    const key = monthKey(nowMs())
    let income = 0
    let expense = 0
    for (const e of entries.value) {
      if (monthKey(e.occurred_at) !== key) continue
      if (e.direction === 'debit') income += e.amount
      else expense += e.amount
    }
    return { income, expense, net: income - expense }
  })

  // Total per kategori (bulan berjalan) — buat breakdown.
  const byCategory = computed(() => {
    const key = monthKey(nowMs())
    const map = new Map<string, { category: CashflowCategory | undefined; total: number }>()
    for (const e of entries.value) {
      if (monthKey(e.occurred_at) !== key) continue
      const k = e.category_id ?? 'none'
      if (!map.has(k)) map.set(k, { category: category(e.category_id), total: 0 })
      map.get(k)!.total += e.amount
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  })

  async function load() {
    loading.value = true
    categories.value = await catRepo().listAll()
    entries.value = await entryRepo().listRecent(500)
    loading.value = false
  }

  async function createEntry(input: NewEntry): Promise<CashflowEntry> {
    const cat = category(input.categoryId)
    // Arah diturunkan dari tipe kategori: income = uang masuk (debit),
    // expense = uang keluar (credit). Konsisten dgn checkout.
    const direction: 'debit' | 'credit' = cat?.type === 'income' ? 'debit' : 'credit'
    const entry = await entryRepo().create({
      category_id: input.categoryId,
      session_id: input.sessionId ?? null,
      direction,
      amount: Math.max(0, Math.round(input.amount || 0)),
      source: 'manual',
      source_ref: null,
      note: input.note?.trim() || null,
      occurred_at: input.occurredAt ?? nowMs(),
    })
    await load()
    return entry
  }

  async function updateEntry(
    id: string,
    patch: { categoryId?: string; amount?: number; note?: string | null; occurredAt?: number },
  ) {
    const fields: Partial<CashflowEntry> = {}
    if (patch.categoryId !== undefined) {
      fields.category_id = patch.categoryId
      const cat = category(patch.categoryId)
      fields.direction = cat?.type === 'income' ? 'debit' : 'credit'
    }
    if (patch.amount !== undefined) fields.amount = Math.max(0, Math.round(patch.amount))
    if (patch.note !== undefined) fields.note = patch.note?.trim() || null
    if (patch.occurredAt !== undefined) fields.occurred_at = patch.occurredAt
    await entryRepo().update(id, fields)
    await load()
  }

  async function deleteEntry(id: string) {
    await entryRepo().softDelete(id)
    await load()
  }

  // ── Kategori ────────────────────────────────────────────────────────────────
  async function createCategory(name: string, type: 'income' | 'expense') {
    await catRepo().create({
      name: name.trim(),
      type,
      is_system: 0,
      sort_order: categories.value.length,
    })
    await load()
  }

  async function renameCategory(id: string, name: string) {
    await catRepo().update(id, { name: name.trim() })
    await load()
  }

  async function removeCategory(id: string) {
    await catRepo().softDelete(id)
    await load()
  }

  return {
    entries,
    categories,
    loading,
    monthSummary,
    byCategory,
    category,
    categoryName,
    categoriesOfType,
    load,
    createEntry,
    updateEntry,
    deleteEntry,
    createCategory,
    renameCategory,
    removeCategory,
  }
})
