import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { CashierSessionRepository, type SessionCashSummary } from '@/repositories/cashierSession.repo'
import { CashierService } from '@/services/cashier.service'
import type { CashierSession } from '@/db/types'

export const useCashierStore = defineStore('cashier', () => {
  const current = ref<CashierSession | null>(null)
  const recent = ref<CashierSession[]>([])
  const summary = ref<SessionCashSummary | null>(null)
  const loading = ref(false)

  const isOpen = computed(() => !!current.value)

  function repo() {
    return new CashierSessionRepository(getDb())
  }
  function service() {
    return new CashierService(getDb())
  }

  /** Muat sesi aktif + ringkasan uangnya. */
  async function load() {
    loading.value = true
    current.value = await repo().current()
    summary.value = current.value ? await service().summary(current.value) : null
    loading.value = false
  }

  async function loadRecent(limit = 30) {
    recent.value = await repo().listRecent(limit)
  }

  /** Refresh ringkasan sesi terbuka (dipanggil ulang setelah ada transaksi). */
  async function refreshSummary() {
    summary.value = current.value ? await service().summary(current.value) : null
  }

  async function open(openingCash: number, note?: string) {
    current.value = await service().open({ openingCash, note: note ?? null })
    await refreshSummary()
    await loadRecent()
    return current.value
  }

  async function close(countedCash: number, note?: string) {
    if (!current.value) throw new Error('Tidak ada sesi terbuka')
    const closed = await service().close({
      sessionId: current.value.id,
      countedCash,
      note: note ?? undefined,
    })
    current.value = null
    summary.value = null
    await loadRecent()
    return closed
  }

  return {
    current,
    recent,
    summary,
    loading,
    isOpen,
    load,
    loadRecent,
    refreshSummary,
    open,
    close,
  }
})
