<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { Button } from '@/components/ui/button'
import { CameraOff, Flashlight, FlashlightOff, Loader2 } from 'lucide-vue-next'
import { capabilities } from '@/services/capabilities/registry'
import type { ScanResult, ScannerCapability, ScannerSession } from '@/services/capabilities/registry'
import { createScanGate } from '@/services/capabilities/scanner/scanGate'

const props = withDefaults(
  defineProps<{
    /** Jeda minimal sebelum kode yang sama diterima lagi (ms). */
    sameCodeMs?: number
    /** Hint di bawah bingkai. */
    hint?: string
  }>(),
  { sameCodeMs: 1500, hint: 'Arahkan barcode ke dalam kotak' },
)

const emit = defineEmits<{ scan: [result: ScanResult] }>()

const mount = ref<HTMLElement | null>(null)
const session = shallowRef<ScannerSession | null>(null)
const torchOn = ref(false)
const starting = ref(true)
const error = ref<'denied' | 'notfound' | 'unsupported' | 'other' | null>(null)

const gate = createScanGate({ sameCodeMs: props.sameCodeMs })

const MESSAGES: Record<string, string> = {
  denied:
    'Izin kamera ditolak. Buka Setelan → Aplikasi → POS Kacaw → Izin → Kamera, lalu coba lagi.',
  notfound: 'Kamera tidak ditemukan di perangkat ini.',
  unsupported: 'Perangkat ini tidak mendukung akses kamera dari aplikasi.',
  other: 'Kamera gagal dinyalakan.',
}

async function start() {
  error.value = null
  starting.value = true
  gate.reset()
  try {
    const scanner = capabilities.get<ScannerCapability>('scanner')
    if (!scanner || !(await scanner.isAvailable())) {
      error.value = 'unsupported'
      return
    }
    if (!mount.value) return
    session.value = await scanner.start({
      mount: mount.value,
      onScan: (r) => {
        if (gate.accept(r.value)) emit('scan', r)
      },
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    error.value =
      name === 'NotAllowedError' || name === 'SecurityError'
        ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'notfound'
          : 'other'
  } finally {
    starting.value = false
  }
}

async function stop() {
  torchOn.value = false
  const s = session.value
  session.value = null
  await s?.stop()
}

async function toggleTorch() {
  if (!session.value) return
  torchOn.value = !torchOn.value
  await session.value.setTorch(torchOn.value)
}

/** Kamera wajib mati saat app ke background — hemat baterai & lepas sensor. */
function onVisibility() {
  if (document.visibilityState === 'hidden') void stop()
  else if (!session.value && !error.value) void start()
}

onMounted(async () => {
  await start()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(async () => {
  document.removeEventListener('visibilitychange', onVisibility)
  await stop()
})

defineExpose({ stop, start })
</script>

<template>
  <div class="relative size-full overflow-hidden bg-black">
    <!-- <video> di-inject ke sini oleh WebScanner.start({ mount }) -->
    <div ref="mount" class="size-full" />

    <!-- Bingkai sasaran + hint -->
    <template v-if="!error && !starting">
      <div
        class="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
      />
      <p class="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
        {{ hint }}
      </p>
    </template>

    <div v-if="starting" class="absolute inset-0 flex items-center justify-center">
      <Loader2 class="size-8 animate-spin text-white/70" />
    </div>

    <!-- Kegagalan izin/hardware: jangan tinggalin kotak hitam kosong -->
    <div
      v-if="error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center"
    >
      <CameraOff class="size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">{{ MESSAGES[error] }}</p>
      <Button variant="outline" size="sm" @click="start">Coba lagi</Button>
    </div>

    <button
      v-if="session?.torchAvailable"
      type="button"
      class="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur active:scale-95"
      :title="torchOn ? 'Matikan senter' : 'Nyalakan senter'"
      @click="toggleTorch"
    >
      <component :is="torchOn ? FlashlightOff : Flashlight" class="size-5" />
    </button>

    <slot />
  </div>
</template>
