import type { AuthProvider } from '@/services/auth/types'
import type { SyncAdapter, SyncEngine, SyncStatus, ChangeEnvelope } from './types'
import { OutboxRepository } from '@/repositories/outbox.repo'
import { getDb } from '@/db/sqlite'

/**
 * Engine sync generik. v1: adapter = null → status 'disabled', semua no-op.
 * POS Pro nanti inject HttpSyncAdapter + JwtAuthProvider, dan flow di bawah
 * langsung jalan karena outbox sudah terisi sejak awal.
 */
export class DefaultSyncEngine implements SyncEngine {
  private _status: SyncStatus = 'disabled'
  private timer: ReturnType<typeof setInterval> | null = null
  private outbox = new OutboxRepository(getDb())

  constructor(
    private readonly auth: AuthProvider,
    private readonly adapter: SyncAdapter | null,
    private readonly intervalMs = 30_000,
  ) {}

  status(): SyncStatus {
    return this._status
  }

  start(): void {
    if (!this.adapter) {
      this._status = 'disabled'
      return
    }
    this.stop()
    this.timer = setInterval(() => void this.syncOnce(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async syncOnce(): Promise<void> {
    if (!this.adapter) {
      this._status = 'disabled'
      return
    }
    const token = await this.auth.getToken()
    if (!token) {
      this._status = 'offline'
      return
    }
    this._status = 'syncing'
    try {
      await this.push()
      // pull() akan menyusul saat POS Pro aktif.
      this._status = 'idle'
    } catch {
      this._status = 'error'
    }
  }

  private async push(): Promise<void> {
    if (!this.adapter) return
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
    const res = await this.adapter.push(envelopes)
    for (const id of res.acked) await this.outbox.markStatus(id, 'sent')
    for (const rej of res.rejected)
      await this.outbox.markStatus(rej.id, 'failed', rej.reason)
  }
}
