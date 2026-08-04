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
}
