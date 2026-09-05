import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDb } from '@/db/sqlite'
import { OutboxRepository } from '@/repositories/outbox.repo'
import type { FailedOutboxChange } from '@/repositories/outbox.repo'
import { SyncEngine } from '@/services/sync/SyncEngine'
import type { SyncStatus } from '@/services/sync/types'
import { useAccountStore } from '@/stores/account'
import { nowMs } from '@/lib/datetime'
import { Network } from '@capacitor/network'

interface OutboxCount {
  readonly n: number
}

/**
 * Orkestrasi sync di level UI: bungkus SyncEngine, ekspos status + jumlah
 * pending + waktu sync terakhir. Auto-trigger saat online kembali.
 */
export const useSyncStore = defineStore('sync', () => {
  const account = useAccountStore()

  const status = ref<SyncStatus>('disabled')
  const pending = ref(0)
  const failedChanges = ref<FailedOutboxChange[]>([])
  const failedCount = ref(0)
  const lastError = ref<string | null>(null)
  const lastSyncedAt = ref<number | null>(null)
  let netHandle: { remove: () => Promise<void> } | null = null

  async function refreshPending(): Promise<void> {
    const db = getDb()
    const outbox = new OutboxRepository(db)
    const [pendingCount, failedRows, failedCountRows] = await Promise.all([
      outbox.countPending(),
      outbox.failed(3),
      db.query<OutboxCount>(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed'`),
    ])

    pending.value = pendingCount
    failedChanges.value = failedRows
    failedCount.value = failedCountRows[0]?.n ?? 0
  }

  function refreshStatus(): void {
    status.value = engine.status()
    lastError.value = engine.lastError()
  }

  async function refreshAfterCycle(): Promise<void> {
    refreshStatus()
    if (status.value === 'idle') lastSyncedAt.value = nowMs()
    await refreshPending()
  }

  const engine = new SyncEngine(
    account.api,
    () => account.isAuthenticated && !!account.currentStoreId,
    30_000,
    async () => {
      try {
        await refreshAfterCycle()
      } catch (e) {
        lastError.value = e instanceof Error ? e.message : String(e)
      }
    },
  )

  async function syncNow(): Promise<void> {
    const syncPromise = engine.syncOnce()
    refreshStatus()
    await syncPromise
    await refreshAfterCycle()
  }

  async function retryFailed(): Promise<void> {
    const retried = await new OutboxRepository(getDb()).retryFailed()
    if (retried > 0) {
      await syncNow()
      return
    }
    await refreshPending()
  }

  async function start(): Promise<void> {
    engine.start()
    refreshStatus()
    await refreshPending()
    if (!netHandle) {
      netHandle = await Network.addListener('networkStatusChange', (s) => {
        if (s.connected) void syncNow()
      })
    }
  }

  async function stop(): Promise<void> {
    engine.stop()
    if (netHandle) {
      await netHandle.remove()
      netHandle = null
    }
    refreshStatus()
  }

  return {
    status,
    pending,
    failedChanges,
    failedCount,
    lastError,
    lastSyncedAt,
    refreshPending,
    refreshStatus,
    syncNow,
    retryFailed,
    start,
    stop,
  }
})
