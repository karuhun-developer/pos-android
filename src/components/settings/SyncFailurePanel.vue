<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

type FailedChange = {
  readonly id: string
  readonly entity: string
  readonly entityId: string
  readonly lastError: string | null
}

const props = defineProps<{
  readonly changes: readonly FailedChange[]
  readonly failedCount: number
  readonly retrying: boolean
}>()

const emit = defineEmits<{ retry: [] }>()
const previewChanges = computed(() => props.changes.slice(0, 3))

function readableEntity(entity: string): string {
  switch (entity) {
    case 'categories': return 'Kategori'
    case 'products': return 'Produk'
    case 'media': return 'Media'
    case 'cashier_sessions': return 'Sesi kasir'
    case 'sales': return 'Penjualan'
    case 'sale_items': return 'Item penjualan'
    case 'cashflow_categories': return 'Kategori arus kas'
    case 'cashflow_entries': return 'Catatan arus kas'
    default: return entity.replaceAll('_', ' ')
  }
}
</script>

<template>
  <section
    v-if="changes.length"
    class="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
    role="status"
    aria-live="polite"
    aria-labelledby="failed-sync-heading"
  >
    <div class="flex items-start gap-2">
      <AlertCircle class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <p id="failed-sync-heading" class="text-sm font-semibold text-destructive">Perubahan gagal disinkronkan</p>
        <p class="text-xs text-muted-foreground">{{ failedCount }} perubahan perlu dicoba lagi.</p>
      </div>
    </div>
    <ul class="space-y-2" aria-label="Daftar perubahan gagal">
      <li v-for="change in previewChanges" :key="change.id" class="rounded-lg bg-background/70 p-2 text-xs">
        <p class="break-words font-medium text-foreground">{{ readableEntity(change.entity) }} · {{ change.entityId }}</p>
        <p class="break-words text-muted-foreground">{{ change.lastError ?? 'Alasan kegagalan tidak tersedia.' }}</p>
      </li>
    </ul>
    <Button
      variant="outline"
      class="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      :disabled="retrying"
      @click="emit('retry')"
    >
      <RotateCcw class="size-4" :class="retrying && 'animate-spin'" />
      Coba lagi
    </Button>
  </section>
</template>
