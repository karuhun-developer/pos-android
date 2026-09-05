<script setup lang="ts">
import { AlertCircle, RefreshCw } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SyncFailurePanel from './SyncFailurePanel.vue'
import type { SyncStatus } from '@/services/sync/types'

type FailedChange = {
  readonly id: string
  readonly entity: string
  readonly entityId: string
  readonly lastError: string | null
}

defineProps<{
  readonly syncStatus: SyncStatus
  readonly syncLabel: string
  readonly pending: number
  readonly lastError: string | null
  readonly lastSyncedAt: number | null
  readonly failedChanges: readonly FailedChange[]
  readonly failedCount: number
}>()

const emit = defineEmits<{ sync: []; retry: [] }>()
</script>

<template>
  <Card>
    <CardContent class="space-y-3 p-4">
      <div class="flex items-center justify-between text-sm">
        <span class="font-semibold">Sinkronisasi</span>
        <Badge :variant="syncStatus === 'error' || failedCount > 0 ? 'destructive' : 'secondary'">{{ syncLabel }}</Badge>
      </div>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>Antre belum terkirim</span>
        <span>{{ pending }}</span>
      </div>
      <p v-if="lastSyncedAt" class="text-xs text-muted-foreground">Terakhir sync: {{ new Date(lastSyncedAt).toLocaleString('id-ID') }}</p>
      <p v-if="lastError" class="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle class="size-3.5" /> {{ lastError }}</p>
      <SyncFailurePanel :changes="failedChanges" :failed-count="failedCount" :retrying="syncStatus === 'syncing'" @retry="emit('retry')" />
      <Button class="w-full" :disabled="syncStatus === 'syncing'" @click="emit('sync')">
        <RefreshCw class="size-4" :class="syncStatus === 'syncing' && 'animate-spin'" />
        Sync sekarang
      </Button>
    </CardContent>
  </Card>
</template>
