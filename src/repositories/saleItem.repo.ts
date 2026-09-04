import { BaseRepository } from '@/db/BaseRepository'
import type { SaleItem } from '@/db/types'

export interface SaleItemSnapshot {
  readonly productId: string
  readonly name: string
  readonly price: number
  readonly qty: number
}

export class SaleItemRepository extends BaseRepository<SaleItem> {
  protected readonly table = 'sale_items'

  bySale(saleId: string): Promise<SaleItem[]> {
    return this.list({
      where: 'sale_id = ?',
      params: [saleId],
      orderBy: 'created_at ASC',
    })
  }

  async createSnapshots(
    saleId: string,
    snapshots: readonly SaleItemSnapshot[],
  ): Promise<SaleItem[]> {
    const items: SaleItem[] = []
    for (const snapshot of snapshots) {
      const item = await this.create({
        sale_id: saleId,
        product_id: snapshot.productId,
        name_snapshot: snapshot.name,
        price_snapshot: snapshot.price,
        qty: snapshot.qty,
        discount: 0,
        line_total: snapshot.price * snapshot.qty,
      })
      items.push(item)
    }
    return items
  }

  async tombstoneActiveBySale(saleId: string): Promise<void> {
    const activeItems = await this.bySale(saleId)
    for (const item of activeItems) {
      await this.softDelete(item.id)
    }
  }

  async replaceActiveSnapshots(
    saleId: string,
    snapshots: readonly SaleItemSnapshot[],
  ): Promise<SaleItem[]> {
    await this.tombstoneActiveBySale(saleId)
    return this.createSnapshots(saleId, snapshots)
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
