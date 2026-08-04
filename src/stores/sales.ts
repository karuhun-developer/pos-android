import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SaleRepository } from '@/repositories/sale.repo'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { CheckoutService, type CheckoutInput, type CheckoutResult } from '@/services/checkout.service'
import type { Sale, SaleItem } from '@/db/types'
import { dayKey } from '@/lib/datetime'

export const useSalesStore = defineStore('sales', () => {
  const recent = ref<Sale[]>([])
  const loading = ref(false)

  function saleRepo() {
    return new SaleRepository(getDb())
  }
  function itemRepo() {
    return new SaleItemRepository(getDb())
  }

  const today = computed(() => {
    const key = dayKey(Date.now())
    const rows = recent.value.filter(
      (s) => s.status === 'completed' && dayKey(s.sold_at) === key,
    )
    return {
      count: rows.length,
      total: rows.reduce((sum, s) => sum + s.total, 0),
    }
  })

  async function load(limit = 50) {
    loading.value = true
    recent.value = await saleRepo().listRecent(limit)
    loading.value = false
  }

  async function getWithItems(
    id: string,
  ): Promise<{ sale: Sale | null; items: SaleItem[] }> {
    const sale = await saleRepo().findById(id)
    const items = sale ? await itemRepo().bySale(id) : []
    return { sale, items }
  }

  async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await new CheckoutService(getDb()).checkout(input)
    await load()
    return res
  }

  return { recent, loading, today, load, getWithItems, checkout }
})
