<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Badge } from '@/components/ui/badge'
import { Receipt, ChevronRight } from 'lucide-vue-next'
import { useSalesStore } from '@/stores/sales'
import { formatRupiah } from '@/lib/money'
import { formatTime, formatDate, dayKey } from '@/lib/datetime'
import type { Sale } from '@/db/types'

const sales = useSalesStore()
const { recent, today } = storeToRefs(sales)

const PAY_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }

// Kelompokkan per hari buat header tanggal.
const groups = computed(() => {
  const map = new Map<string, Sale[]>()
  for (const s of recent.value) {
    const k = dayKey(s.sold_at)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(s)
  }
  return Array.from(map.entries()).map(([key, rows]) => ({
    key,
    label: formatDate(rows[0].sold_at),
    rows,
    total: rows.reduce((sum, r) => sum + (r.status === 'completed' ? r.total : 0), 0),
  }))
})

onMounted(() => sales.load())
</script>

<template>
  <div>
    <AppHeader title="Transaksi" :subtitle="`Hari ini: ${today.count} transaksi`" />

    <!-- Ringkasan hari ini -->
    <div class="border-b border-border bg-gradient-to-br from-primary to-primary/80 px-5 py-5 text-primary-foreground">
      <p class="text-xs opacity-80">Penjualan hari ini</p>
      <p class="mt-1 text-2xl font-bold">{{ formatRupiah(today.total) }}</p>
      <p class="mt-0.5 text-xs opacity-80">{{ today.count }} transaksi</p>
    </div>

    <template v-if="recent.length">
      <section v-for="g in groups" :key="g.key">
        <div class="flex items-center justify-between bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span>{{ g.label }}</span>
          <span>{{ formatRupiah(g.total) }}</span>
        </div>
        <div class="divide-y divide-border">
          <RouterLink
            v-for="s in g.rows"
            :key="s.id"
            :to="`/transactions/${s.id}`"
            class="flex items-center gap-3 px-4 py-3 transition active:bg-accent"
          >
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ s.number }}</p>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ formatTime(s.sold_at) }}</span>
                <span>·</span>
                <span>{{ PAY_LABEL[s.payment_method] ?? s.payment_method }}</span>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold">{{ formatRupiah(s.total) }}</p>
              <Badge v-if="s.status === 'void'" variant="secondary" class="mt-0.5">Batal</Badge>
            </div>
            <ChevronRight class="size-4 text-muted-foreground" />
          </RouterLink>
        </div>
      </section>
    </template>

    <EmptyState
      v-else
      :icon="Receipt"
      title="Belum ada transaksi"
      description="Transaksi dari menu Kasir (POS) akan muncul di sini."
    />
  </div>
</template>
