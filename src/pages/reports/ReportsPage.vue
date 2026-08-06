<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import DateRangeFilter from '@/components/common/DateRangeFilter.vue'
import ExportDialog from '@/components/common/ExportDialog.vue'
import {
  BarChart3, Download, ShoppingCart, ArrowDownLeft, ArrowUpRight,
} from 'lucide-vue-next'
import { useReportsStore, type ReportSource } from '@/stores/reports'
import { useSalesStore } from '@/stores/sales'
import { useCashflowStore } from '@/stores/cashflow'
import { formatRupiah } from '@/lib/money'
import { formatDate, nowMs } from '@/lib/datetime'
import { rangeLabel } from '@/lib/dateRange'

const reports = useReportsStore()
const sales = useSalesStore()
const cashflow = useCashflowStore()
const { source, range, todaySalesSummary, todayCashflow, chart, hasChartData } =
  storeToRefs(reports)

const todayLabel = computed(() => formatDate(nowMs()))
const trendLabel = computed(() => rangeLabel(range.value))

const SOURCES: { key: ReportSource; label: string }[] = [
  { key: 'sales', label: 'Transaksi' },
  { key: 'cashflow', label: 'Cashflow' },
]

// Format ringkas untuk label sumbu-Y (mis. 1,2jt / 300rb).
function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}jt`
  if (v >= 1_000) return `${Math.round(v / 1_000)}rb`
  return String(v)
}

const chartOptions = computed<ApexOptions>(() => {
  const dark = document.documentElement.classList.contains('dark')
  return {
    chart: {
      toolbar: { show: false },
      fontFamily: 'inherit',
      background: 'transparent',
    },
    theme: { mode: dark ? 'dark' : 'light' },
    colors: source.value === 'sales' ? ['#6366f1'] : ['#10b981', '#f43f5e'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '58%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: dark ? '#27272a' : '#e5e7eb', strokeDashArray: 4 },
    xaxis: {
      categories: chart.value.categories,
      labels: { style: { fontSize: '10px' }, rotate: 0, hideOverlappingLabels: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { formatter: (v: number) => compact(v), style: { fontSize: '10px' } },
    },
    legend: {
      show: source.value === 'cashflow',
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '12px',
    },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      y: { formatter: (v: number) => formatRupiah(v) },
    },
  }
})

// Konfigurasi export mengikuti sumber aktif — reuse buildExport yang sudah ada.
const exportConfig = computed(() =>
  source.value === 'sales'
    ? { title: 'Export Transaksi', filenameBase: 'transaksi', buildSheets: sales.buildExport }
    : { title: 'Export Cashflow', filenameBase: 'cashflow', buildSheets: cashflow.buildExport },
)

const exportOpen = ref(false)

onMounted(() => reports.load())
</script>

<template>
  <div class="pb-6">
    <AppHeader title="Laporan" :subtitle="`Tren · ${trendLabel}`" back>
      <template #actions>
        <button
          class="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent"
          aria-label="Export Excel"
          @click="exportOpen = true"
        >
          <Download class="size-5" />
        </button>
      </template>
    </AppHeader>

    <!-- KPI Hari Ini (selalu hari ini, tak ikut filter) -->
    <section class="space-y-3 p-4">
      <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Hari ini · {{ todayLabel }}
      </p>

      <!-- Penjualan hari ini -->
      <div class="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground">
        <div class="flex items-center gap-1.5 text-xs opacity-85">
          <ShoppingCart class="size-3.5" /> Penjualan
        </div>
        <p class="mt-1 text-2xl font-bold">{{ formatRupiah(todaySalesSummary.total) }}</p>
        <p class="text-xs opacity-85">{{ todaySalesSummary.count }} transaksi</p>
      </div>

      <!-- Pemasukan vs Pengeluaran hari ini -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-border bg-card p-4">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownLeft class="size-3.5 text-emerald-600" /> Pemasukan
          </div>
          <p class="mt-1 text-lg font-bold text-emerald-600">
            {{ formatRupiah(todayCashflow.income) }}
          </p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight class="size-3.5 text-rose-600" /> Pengeluaran
          </div>
          <p class="mt-1 text-lg font-bold text-rose-600">
            {{ formatRupiah(todayCashflow.expense) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Tren -->
    <section class="border-t border-border">
      <div class="flex items-center justify-between px-4 pt-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grafik Tren
        </p>
        <!-- Toggle sumber data -->
        <div class="flex gap-1 rounded-full border border-border p-0.5">
          <button
            v-for="opt in SOURCES"
            :key="opt.key"
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition"
            :class="
              source === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground active:bg-accent'
            "
            @click="reports.setSource(opt.key)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <DateRangeFilter
        class="mt-3"
        :model-value="range"
        @update:model-value="reports.setRange($event)"
      />

      <div class="p-3">
        <VueApexCharts
          v-if="hasChartData"
          type="bar"
          :height="290"
          :options="chartOptions"
          :series="chart.series"
        />
        <EmptyState
          v-else
          :icon="BarChart3"
          title="Belum ada data"
          :description="`Tidak ada ${source === 'sales' ? 'penjualan' : 'catatan kas'} pada rentang ${trendLabel.toLowerCase()}.`"
        />
      </div>
    </section>

    <ExportDialog
      v-model:open="exportOpen"
      :title="exportConfig.title"
      :filename-base="exportConfig.filenameBase"
      :initial-range="range"
      :build-sheets="exportConfig.buildSheets"
    />
  </div>
</template>
