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
import type { OutboxRow } from '@/db/types'
import { getDb } from '@/db/sqlite'

/**
 * Engine sync ke POS Pro. Alur tiap siklus: **push** (kirim outbox pending →
 * tandai acked/rejected + bersihkan dirty lokal) lalu **pull** (tarik perubahan
 * server per-entity berbasis cursor → apply LWW → majukan cursor).
 *
 * `isReady()` = sudah login + ada toko aktif. Kalau belum → status 'disabled'.
 */
export class SyncEngine {
  private _status: SyncStatus = 'disabled'
  private _lastError: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private outbox = new OutboxRepository(getDb())
  private state = new SyncStateRepository(getDb())

  constructor(
    private readonly api: SyncApi,
    private readonly isReady: () => boolean,
    private readonly intervalMs = 30_000,
  ) {}

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
      return
    }
    this.timer = setInterval(() => void this.syncOnce(), this.intervalMs)
    void this.syncOnce()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async syncOnce(): Promise<void> {
    if (!this.isReady()) {
      this._status = 'disabled'
      return
    }
    if (this.running) return // hindari overlap
    this.running = true
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
      this.running = false
    }
  }

  private async push(): Promise<void> {
    const rows = await this.outbox.pending()
    if (!rows.length) return

    const envelopes: ChangeEnvelope[] = rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entity_id,
      op: r.op,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
    }))
    const res = await this.api.syncPush(envelopes)

    const byId = new Map(rows.map((r) => [r.id, r]))
    const db = getDb()
    for (const id of res.acked) {
      await this.outbox.markStatus(id, 'sent')
      const r = byId.get(id)
      if (r) await this.clearDirty(db, r)
    }
    for (const rej of res.rejected) {
      await this.outbox.markStatus(rej.id, 'failed', rej.reason)
    }
    await this.outbox.purgeSent()
  }

  /** Set dirty=0 pada baris yang persis ter-push (cek updated_at/deleted_at
   *  supaya tidak menghapus flag dari edit lokal yang lebih baru). */
  private async clearDirty(db: ReturnType<typeof getDb>, r: OutboxRow): Promise<void> {
    const payload = JSON.parse(r.payload) as { updated_at?: number; deleted_at?: number }
    if (r.op === 'delete') {
      await db.run(
        `UPDATE ${r.entity} SET dirty = 0 WHERE id = ? AND deleted_at = ?`,
        [r.entity_id, Number(payload.deleted_at ?? 0)],
      )
    } else {
      await db.run(
        `UPDATE ${r.entity} SET dirty = 0 WHERE id = ? AND updated_at = ?`,
        [r.entity_id, Number(payload.updated_at ?? 0)],
      )
    }
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
