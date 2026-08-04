import { BaseRepository } from '@/db/BaseRepository'
import type { Product } from '@/db/types'

export class ProductRepository extends BaseRepository<Product> {
  protected readonly table = 'products'

  listAll(): Promise<Product[]> {
    return this.list({ orderBy: 'name ASC' })
  }

  byCategory(categoryId: string): Promise<Product[]> {
    return this.list({
      where: 'category_id = ?',
      params: [categoryId],
      orderBy: 'name ASC',
    })
  }

  search(term: string): Promise<Product[]> {
    const q = `%${term}%`
    return this.list({
      where: '(name LIKE ? OR sku LIKE ? OR barcode LIKE ?)',
      params: [q, q, q],
      orderBy: 'name ASC',
    })
  }

  /** Kurangi/tambah stok (dipakai checkout Phase 2). */
  async adjustStock(id: string, delta: number): Promise<void> {
    const p = await this.findById(id)
    if (!p || !p.track_stock) return
    await this.update(id, { stock: p.stock + delta } as Partial<Product>)
  }
}
