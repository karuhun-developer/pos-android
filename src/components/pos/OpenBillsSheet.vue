<script setup lang="ts">
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock3, Monitor, Play, ReceiptText, Trash2 } from 'lucide-vue-next'
import type { Sale } from '@/db/types'
import { formatDateTime } from '@/lib/datetime'
import { formatRupiah } from '@/lib/money'

const props = withDefaults(defineProps<{
  readonly open: boolean
  readonly bills: readonly Sale[]
  readonly deviceId: string
  readonly cartHasLines: boolean
  readonly busyBillId?: string | null
}>(), {
  busyBillId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  resume: [bill: Sale]
  discard: [bill: Sale]
}>()

function isOwnBill(bill: Sale): boolean {
  return props.deviceId !== '' && bill.origin_device_id === props.deviceId
}

function openedAt(bill: Sale): number {
  return bill.opened_at ?? bill.created_at
}

function resume(bill: Sale) {
  if (!isOwnBill(bill) || props.cartHasLines || props.busyBillId !== null) return
  emit('resume', bill)
}

function discard(bill: Sale) {
  if (!isOwnBill(bill) || props.busyBillId !== null) return
  emit('discard', bill)
}
</script>

<template>
  <BottomSheet
    :open="open"
    title="Open Bills"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4 p-5">
      <p
        v-if="cartHasLines"
        class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning-foreground"
      >
        Kosongkan atau tahan keranjang aktif terlebih dahulu sebelum melanjutkan Open Bill lain.
      </p>

      <div
        v-if="bills.length"
        class="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
      >
        <article v-for="bill in bills" :key="bill.id" class="space-y-3 p-4">
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <ReceiptText class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-semibold">{{ bill.open_bill_label ?? 'Tanpa label' }}</p>
                <Badge variant="warning">Open Bill</Badge>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">{{ bill.number }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 class="size-3.5" />
                Ditahan {{ formatDateTime(openedAt(bill)) }}
              </p>
            </div>
            <p class="shrink-0 text-sm font-semibold text-info">{{ formatRupiah(bill.total) }}</p>
          </div>

          <p
            v-if="!isOwnBill(bill)"
            class="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Monitor class="size-3.5" />
            Hanya dapat dilanjutkan dari perangkat asal.
          </p>

          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              class="gap-1.5"
              :disabled="!isOwnBill(bill) || cartHasLines || busyBillId !== null"
              @click="resume(bill)"
            >
              <Play class="size-4" /> Lanjutkan
            </Button>
            <Button
              variant="destructive"
              class="gap-1.5"
              :disabled="!isOwnBill(bill) || busyBillId !== null"
              @click="discard(bill)"
            >
              <Trash2 class="size-4" /> Buang
            </Button>
          </div>
        </article>
      </div>

      <div v-else class="flex flex-col items-center gap-2 py-10 text-center">
        <div class="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ReceiptText class="size-5" />
        </div>
        <p class="text-sm font-semibold">Belum ada Open Bill</p>
        <p class="max-w-64 text-xs leading-relaxed text-muted-foreground">
          Tahan pesanan dari keranjang untuk melanjutkannya nanti.
        </p>
      </div>
    </div>
  </BottomSheet>
</template>
