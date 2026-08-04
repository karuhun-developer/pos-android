import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDb } from '@/db/sqlite'
import { OutboxRepository } from '@/repositories/outbox.repo'
import { SyncEngine } from '@/services/sync/SyncEngine'
import type { SyncStatus } from '@/services/sync/types'
import { useAccountStore } from '@/stores/account'
import { nowMs } from '@/lib/datetime'
import { Network } from '@capacitor/network'

/**
 * Orkestrasi sync di level UI: bungkus SyncEngine, ekspos status + jumlah
 * pending + waktu sync terakhir. Auto-trigger saat online kembali.
 */
export const useSyncStore = defineStore('sync', () => {
  const account = useAccountStore()
  const engine = new SyncEngine(
    account.api,
    () => account.isAuthenticated && !!account.currentStoreId,
  )

  const status = ref<SyncStatus>('disabled')
  const pending = ref(0)
  const lastError = ref<string | null>(null)
  const lastSyncedAt = ref<number | null>(null)
  let netHandle: { remove: () => Promise<void> } | null = null

  async function refreshPending(): Promise<void> {
    pending.value = await new OutboxRepository(getDb()).countPending()
  }

  function refreshStatus(): void {
    status.value = engine.status()
    lastError.value = engine.lastError()
  }

  async function syncNow(): Promise<void> {
    await engine.syncOnce()
    refreshStatus()
    if (status.value === 'idle') lastSyncedAt.value = nowMs()
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
    lastError,
    lastSyncedAt,
    refreshPending,
    refreshStatus,
    syncNow,
    start,
    stop,
  }
})
