import { BaseRepository } from '@/db/BaseRepository'
import type { SaleItem } from '@/db/types'

export class SaleItemRepository extends BaseRepository<SaleItem> {
  protected readonly table = 'sale_items'

  bySale(saleId: string): Promise<SaleItem[]> {
    return this.list({
      where: 'sale_id = ?',
      params: [saleId],
      orderBy: 'created_at ASC',
    })
  }

  /** Item + info struk (nomor & waktu) untuk rentang tanggal — dipakai export. */
  listBetween(
    from: number,
    to: number,
    limit = 100000,
  ): Promise<(SaleItem & { number: string; sold_at: number })[]> {
    return this.db.query<SaleItem & { number: string; sold_at: number }>(
      `SELECT si.*, s.number AS number, s.sold_at AS sold_at
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.deleted_at IS NULL AND s.deleted_at IS NULL AND s.sold_at BETWEEN ? AND ?
       ORDER BY s.sold_at DESC, si.created_at ASC LIMIT ?`,
      [from, to, limit],
    )
  }
}
