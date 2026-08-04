import type { Db, SettingRow } from '@/db/types'
import { persist } from '@/db/sqlite'
import { nowMs } from '@/lib/datetime'

/** Key-value store buat pengaturan app. Bukan SyncEntity penuh, tapi tetap
 *  punya updated_at + dirty supaya bisa ikut sync. */
export class SettingsRepository {
  constructor(private readonly db: Db) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.query<SettingRow>('SELECT key, value FROM settings')
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    return out
  }

  async get(key: string): Promise<string | null> {
    const rows = await this.db.query<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    )
    return rows[0]?.value ?? null
  }

  async set(key: string, value: string): Promise<void> {
    const t = nowMs()
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at, dirty, sync_version)
       VALUES (?, ?, ?, 1, 0)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 1`,
      [key, value, t],
    )
    await persist()
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    await this.db.transaction(async (tx) => {
      const t = nowMs()
      for (const [key, value] of Object.entries(entries)) {
        await tx.run(
          `INSERT INTO settings (key, value, updated_at, dirty, sync_version)
           VALUES (?, ?, ?, 1, 0)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 1`,
          [key, value, t],
        )
      }
    })
    await persist()
  }
}
