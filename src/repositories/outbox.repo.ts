import type { Db, OutboxOp, OutboxRow, OutboxStatus } from '@/db/types'
import { persist } from '@/db/sqlite'
import { nowMs } from '@/lib/datetime'
import { uuid } from '@/lib/uuid'
import type { SyncEntityName } from '@/services/sync/applyPull'

export interface FailedOutboxChange {
  id: string
  entity: string
  entityId: string
  lastError: string | null
  createdAt: number
}

interface PushFinalization {
  readonly rows: readonly OutboxRow[]
  readonly acked: readonly string[]
  readonly rejected: readonly RejectedOutboxChange[]
}

interface RejectedOutboxChange {
  readonly id: string
  readonly reason: string
}

interface RecoverableDirtyRow extends Record<string, unknown> {
  id: string
  created_at: number
  deleted_at: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function payloadTimestamp(payload: unknown, key: 'updated_at' | 'deleted_at'): number {
  if (!isRecord(payload)) return 0
  const value = payload[key]
  return typeof value === 'number' ? value : 0
}

/** Akses ke change-log (outbox). Dipakai SyncEngine buat push perubahan. */
export class OutboxRepository {
  constructor(private readonly db: Db) {}

  async pending(limit = 200): Promise<OutboxRow[]> {
    return this.db.query<OutboxRow>(
      `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      [limit],
    )
  }

  async countPending(): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) as n FROM outbox WHERE status = 'pending'`,
    )
    return rows[0]?.n ?? 0
  }

  async countUnresolved(): Promise<number> {
    const rows = await this.db.query<{ readonly n: number }>(
      `SELECT COUNT(*) as n FROM outbox WHERE status IN ('pending', 'failed')`,
    )
    return rows[0]?.n ?? 0
  }

  async recoverMissingDirty(entities: readonly SyncEntityName[]): Promise<number> {
    let recovered = 0

    await this.db.transaction(async (tx) => {
      for (const entity of entities) {
        const rows = await tx.query<RecoverableDirtyRow>(
          `SELECT row.*
           FROM ${entity} AS row
           WHERE row.dirty = 1
             AND NOT EXISTS (
               SELECT 1
               FROM outbox
               WHERE entity = ?
                 AND entity_id = row.id
             )
           ORDER BY row.created_at ASC, row.id ASC`,
          [entity],
        )

        for (const row of rows) {
          const op: OutboxOp = row.deleted_at === null ? 'update' : 'delete'
          const payload = op === 'delete' ? { id: row.id, deleted_at: row.deleted_at } : row
          await tx.run(
            `INSERT INTO outbox (id, entity, entity_id, op, payload, created_at, attempts, status)
             VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
            [
              uuid(),
              entity,
              row.id,
              op,
              JSON.stringify(payload),
              nowMs(),
            ],
          )
          recovered += 1
        }
      }
    })

    if (recovered > 0) await persist()
    return recovered
  }

  async failed(limit = 3): Promise<FailedOutboxChange[]> {
    return this.db.query<FailedOutboxChange>(
      `SELECT
         id,
         entity,
         entity_id AS entityId,
         last_error AS lastError,
         created_at AS createdAt
       FROM outbox
       WHERE status = 'failed'
       ORDER BY created_at ASC
       LIMIT ?`,
      [limit],
    )
  }

  async retryFailed(): Promise<number> {
    const result = await this.db.run(
      `UPDATE outbox
       SET status = 'pending', last_error = NULL
       WHERE status = 'failed'`,
    )
    if (result.changes > 0) await persist()
    return result.changes
  }

  async finalizePush({ rows, acked, rejected }: PushFinalization): Promise<void> {
    const pushedById = new Map(rows.map((row) => [row.id, row]))

    await this.db.transaction(async (tx) => {
      for (const id of acked) {
        await tx.run(
          `UPDATE outbox SET status = 'sent', last_error = NULL, attempts = attempts + 1 WHERE id = ?`,
          [id],
        )
        const row = pushedById.get(id)
        if (row) await this.clearDirty(tx, row)
      }
      for (const rejectedChange of rejected) {
        await tx.run(
          `UPDATE outbox SET status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?`,
          [rejectedChange.reason, rejectedChange.id],
        )
      }
      await tx.run(`DELETE FROM outbox WHERE status = 'sent'`)
    })

    await persist()
  }

  async markStatus(id: string, status: OutboxStatus, error?: string): Promise<void> {
    await this.db.run(
      `UPDATE outbox SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?`,
      [status, error ?? null, id],
    )
  }

  /** Hapus baris yang sudah sukses ter-push (housekeeping). */
  async purgeSent(): Promise<void> {
    await this.db.run(`DELETE FROM outbox WHERE status = 'sent'`)
  }

  private async clearDirty(db: Db, row: OutboxRow): Promise<void> {
    const payload: unknown = JSON.parse(row.payload)
    if (row.op === 'delete') {
      await db.run(
        `UPDATE ${row.entity} SET dirty = 0 WHERE id = ? AND deleted_at = ?`,
        [row.entity_id, payloadTimestamp(payload, 'deleted_at')],
      )
      return
    }
    await db.run(
      `UPDATE ${row.entity} SET dirty = 0 WHERE id = ? AND updated_at = ?`,
      [row.entity_id, payloadTimestamp(payload, 'updated_at')],
    )
  }
}
