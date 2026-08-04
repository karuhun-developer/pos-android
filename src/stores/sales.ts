import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SaleRepository } from '@/repositories/sale.repo'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { CheckoutService, type CheckoutInput, type CheckoutResult } from '@/services/checkout.service'
import type { Sale, SaleItem } from '@/db/types'
import { presetRange, type DateRange } from '@/lib/dateRange'

export const useSalesStore = defineStore('sales', () => {
  const recent = ref<Sale[]>([])
  const loading = ref(false)
  // Default: bulan berjalan. Semua isi `recent` selalu dalam rentang ini.
  const range = ref<DateRange>(presetRange('month'))

  function saleRepo() {
    return new SaleRepository(getDb())
  }
  function itemRepo() {
    return new SaleItemRepository(getDb())
  }

  // Ringkasan atas = agregat rentang aktif (recent sudah ter-filter rentang).
  const summary = computed(() => {
    const rows = recent.value.filter((s) => s.status === 'completed')
    return {
      count: rows.length,
      total: rows.reduce((sum, s) => sum + s.total, 0),
    }
  })

  async function load() {
    loading.value = true
    recent.value = await saleRepo().listBetween(range.value.from, range.value.to)
    loading.value = false
  }

  async function setRange(r: DateRange) {
    range.value = r
    await load()
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

  return { recent, loading, range, summary, load, setRange, getWithItems, checkout }
})
