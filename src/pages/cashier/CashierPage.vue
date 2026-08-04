<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MoneyInput from '@/components/common/MoneyInput.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CalendarClock, DoorOpen, DoorClosed, History } from 'lucide-vue-next'
import { useCashierStore } from '@/stores/cashier'
import { formatRupiah } from '@/lib/money'
import { formatDateTime, formatTime } from '@/lib/datetime'

const cashier = useCashierStore()
const { current, recent, summary, isOpen } = storeToRefs(cashier)

// Form buka
const openingCash = ref(0)
const openNote = ref('')
const opening = ref(false)

// Form tutup
const showClose = ref(false)
const countedCash = ref(0)
const closeNote = ref('')
const closing = ref(false)

const difference = computed(() =>
  summary.value ? countedCash.value - summary.value.expectedCash : 0,
)

onMounted(async () => {
  await cashier.load()
  await cashier.loadRecent()
})

async function openSession() {
  opening.value = true
  try {
    await cashier.open(openingCash.value, openNote.value.trim() || undefined)
    openingCash.value = 0
    openNote.value = ''
  } finally {
    opening.value = false
  }
}

async function startClose() {
  await cashier.refreshSummary()
  countedCash.value = summary.value?.expectedCash ?? 0
  closeNote.value = ''
  showClose.value = true
}

async function closeSession() {
  closing.value = true
  try {
    await cashier.close(countedCash.value, closeNote.value.trim() || undefined)
    showClose.value = false
  } finally {
    closing.value = false
  }
}

function diffLabel(d: number | null): string {
  if (d == null) return '—'
  if (d === 0) return 'Pas'
  return d > 0 ? `Lebih ${formatRupiah(d)}` : `Kurang ${formatRupiah(-d)}`
}
</script>

