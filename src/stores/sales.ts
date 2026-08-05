import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SaleRepository } from '@/repositories/sale.repo'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { CheckoutService, type CheckoutInput, type CheckoutResult } from '@/services/checkout.service'
import type { Sale, SaleItem } from '@/db/types'
import { presetRange, type DateRange } from '@/lib/dateRange'
import { formatDateTime } from '@/lib/datetime'
import type { ExportSheet } from '@/lib/xlsx'

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

  // Bangun sheet Excel untuk rentang (independen dari `range` halaman).
  async function buildExport(r: DateRange): Promise<ExportSheet[]> {
    const sales = await saleRepo().listBetween(r.from, r.to, 100000)
    const items = await itemRepo().listBetween(r.from, r.to)
    const txRows = sales.map((s) => ({
      Tanggal: formatDateTime(s.sold_at),
      'No Struk': s.number,
      Metode: s.payment_method,
      Status: s.status === 'completed' ? 'Selesai' : 'Void',
      Subtotal: s.subtotal,
      Diskon: s.discount,
      Pajak: s.tax,
      Total: s.total,
      Bayar: s.paid,
      Kembali: s.change_due,
    }))
    const itemRows = items.map((it) => ({
      Tanggal: formatDateTime(it.sold_at),
      'No Struk': it.number,
      Produk: it.name_snapshot,
      Harga: it.price_snapshot,
      Qty: it.qty,
      Diskon: it.discount,
      Subtotal: it.line_total,
    }))
    return [
      { name: 'Transaksi', rows: txRows },
      { name: 'Item', rows: itemRows },
    ]
  }

  return { recent, loading, range, summary, load, setRange, getWithItems, checkout, buildExport }
})
