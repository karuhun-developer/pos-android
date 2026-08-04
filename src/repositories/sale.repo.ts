import { BaseRepository } from '@/db/BaseRepository'
import type { Sale } from '@/db/types'
import { dayKey } from '@/lib/datetime'

export class SaleRepository extends BaseRepository<Sale> {
  protected readonly table = 'sales'

  /** Transaksi terbaru (default 50), termasuk void — buat riwayat. */
  listRecent(limit = 50): Promise<Sale[]> {
    return this.db.query<Sale>(
      `SELECT * FROM sales WHERE deleted_at IS NULL ORDER BY sold_at DESC LIMIT ?`,
      [limit],
    )
  }

  /**
   * Nomor struk device-prefixed: `<PREFIX>-<YYYYMMDD>-<seq>`.
   * seq = jumlah struk device+hari ini + 1, jadi unik & urut walau offline.
   */
  async nextNumber(prefix: string, t: number): Promise<string> {
    const base = `${prefix}-${dayKey(t).replace(/-/g, '')}`
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sales WHERE number LIKE ?`,
      [`${base}-%`],
    )
    const seq = (rows[0]?.n ?? 0) + 1
    return `${base}-${String(seq).padStart(3, '0')}`
  }
}
