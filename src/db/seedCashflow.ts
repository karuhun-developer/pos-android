import type { Db } from './types'
import { nowMs } from '@/lib/datetime'
import { uuid } from '@/lib/uuid'

/**
 * Kategori cashflow bawaan yang **selalu dijamin ada** (dipanggil tiap boot &
 * setelah `resetLocalBusinessData`). 'Penjualan' = kategori sistem (`is_system=1`,
 * income) — tujuan otomatis pemasukan checkout ({@link file://./checkout.service.ts}
 * `CashflowCategoryRepository.systemSales`), tak bisa dihapus dari UI.
 */
export const DEFAULT_CASHFLOW_CATEGORIES: ReadonlyArray<{
  name: string
  type: 'income' | 'expense'
  isSystem: 0 | 1
}> = [
  { name: 'Penjualan', type: 'income', isSystem: 1 },
  { name: 'Modal / Setoran', type: 'income', isSystem: 0 },
  { name: 'Pendapatan Lain', type: 'income', isSystem: 0 },
  { name: 'Belanja Stok', type: 'expense', isSystem: 0 },
  { name: 'Gaji Karyawan', type: 'expense', isSystem: 0 },
  { name: 'Sewa Tempat', type: 'expense', isSystem: 0 },
  { name: 'Listrik & Air', type: 'expense', isSystem: 0 },
  { name: 'Operasional', type: 'expense', isSystem: 0 },
  { name: 'Lain-lain', type: 'expense', isSystem: 0 },
]

/**
 * Isi kategori cashflow default yang belum ada. **Idempotent by name**: kategori
 * yang namanya sudah ada (belum terhapus) dilewati, jadi aman dipanggil berulang
 * (tiap boot) tanpa bikin duplikat. Baris ditulis device-local (`dirty=1`, tanpa
 * baris `outbox`) — sama seperti seed migration, jadi default tak ikut ter-push
 * ke server. `db` bisa handle utama maupun tx migration (sama-sama `Db`).
 */
export async function seedDefaultCashflowCategories(db: Db): Promise<void> {
  const t = nowMs()
  for (let i = 0; i < DEFAULT_CASHFLOW_CATEGORIES.length; i++) {
    const c = DEFAULT_CASHFLOW_CATEGORIES[i]
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM cashflow_categories WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
      [c.name],
    )
    if (existing.length > 0) continue
    await db.run(
      `INSERT INTO cashflow_categories
         (id, name, type, is_system, sort_order, created_at, updated_at, dirty, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [uuid(), c.name, c.type, c.isSystem, i, t, t],
    )
  }
}
