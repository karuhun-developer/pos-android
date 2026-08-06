import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SaleRepository } from '@/repositories/sale.repo'
import { CashflowEntryRepository } from '@/repositories/cashflowEntry.repo'
import type { Sale, CashflowEntry } from '@/db/types'
import { presetRange, type DateRange } from '@/lib/dateRange'
import { dayKey, startOfDay } from '@/lib/datetime'

/** Sumber data grafik tren: transaksi penjualan atau catatan kas. */
export type ReportSource = 'sales' | 'cashflow'

interface ChartSeries {
  name: string
  data: number[]
}

export const useReportsStore = defineStore('reports', () => {
  // Sumber grafik tren (KPI hari ini selalu tampil dua-duanya).
  const source = ref<ReportSource>('sales')
  // Rentang untuk grafik tren (KPI hari ini TIDAK ikut rentang ini).
  const range = ref<DateRange>(presetRange('week'))
  const loading = ref(false)

  // Data "hari ini" untuk kartu KPI — independen dari `range`.
  const todaySales = ref<Sale[]>([])
  const todayCash = ref<CashflowEntry[]>([])
  // Data rentang aktif untuk grafik tren.
  const rangeSales = ref<Sale[]>([])
  const rangeCash = ref<CashflowEntry[]>([])

  function saleRepo() {
    return new SaleRepository(getDb())
  }
  function cashRepo() {
    return new CashflowEntryRepository(getDb())
  }

  async function loadRange(r: DateRange) {
    const [rs, rc] = await Promise.all([
      saleRepo().listBetween(r.from, r.to, 100000),
      cashRepo().listBetween(r.from, r.to, 100000),
    ])
    rangeSales.value = rs
    rangeCash.value = rc
  }

  async function load() {
    loading.value = true
    const today = presetRange('today')
    const [ts, tc] = await Promise.all([
      saleRepo().listBetween(today.from, today.to, 100000),
      cashRepo().listBetween(today.from, today.to, 100000),
    ])
    todaySales.value = ts
    todayCash.value = tc
    await loadRange(range.value)
    loading.value = false
  }

  // Ganti sumber grafik — tak perlu query ulang (kedua dataset sudah dimuat).
  function setSource(s: ReportSource) {
    source.value = s
  }

  async function setRange(r: DateRange) {
    range.value = r
    loading.value = true
    await loadRange(r)
    loading.value = false
  }

  // ── KPI hari ini ────────────────────────────────────────────────────────────
  const todaySalesSummary = computed(() => {
    const rows = todaySales.value.filter((s) => s.status === 'completed')
    return {
      total: rows.reduce((sum, s) => sum + s.total, 0),
      count: rows.length,
    }
  })

  const todayCashflow = computed(() => {
    let income = 0
    let expense = 0
    for (const e of todayCash.value) {
      if (e.direction === 'debit') income += e.amount
      else expense += e.amount
    }
    return { income, expense, net: income - expense }
  })

  // ── Grafik tren ─────────────────────────────────────────────────────────────
  // Daftar hari (start-of-day) dalam rentang, termasuk hari kosong.
  function dayList(r: DateRange): number[] {
    const days: number[] = []
    let cur = startOfDay(r.from)
    let guard = 0
    while (cur <= r.to && guard < 400) {
      days.push(cur)
      const d = new Date(cur)
      d.setDate(d.getDate() + 1)
      cur = startOfDay(d.getTime())
      guard++
    }
    return days
  }

  const chart = computed<{ categories: string[]; series: ChartSeries[] }>(() => {
    const days = dayList(range.value)
    const categories = days.map((ms) => {
      const d = new Date(ms)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const idx = new Map<string, number>()
    days.forEach((ms, i) => idx.set(dayKey(ms), i))

    if (source.value === 'sales') {
      const data = new Array(days.length).fill(0)
      for (const s of rangeSales.value) {
        if (s.status !== 'completed') continue
        const i = idx.get(dayKey(s.sold_at))
        if (i !== undefined) data[i] += s.total
      }
      return { categories, series: [{ name: 'Penjualan', data }] }
    }

    const income = new Array(days.length).fill(0)
    const expense = new Array(days.length).fill(0)
    for (const e of rangeCash.value) {
      const i = idx.get(dayKey(e.occurred_at))
      if (i === undefined) continue
      if (e.direction === 'debit') income[i] += e.amount
      else expense[i] += e.amount
    }
    return {
      categories,
      series: [
        { name: 'Pemasukan', data: income },
        { name: 'Pengeluaran', data: expense },
      ],
    }
  })

  const hasChartData = computed(() =>
    chart.value.series.some((s) => s.data.some((v) => v > 0)),
  )

  return {
    source,
    range,
    loading,
    todaySalesSummary,
    todayCashflow,
    chart,
    hasChartData,
    load,
    setSource,
    setRange,
  }
})
