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

  /**
   * Cari produk lewat barcode persis (mode scan kasir).
   * Barcode gak dijamin unik di DB — kalau kebetulan dobel, yang aktif menang.
   */
  async findByBarcode(code: string): Promise<Product | null> {
    const rows = await this.list({
      where: 'barcode = ?',
      params: [code],
      orderBy: 'active DESC, name ASC',
    })
    return rows[0] ?? null
  }

  /** Kurangi/tambah stok (dipakai checkout Phase 2). */
  async adjustStock(id: string, delta: number): Promise<void> {
    const p = await this.findById(id)
    if (!p || !p.track_stock) return
    await this.update(id, { stock: p.stock + delta } as Partial<Product>)
  }
}
