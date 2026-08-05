<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Printer, Receipt } from 'lucide-vue-next'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import { usePrinterStore } from '@/stores/printer'
import { capabilities } from '@/services/capabilities/registry'
import type { PrinterCapability } from '@/services/capabilities/registry'
import { buildReceipt } from '@/lib/receipt'
import { formatRupiah } from '@/lib/money'
import { formatDateTime } from '@/lib/datetime'
import type { Sale, SaleItem } from '@/db/types'

const route = useRoute()
const sales = useSalesStore()
const settings = useSettingsStore()

const sale = ref<Sale | null>(null)
const items = ref<SaleItem[]>([])
const loading = ref(true)

const PAY_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }

onMounted(async () => {
  const res = await sales.getWithItems(String(route.params.id))
  sale.value = res.sale
  items.value = res.items
  loading.value = false
})

async function printReceipt() {
  if (!sale.value) return
  const printer = capabilities.get<PrinterCapability>('printer')
  if (!printer) return
  await printer.print(
    buildReceipt(sale.value, items.value, {
      storeName: settings.storeName,
      storeOwner: settings.storeOwner,
      width: usePrinterStore().paperWidth,
    }),
  )
}
</script>

<template>
  <div>
    <AppHeader title="Detail Transaksi" :subtitle="sale?.number" back />

    <div v-if="loading" class="p-8 text-center text-sm text-muted-foreground">Memuat…</div>

    <div v-else-if="!sale" class="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
      <Receipt class="size-10" />
      <p class="text-sm">Transaksi tidak ditemukan.</p>
    </div>

    <div v-else class="space-y-4 p-4">
      <!-- Info -->
      <div class="rounded-2xl border border-border bg-card p-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Nomor</span>
          <span class="font-medium">{{ sale.number }}</span>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Waktu</span>
          <span>{{ formatDateTime(sale.sold_at) }}</span>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Metode</span>
          <span>{{ PAY_LABEL[sale.payment_method] ?? sale.payment_method }}</span>
        </div>
      </div>

      <!-- Item -->
      <div class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="divide-y divide-border">
          <div v-for="it in items" :key="it.id" class="flex items-start gap-3 p-3">
            <span class="mt-0.5 min-w-8 text-sm font-semibold tabular-nums text-muted-foreground">{{ it.qty }}×</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ it.name_snapshot }}</p>
              <p class="text-xs text-muted-foreground">{{ formatRupiah(it.price_snapshot) }}</p>
            </div>
            <span class="text-sm font-semibold">{{ formatRupiah(it.line_total) }}</span>
          </div>
        </div>
        <!-- Total -->
        <div class="space-y-1.5 border-t border-border bg-muted/30 p-4">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Subtotal</span>
            <span>{{ formatRupiah(sale.subtotal) }}</span>
          </div>
          <div v-if="sale.discount > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">Diskon</span>
            <span>-{{ formatRupiah(sale.discount) }}</span>
          </div>
          <div class="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{{ formatRupiah(sale.total) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Bayar</span>
            <span>{{ formatRupiah(sale.paid) }}</span>
          </div>
          <div v-if="sale.change_due > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">Kembalian</span>
            <span class="font-semibold text-emerald-600">{{ formatRupiah(sale.change_due) }}</span>
          </div>
        </div>
      </div>

      <Button variant="outline" class="w-full gap-2" @click="printReceipt">
        <Printer class="size-4" /> Cetak Ulang Struk
      </Button>
    </div>
  </div>
</template>
