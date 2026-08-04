import { BaseRepository } from '@/db/BaseRepository'
import type { CashflowCategory } from '@/db/types'

export class CashflowCategoryRepository extends BaseRepository<CashflowCategory> {
  protected readonly table = 'cashflow_categories'

  listAll(): Promise<CashflowCategory[]> {
    return this.list({ orderBy: 'type ASC, sort_order ASC, name ASC' })
  }

  /** Kategori sistem 'Penjualan' (income) — tujuan otomatis pemasukan checkout. */
  async systemSales(): Promise<CashflowCategory | null> {
    const rows = await this.list({
      where: "is_system = 1 AND type = 'income'",
      orderBy: 'sort_order ASC',
    })
    return rows[0] ?? null
  }
}
