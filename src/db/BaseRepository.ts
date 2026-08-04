import type { Db, OutboxOp, SyncEntity } from './types'
import { persist } from './sqlite'
import { nowMs } from '@/lib/datetime'
import { uuid } from '@/lib/uuid'

/** Field sync default yang diisi otomatis saat create. */
function syncDefaults(t: number) {
  return {
    created_at: t,
    updated_at: t,
    deleted_at: null as number | null,
    dirty: 1,
    sync_version: 0,
    remote_id: null as string | null,
  }
}

export interface ListOptions {
  where?: string
  params?: unknown[]
  orderBy?: string
  includeDeleted?: boolean
}

/**
 * Repository generik untuk tabel yang mengikuti kontrak SyncEntity.
 * create/update/softDelete SELALU nulis baris outbox dalam transaksi yang
 * sama — inilah jaminan tidak ada perubahan yang hilang saat sync nanti.
 */
export abstract class BaseRepository<T extends SyncEntity> {
  protected abstract readonly table: string

  constructor(protected readonly db: Db) {}

  /** Catat perubahan ke outbox (dipanggil di dalam tx). */
  protected async logChange(
    tx: Db,
    op: OutboxOp,
    entityId: string,
    payload: unknown,
  ): Promise<void> {
    await tx.run(
      `INSERT INTO outbox (id, entity, entity_id, op, payload, created_at, attempts, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [uuid(), this.table, entityId, op, JSON.stringify(payload), nowMs()],
    )
  }

  async create(
    data: Omit<T, keyof SyncEntity> & Partial<Pick<T, 'id'>>,
  ): Promise<T> {
    const t = nowMs()
    const row = {
      ...(data as object),
      id: (data as { id?: string }).id ?? uuid(),
      ...syncDefaults(t),
    } as T

    await this.db.transaction(async (tx) => {
      const cols = Object.keys(row)
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map((c) => (row as Record<string, unknown>)[c])
      await tx.run(
        `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`,
        values,
      )
      await this.logChange(tx, 'insert', row.id, row)
    })
    await persist()
    return row
  }

  async update(
    id: string,
    patch: Partial<Omit<T, keyof SyncEntity>>,
  ): Promise<T | null> {
    const t = nowMs()
    const fields: Record<string, unknown> = {
      ...(patch as object),
      updated_at: t,
      dirty: 1,
    }
    const result = await this.db.transaction(async (tx) => {
      const cols = Object.keys(fields)
      const set = cols.map((c) => `${c} = ?`).join(', ')
      await tx.run(`UPDATE ${this.table} SET ${set} WHERE id = ?`, [
        ...cols.map((c) => fields[c]),
        id,
      ])
      const updated = await this.findById(id, tx)
      if (updated) await this.logChange(tx, 'update', id, updated)
      return updated
    })
    await persist()
    return result
  }

  /** Soft delete — set deleted_at, tetap ada di DB buat sync. */
  async softDelete(id: string): Promise<void> {
    const t = nowMs()
    await this.db.transaction(async (tx) => {
      await tx.run(
        `UPDATE ${this.table} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
        [t, t, id],
      )
      await this.logChange(tx, 'delete', id, { id, deleted_at: t })
    })
    await persist()
  }

  async findById(id: string, db: Db = this.db): Promise<T | null> {
    const rows = await db.query<T>(
      `SELECT * FROM ${this.table} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    )
    return rows[0] ?? null
  }

  async list(opts: ListOptions = {}): Promise<T[]> {
    const conds: string[] = []
    const params: unknown[] = []
    if (!opts.includeDeleted) conds.push('deleted_at IS NULL')
    if (opts.where) {
      conds.push(opts.where)
      if (opts.params) params.push(...opts.params)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const order = opts.orderBy ? `ORDER BY ${opts.orderBy}` : ''
    return this.db.query<T>(
      `SELECT * FROM ${this.table} ${where} ${order}`,
      params,
    )
  }

  /** Baris yang belum ter-sync — dipakai SyncEngine nanti. */
  async findDirty(): Promise<T[]> {
    return this.db.query<T>(`SELECT * FROM ${this.table} WHERE dirty = 1`)
  }
}
