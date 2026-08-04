import type { Db } from '@/db/types'

/**
 * Cursor pull per-entity. `last_pulled_at` = `updated_at` terbesar yang sudah
 * ditarik dari server → dipakai jadi `since` di request pull berikutnya.
 */
export class SyncStateRepository {
  constructor(private readonly db: Db) {}

  async lastPulledAt(entity: string): Promise<number> {
    const rows = await this.db.query<{ last_pulled_at: number }>(
      `SELECT last_pulled_at FROM sync_state WHERE entity = ?`,
      [entity],
    )
    return rows[0]?.last_pulled_at ?? 0
  }

  async setLastPulledAt(entity: string, cursor: number): Promise<void> {
    await this.db.run(
      `INSERT INTO sync_state (entity, last_pulled_at) VALUES (?, ?)
       ON CONFLICT(entity) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
      [entity, cursor],
    )
  }
}
