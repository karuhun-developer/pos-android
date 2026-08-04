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
}