<template>
  <div>
    <AppHeader title="Buka/Tutup Kasir" back />

    <div class="space-y-5 p-4">
      <!-- Sesi aktif -->
      <template v-if="isOpen && current && summary">
        <Card class="border-emerald-500/30 bg-emerald-500/5">
          <CardContent class="space-y-4 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                <DoorOpen class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold">Kasir Terbuka</p>
                <p class="text-xs text-muted-foreground">
                  Dibuka {{ formatDateTime(current.opened_at) }}
                </p>
              </div>
              <Badge class="bg-emerald-600">Aktif</Badge>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-background p-3">
                <p class="text-xs text-muted-foreground">Modal awal</p>
                <p class="mt-0.5 text-sm font-bold">{{ formatRupiah(summary.openingCash) }}</p>
              </div>
              <div class="rounded-xl bg-background p-3">
                <p class="text-xs text-muted-foreground">Penjualan tunai</p>
                <p class="mt-0.5 text-sm font-bold">{{ formatRupiah(summary.cashSales) }}</p>
              </div>
              <div class="rounded-xl bg-background p-3">
                <p class="text-xs text-muted-foreground">Transaksi</p>
                <p class="mt-0.5 text-sm font-bold">
                  {{ summary.salesCount }}
                  <span class="text-xs font-normal text-muted-foreground">
                    · {{ formatRupiah(summary.salesTotal) }}
                  </span>
                </p>
              </div>
              <div class="rounded-xl bg-emerald-500/10 p-3">
                <p class="text-xs text-emerald-700">Perkiraan di laci</p>
                <p class="mt-0.5 text-sm font-bold text-emerald-700">
                  {{ formatRupiah(summary.expectedCash) }}
                </p>
              </div>
            </div>

            <Button class="w-full gap-2" variant="destructive" @click="startClose">
              <DoorClosed class="size-4" /> Tutup Kasir
            </Button>
          </CardContent>
        </Card>
      </template>

      <!-- Buka kasir -->
      <template v-else>
        <Card>
          <CardContent class="space-y-4 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <DoorOpen class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold">Buka Kasir</p>
                <p class="text-xs text-muted-foreground">
                  Mulai sesi dengan mencatat modal awal di laci.
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="opening-cash">Modal awal (uang di laci)</Label>
              <MoneyInput id="opening-cash" v-model="openingCash" class="h-11 text-base font-semibold" />
            </div>
            <div class="space-y-1.5">
              <Label for="open-note">Catatan (opsional)</Label>
              <Input id="open-note" v-model="openNote" placeholder="mis. shift pagi" />
            </div>

            <Button class="w-full gap-2" :disabled="opening" @click="openSession">
              <DoorOpen class="size-4" />
              {{ opening ? 'Membuka…' : 'Buka Kasir' }}
            </Button>
          </CardContent>
        </Card>
      </template>

      <!-- Riwayat sesi -->
      <section class="space-y-2">
        <p class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <History class="size-3.5" /> Riwayat Sesi
        </p>

        <div v-if="recent.length" class="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          <div
            v-for="s in recent"
            :key="s.id"
            class="flex items-center gap-3 p-3.5"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl"
              :class="s.status === 'open' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'"
            >
              <component :is="s.status === 'open' ? DoorOpen : DoorClosed" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ formatDateTime(s.opened_at) }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <template v-if="s.closed_at">Tutup {{ formatTime(s.closed_at) }} · </template>
                Modal {{ formatRupiah(s.opening_cash) }}
              </p>
            </div>
            <div class="text-right">
              <Badge v-if="s.status === 'open'" class="bg-emerald-600">Aktif</Badge>
              <template v-else>
                <p class="text-sm font-semibold">{{ formatRupiah(s.counted_cash ?? 0) }}</p>
                <p
                  class="text-xs font-medium"
                  :class="(s.difference ?? 0) === 0 ? 'text-muted-foreground' : (s.difference ?? 0) > 0 ? 'text-emerald-600' : 'text-destructive'"
                >
                  {{ diffLabel(s.difference) }}
                </p>
              </template>
            </div>
          </div>
        </div>

        <EmptyState
          v-else
          :icon="CalendarClock"
          title="Belum ada sesi"
          description="Buka kasir untuk mulai mencatat sesi penjualan."
        />
      </section>
    </div>

    <!-- Sheet tutup kasir -->
    <BottomSheet :open="showClose" title="Tutup Kasir" @update:open="showClose = $event">
      <div v-if="summary" class="space-y-5 p-5">
        <!-- Rincian expected -->
        <div class="space-y-1.5 rounded-2xl bg-muted/50 p-4 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Modal awal</span>
            <span>{{ formatRupiah(summary.openingCash) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">+ Penjualan tunai</span>
            <span>{{ formatRupiah(summary.cashSales) }}</span>
          </div>
          <div v-if="summary.manualIn" class="flex justify-between">
            <span class="text-muted-foreground">+ Kas masuk manual</span>
            <span>{{ formatRupiah(summary.manualIn) }}</span>
          </div>
          <div v-if="summary.manualOut" class="flex justify-between">
            <span class="text-muted-foreground">− Kas keluar manual</span>
            <span>{{ formatRupiah(summary.manualOut) }}</span>
          </div>
          <div class="flex justify-between border-t border-border pt-1.5 font-semibold">
            <span>Perkiraan di laci</span>
            <span>{{ formatRupiah(summary.expectedCash) }}</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="counted-cash">Uang aktual dihitung</Label>
          <MoneyInput id="counted-cash" v-model="countedCash" class="h-12 text-lg font-semibold" />
        </div>

        <!-- Selisih -->
        <div class="flex items-center justify-between px-1">
          <span class="text-sm text-muted-foreground">Selisih</span>
          <span
            class="text-lg font-bold"
            :class="difference === 0 ? 'text-emerald-600' : 'text-destructive'"
          >
            {{ difference === 0 ? 'Pas' : (difference > 0 ? '+' : '') + formatRupiah(difference) }}
          </span>
        </div>

        <div class="space-y-1.5">
          <Label for="close-note">Catatan (opsional)</Label>
          <Input id="close-note" v-model="closeNote" placeholder="mis. selisih karena kembalian" />
        </div>

        <Button class="h-12 w-full gap-2 text-base" variant="destructive" :disabled="closing" @click="closeSession">
          <DoorClosed class="size-4" />
          {{ closing ? 'Menutup…' : 'Tutup Sesi' }}
        </Button>
      </div>
    </BottomSheet>
  </div>
</template>
