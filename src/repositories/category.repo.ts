import { BaseRepository } from '@/db/BaseRepository'
import type { Category } from '@/db/types'

export class CategoryRepository extends BaseRepository<Category> {
  protected readonly table = 'categories'

  listAll(): Promise<Category[]> {
    return this.list({ orderBy: 'sort_order ASC, name ASC' })
  }
}
