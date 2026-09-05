import type { SyncStatus, ChangeEnvelope, PushResult, PullResult } from './types'
import { ApiError } from '@/services/api/client'

/** Bagian ApiClient yang dipakai engine (structural — aman dari unwrap Pinia). */
export interface SyncApi {
  syncPush(changes: ChangeEnvelope[]): Promise<PushResult>
  syncPull(entity: string, since: number): Promise<PullResult>
}
import { OutboxRepository } from '@/repositories/outbox.repo'
import { SyncStateRepository } from '@/repositories/syncState.repo'
import { applyPulledRows, SYNC_ENTITIES } from './applyPull'
import { getDb } from '@/db/sqlite'

/**
 * Engine sync ke POS Pro. Alur tiap siklus: **push** (kirim outbox pending →
 * tandai acked/rejected + bersihkan dirty lokal) lalu **pull** (tarik perubahan
 * server per-entity berbasis cursor → apply LWW → majukan cursor).
 *
 * `isReady()` = sudah login + ada toko aktif. Kalau belum → status 'disabled'.
 */
export class SyncEngine {
  private static readonly instances = new Set<SyncEngine>()
  private static transitionBarrier: Promise<void> | null = null
  private static releaseTransitionBarrier: (() => void) | null = null
  private static transitionQueue: Promise<void> = Promise.resolve()
  private static queuedTransitions = 0

  private _status: SyncStatus = 'disabled'
  private _lastError: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private activeCycle: Promise<void> | null = null
  private outbox = new OutboxRepository(getDb())
  private state = new SyncStateRepository(getDb())

  constructor(
    private readonly api: SyncApi,
    private readonly isReady: () => boolean,
    private readonly intervalMs = 30_000,
    private readonly onCycleFinished?: () => void,
  ) {
    SyncEngine.instances.add(this)
  }

  static async duringOutletTransition<T>(work: () => Promise<T>): Promise<T> {
    if (this.queuedTransitions === 0) {
      this.transitionBarrier = new Promise<void>((resolve) => {
        this.releaseTransitionBarrier = resolve
      })
    }
    this.queuedTransitions += 1

    let releaseQueue = () => {}
    const previousTransition = this.transitionQueue
    this.transitionQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve
    })

    await previousTransition
    try {
      await Promise.all([...this.instances].map((engine) => engine.waitForActiveCycle()))
      return await work()
    } finally {
      releaseQueue()
      this.queuedTransitions -= 1
      if (this.queuedTransitions === 0) {
        this.transitionBarrier = null
        this.releaseTransitionBarrier?.()
        this.releaseTransitionBarrier = null
      }
    }
  }

  status(): SyncStatus {
    return this._status
  }

  lastError(): string | null {
    return this._lastError
  }

  start(): void {
    this.stop()
    if (!this.isReady()) {
      this._status = 'disabled'
      this.onCycleFinished?.()
      return
    }
    this.timer = setInterval(() => void this.syncOnce(), this.intervalMs)
    void this.syncOnce()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  syncOnce(): Promise<void> {
    const transitionBarrier = SyncEngine.transitionBarrier
    if (transitionBarrier) return transitionBarrier.then(() => this.syncOnce())
    if (this.activeCycle) return this.activeCycle

    if (!this.isReady()) {
      this._status = 'disabled'
      return Promise.resolve()
    }

    this.activeCycle = this.runCycle()
    return this.activeCycle
  }

  private async waitForActiveCycle(): Promise<void> {
    while (this.activeCycle) await this.activeCycle
  }

  private async runCycle(): Promise<void> {
    this._status = 'syncing'
    this._lastError = null
    try {
      await this.push()
      await this.pull()
      this._status = 'idle'
    } catch (e) {
      this._status = e instanceof ApiError && e.status === 0 ? 'offline' : 'error'
      this._lastError = e instanceof Error ? e.message : String(e)
    } finally {
      this.activeCycle = null
      this.onCycleFinished?.()
    }
  }

  private async push(): Promise<void> {
    await this.outbox.recoverMissingDirty(SYNC_ENTITIES)
    const rows = await this.outbox.pending()
    if (!rows.length) return

    const envelopes: ChangeEnvelope[] = rows.map((r) => {
      const payload: unknown = JSON.parse(r.payload)
      return {
        id: r.id,
        entity: r.entity,
        entityId: r.entity_id,
        op: r.op,
        payload,
        createdAt: r.created_at,
      }
    })
    const res = await this.api.syncPush(envelopes)

    await this.outbox.finalizePush({
      rows,
      acked: res.acked,
      rejected: res.rejected,
    })
  }

  private async pull(): Promise<void> {
    const db = getDb()
    for (const entity of SYNC_ENTITIES) {
      const since = await this.state.lastPulledAt(entity)
      const res = await this.api.syncPull(entity, since)
      if (res.changes.length) {
        await applyPulledRows(db, entity, res.changes)
      }
      if (res.cursor > since) {
        await this.state.setLastPulledAt(entity, res.cursor)
      }
    }
  }
}
