import type { Db, OutboxRow, OutboxStatus } from '@/db/types'

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
}
