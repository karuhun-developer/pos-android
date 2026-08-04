<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Button } from '@/components/ui/button'
import MoneyInput from '@/components/common/MoneyInput.vue'
import { Banknote, QrCode, ArrowLeftRight, Loader2 } from 'lucide-vue-next'
import { formatRupiah } from '@/lib/money'
import { useSettingsStore } from '@/stores/settings'
import { makeDynamicPayload, encodeQrToDataUrl } from '@/lib/qris'

const settings = useSettingsStore()

const props = defineProps<{ open: boolean; total: number; busy?: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: { paid: number; paymentMethod: string }]
}>()

type Method = 'cash' | 'qris' | 'transfer'
const METHODS: Array<{ id: Method; label: string; icon: typeof Banknote }> = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
]

const method = ref<Method>('cash')
const paid = ref(0)

// QRIS dinamis: QR di-generate saat metode QRIS dipilih & fitur aktif.
const qrDataUrl = ref<string | null>(null)
const qrLoading = ref(false)
const qrisDynamicReady = computed(() => settings.qrisDynamic && !!settings.qrisPayload)

// Reset tiap kali dialog dibuka.
watch(
  () => props.open,
  (v) => {
    if (v) {
      method.value = 'cash'
      paid.value = 0
    }
  },
)

// Generate QR dinamis tiap metode QRIS aktif / total berubah / dialog dibuka.
watch([method, () => props.total, () => props.open], () => {
  if (props.open) void genQr()
})

async function genQr() {
  qrDataUrl.value = null
  if (method.value !== 'qris' || !qrisDynamicReady.value || props.total <= 0) return
  qrLoading.value = true
  try {
    const payload = makeDynamicPayload(settings.qrisPayload!, props.total)
    qrDataUrl.value = await encodeQrToDataUrl(payload)
  } catch {
    qrDataUrl.value = null
  } finally {
    qrLoading.value = false
  }
}

// Saran nominal tunai: uang pas + pembulatan ke atas.
const quickAmounts = computed(() => {
  const t = props.total
  const set = new Set<number>([t])
  for (const step of [5000, 10000, 20000, 50000, 100000]) {
    set.add(Math.ceil(t / step) * step)
  }
  return Array.from(set)
    .filter((n) => n >= t)
    .sort((a, b) => a - b)
    .slice(0, 6)
})

const effectivePaid = computed(() => (method.value === 'cash' ? paid.value : props.total))
const change = computed(() => Math.max(0, effectivePaid.value - props.total))
const canConfirm = computed(
  () => !props.busy && (method.value !== 'cash' || paid.value >= props.total),
)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', { paid: effectivePaid.value, paymentMethod: method.value })
}
</script>

<template>
  <BottomSheet :open="open" title="Pembayaran" @update:open="emit('update:open', $event)">
    <div class="space-y-5 p-5">
      <!-- Total tagihan -->
      <div class="rounded-2xl bg-primary/10 p-4 text-center">
        <p class="text-xs font-medium text-muted-foreground">Total Tagihan</p>
        <p class="mt-1 text-3xl font-bold text-primary">{{ formatRupiah(total) }}</p>
      </div>

      <!-- Metode -->
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="m in METHODS"
          :key="m.id"
          type="button"
          class="flex flex-col items-center gap-1.5 rounded-xl border p-3 transition"
          :class="method === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'"
          @click="method = m.id"
        >
          <component :is="m.icon" class="size-5" />
          <span class="text-xs font-medium">{{ m.label }}</span>
        </button>
      </div>

      <!-- Input tunai -->
      <template v-if="method === 'cash'">
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground">Uang diterima</p>
          <MoneyInput v-model="paid" class="h-12 text-lg font-semibold" />
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="amt in quickAmounts"
              :key="amt"
              type="button"
              class="rounded-lg border border-border py-2 text-xs font-medium transition active:scale-95"
              :class="paid === amt ? 'border-primary bg-primary/5 text-primary' : 'text-foreground'"
              @click="paid = amt"
            >
              {{ amt === total ? 'Uang pas' : formatRupiah(amt) }}
            </button>
          </div>
        </div>
      </template>
      <!-- QRIS dinamis: tampilkan QR dengan nominal pas -->
      <div v-else-if="method === 'qris' && qrisDynamicReady" class="space-y-3 text-center">
        <div class="mx-auto flex size-56 items-center justify-center rounded-2xl border border-border bg-white p-2">
          <Loader2 v-if="qrLoading" class="size-6 animate-spin text-muted-foreground" />
          <img v-else-if="qrDataUrl" :src="qrDataUrl" alt="QRIS Dinamis" class="size-full object-contain" />
          <span v-else class="px-4 text-xs text-destructive">Gagal membuat QR. Cek QRIS di setelan.</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Pembeli scan QR ini — nominal sudah terkunci
          <span class="font-semibold text-foreground">{{ formatRupiah(total) }}</span>.
        </p>
      </div>
      <p v-else class="text-center text-xs text-muted-foreground">
        Pembayaran non-tunai dianggap lunas sejumlah total.
      </p>

      <!-- Kembalian -->
      <div v-if="method === 'cash'" class="flex items-center justify-between px-1">
        <span class="text-sm text-muted-foreground">Kembalian</span>
        <span class="text-lg font-bold" :class="change > 0 ? 'text-emerald-600' : ''">
          {{ formatRupiah(change) }}
        </span>
      </div>

      <Button class="h-12 w-full gap-2 text-base" :disabled="!canConfirm" @click="confirm">
        <Loader2 v-if="busy" class="size-4 animate-spin" />
        {{ busy ? 'Memproses…' : 'Selesaikan Pembayaran' }}
      </Button>
    </div>
  </BottomSheet>
</template>
