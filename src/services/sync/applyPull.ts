import type { Db } from '@/db/types'
import { persist } from '@/db/sqlite'

/** 8 entity yang disync (mirror allowlist server). `settings` device-local. */
export const SYNC_ENTITIES = [
  'categories',
  'products',
  'media',
  'cashier_sessions',
  'sales',
  'sale_items',
  'cashflow_categories',
  'cashflow_entries',
] as const

export type SyncEntityName = (typeof SYNC_ENTITIES)[number]

const colCache: Record<string, string[]> = {}

/** Kolom nyata tabel (buat whitelist kolom payload server). */
async function tableColumns(db: Db, entity: string): Promise<string[]> {
  if (colCache[entity]) return colCache[entity]
  const info = await db.query<{ name: string }>(`PRAGMA table_info(${entity})`)
  return (colCache[entity] = info.map((c) => c.name))
}

/**
 * Terapkan baris hasil pull ke tabel lokal, **tanpa** menulis outbox (hindari
 * echo loop). Aturan:
 * - Baris lokal `dirty=1` (belum ke-push) → dibiarkan menang (defer konflik).
 * - Selain itu, last-write-wins by `updated_at` (server ≤ lokal → dilewati).
 * - Baris yang diterapkan di-set `dirty=0`.
 * Kolom payload di-whitelist ke kolom tabel supaya aman.
 */
export async function applyPulledRows(
  db: Db,
  entity: SyncEntityName,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (!SYNC_ENTITIES.includes(entity)) {
    throw new Error(`Entity tidak dikenal: ${entity}`)
  }
  if (!rows.length) return 0

  const allowed = new Set(await tableColumns(db, entity))
  let applied = 0

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const id = row.id as string | undefined
      if (!id) continue

      const localRows = await tx.query<{ updated_at: number; dirty: number }>(
        `SELECT updated_at, dirty FROM ${entity} WHERE id = ?`,
        [id],
      )
      const local = localRows[0]
      const incoming = Number(row.updated_at ?? 0)
      if (local) {
        if (local.dirty === 1) continue // perubahan lokal belum ke-push → menang
        if (incoming <= Number(local.updated_at ?? 0)) continue // stale
      }

      const clean: Record<string, unknown> = { dirty: 0 }
      for (const [k, v] of Object.entries(row)) {
        if (allowed.has(k)) clean[k] = v
      }
      const cols = Object.keys(clean)
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map((c) => clean[c])
      await tx.run(
        `INSERT OR REPLACE INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`,
        values,
      )
      applied++
    }
  })
  await persist()
  return applied
}
