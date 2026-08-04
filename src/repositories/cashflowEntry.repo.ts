import { BaseRepository } from '@/db/BaseRepository'
import type { CashflowEntry } from '@/db/types'

export class CashflowEntryRepository extends BaseRepository<CashflowEntry> {
  protected readonly table = 'cashflow_entries'

  listRecent(limit = 100): Promise<CashflowEntry[]> {
    return this.db.query<CashflowEntry>(
      `SELECT * FROM cashflow_entries WHERE deleted_at IS NULL
       ORDER BY occurred_at DESC LIMIT ?`,
      [limit],
    )
  }

  /** Entri dalam rentang `occurred_at` (inklusif) — buat filter tanggal. */
  listBetween(from: number, to: number, limit = 2000): Promise<CashflowEntry[]> {
    return this.db.query<CashflowEntry>(
      `SELECT * FROM cashflow_entries WHERE deleted_at IS NULL AND occurred_at BETWEEN ? AND ?
       ORDER BY occurred_at DESC LIMIT ?`,
      [from, to, limit],
    )
  }
}
