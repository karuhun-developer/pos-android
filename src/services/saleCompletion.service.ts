import type { Db, Product, Sale } from '@/db/types'
import { CashflowCategoryRepository } from '@/repositories/cashflowCategory.repo'
import { CashflowEntryRepository } from '@/repositories/cashflowEntry.repo'
import { ProductRepository } from '@/repositories/product.repo'
import { CheckoutError, type CheckoutLine } from '@/services/checkout.contract'

export interface StockAdjustment {
  readonly product: Product
  readonly qty: number
}

export async function validateSaleStock(
  db: Db,
  lines: readonly CheckoutLine[],
): Promise<readonly StockAdjustment[]> {
  const quantities = new Map<string, number>()
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.qty)
  }
  const productIds = Array.from(quantities.keys())
  const products = await db.query<Product>(
    `SELECT * FROM products WHERE id IN (${productIds.map(() => '?').join(', ')})`,
    productIds,
  )
  const byId = new Map(products.map((product) => [product.id, product]))
  const adjustments: StockAdjustment[] = []
  for (const [productId, qty] of quantities) {
    const product = byId.get(productId)
    if (product === undefined) throw new CheckoutError({ kind: 'product-missing', productId })
    if (product.deleted_at !== null) throw new CheckoutError({ kind: 'product-deleted', productId })
    if (product.active === 0) throw new CheckoutError({ kind: 'product-inactive', productId })
    if (product.track_stock !== 0) {
      if (product.stock < qty) {
        throw new CheckoutError({
          kind: 'insufficient-stock',
          productId,
          requested: qty,
          available: product.stock,
        })
      }
      adjustments.push({ product, qty })
    }
  }
  return adjustments
}

export async function applySaleStock(
  db: Db,
  adjustments: readonly StockAdjustment[],
): Promise<void> {
  const repository = new ProductRepository(db)
  for (const adjustment of adjustments) {
    const updated = await repository.update(adjustment.product.id, {
      stock: adjustment.product.stock - adjustment.qty,
    })
    if (updated === null) {
      throw new CheckoutError({ kind: 'product-missing', productId: adjustment.product.id })
    }
  }
}

export async function createSaleCashflow(
  db: Db,
  sale: Sale,
  occurredAt: number,
): Promise<void> {
  const category = await new CashflowCategoryRepository(db).systemSales()
  await new CashflowEntryRepository(db).create({
    category_id: category?.id ?? null,
    session_id: sale.session_id,
    direction: 'debit',
    amount: sale.total,
    source: 'sale',
    source_ref: sale.id,
    note: `Penjualan ${sale.number}`,
    occurred_at: occurredAt,
  })
}
