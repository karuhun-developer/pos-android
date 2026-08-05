<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import DateRangeFilter from '@/components/common/DateRangeFilter.vue'
import ExportDialog from '@/components/common/ExportDialog.vue'
import { Button } from '@/components/ui/button'
import {
  Wallet, Plus, Tag, ArrowDownLeft, ArrowUpRight, Lock, Download,
} from 'lucide-vue-next'
import { useCashflowStore } from '@/stores/cashflow'
import { formatRupiah } from '@/lib/money'
import { formatTime, formatDate, dayKey } from '@/lib/datetime'
import { rangeLabel } from '@/lib/dateRange'
import type { CashflowEntry } from '@/db/types'

const router = useRouter()
const cashflow = useCashflowStore()
const { entries, summary, byCategory, range } = storeToRefs(cashflow)

const label = computed(() => rangeLabel(range.value))

const exportOpen = ref(false)

// Kelompokkan entri per hari.
const groups = computed(() => {
  const map = new Map<string, CashflowEntry[]>()
  for (const e of entries.value) {
    const k = dayKey(e.occurred_at)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  return Array.from(map.entries()).map(([key, rows]) => ({
    key,
    label: formatDate(rows[0].occurred_at),
    rows,
    net: rows.reduce((s, r) => s + (r.direction === 'debit' ? r.amount : -r.amount), 0),
  }))
})

onMounted(() => cashflow.load())

function openEntry(e: CashflowEntry) {
  if (e.source !== 'manual') return // entri dari penjualan terkunci
  router.push(`/cashflow/${e.id}/edit`)
}
</script>

<template>
  <div>
    <AppHeader title="Cashflow" :subtitle="label">
      <template #actions>
        <button
          class="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent"
          aria-label="Export Excel"
          @click="exportOpen = true"
        >
          <Download class="size-5" />
        </button>
        <RouterLink to="/cashflow/categories">
          <Button variant="outline" size="sm" class="gap-1.5" title="Kelola kategori">
            <Tag class="size-4" />
            <span>Kategori</span>
          </Button>
        </RouterLink>
      </template>
    </AppHeader>

    <!-- Filter tanggal -->
    <DateRangeFilter
      :model-value="range"
      @update:model-value="cashflow.setRange($event)"
    />

    <!-- Ringkasan rentang aktif -->
    <div class="border-b border-border bg-gradient-to-br from-primary to-primary/80 px-5 py-5 text-primary-foreground">
      <p class="text-xs opacity-80">Saldo · {{ label }}</p>
      <p class="mt-1 text-2xl font-bold">{{ formatRupiah(summary.net) }}</p>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-white/12 p-3 backdrop-blur">
          <div class="flex items-center gap-1 text-xs opacity-90">
            <ArrowDownLeft class="size-3.5" /> Pemasukan
          </div>
          <p class="mt-0.5 text-sm font-bold">{{ formatRupiah(summary.income) }}</p>
        </div>
        <div class="rounded-xl bg-white/12 p-3 backdrop-blur">
          <div class="flex items-center gap-1 text-xs opacity-90">
            <ArrowUpRight class="size-3.5" /> Pengeluaran
          </div>
          <p class="mt-0.5 text-sm font-bold">{{ formatRupiah(summary.expense) }}</p>
        </div>
      </div>
    </div>

    <!-- Breakdown per kategori -->
    <section v-if="byCategory.length" class="border-b border-border p-4">
      <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Per Kategori · {{ label }}
      </p>
      <div class="space-y-1.5">
        <div
          v-for="row in byCategory"
          :key="row.category?.id ?? 'none'"
          class="flex items-center gap-2 text-sm"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :class="row.category?.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'"
          />
          <span class="flex-1 truncate">{{ row.category?.name ?? 'Tanpa kategori' }}</span>
          <span
            class="font-medium"
            :class="row.category?.type === 'income' ? 'text-emerald-600' : 'text-rose-600'"
          >
            {{ formatRupiah(row.total) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Ledger -->
    <template v-if="entries.length">
      <section v-for="g in groups" :key="g.key">
        <div class="flex items-center justify-between bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span>{{ g.label }}</span>
          <span :class="g.net >= 0 ? 'text-emerald-600' : 'text-rose-600'">
            {{ g.net >= 0 ? '+' : '' }}{{ formatRupiah(g.net) }}
          </span>
        </div>
        <div class="divide-y divide-border">
          <button
            v-for="e in g.rows"
            :key="e.id"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition"
            :class="e.source === 'manual' ? 'active:bg-accent' : 'cursor-default'"
            @click="openEntry(e)"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl"
              :class="e.direction === 'debit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'"
            >
              <component :is="e.direction === 'debit' ? ArrowDownLeft : ArrowUpRight" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ cashflow.categoryName(e.category_id) }}</p>
              <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{{ formatTime(e.occurred_at) }}</span>
                <template v-if="e.note"><span>·</span><span class="truncate">{{ e.note }}</span></template>
                <Lock v-if="e.source !== 'manual'" class="size-3" />
              </div>
            </div>
            <span
              class="shrink-0 text-sm font-semibold"
              :class="e.direction === 'debit' ? 'text-emerald-600' : 'text-rose-600'"
            >
              {{ e.direction === 'debit' ? '+' : '−' }}{{ formatRupiah(e.amount) }}
            </span>
          </button>
        </div>
      </section>
    </template>

    <EmptyState
      v-else
      :icon="Wallet"
      title="Belum ada catatan kas"
      description="Penjualan otomatis tercatat di sini. Tambah pemasukan/pengeluaran manual dengan tombol +."
    />

    <!-- FAB tambah -->
    <button
      class="fixed bottom-20 right-1/2 z-30 flex size-14 translate-x-[min(11.5rem,45vw)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
      @click="router.push('/cashflow/new')"
    >
      <Plus class="size-6" />
    </button>

    <ExportDialog
      v-model:open="exportOpen"
      title="Export Cashflow"
      filename-base="cashflow"
      :initial-range="range"
      :build-sheets="cashflow.buildExport"
    />
  </div>
</template>
