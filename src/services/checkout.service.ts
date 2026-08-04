import type { Db, Sale, SaleItem } from '@/db/types'
import { persist } from '@/db/sqlite'
import { SaleRepository } from '@/repositories/sale.repo'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { ProductRepository } from '@/repositories/product.repo'
import { CashflowCategoryRepository } from '@/repositories/cashflowCategory.repo'
import { CashflowEntryRepository } from '@/repositories/cashflowEntry.repo'
import { nowMs } from '@/lib/datetime'

export interface CheckoutLine {
  productId: string
  name: string
  price: number // minor units, snapshot
  qty: number
}

export interface CheckoutInput {
  lines: CheckoutLine[]
  paid: number
  paymentMethod: string // 'cash' | 'qris' | 'transfer'
  discount?: number
  sessionId?: string | null
  devicePrefix: string
}

export interface CheckoutResult {
  sale: Sale
  items: SaleItem[]
}

/**
 * Orkestrasi checkout dalam SATU transaksi atomic:
 *   sales + sale_items + kurangi stok + cashflow income 'Penjualan'.
 * Semua repo dibangun di atas `tx` supaya transaksi BaseRepository yang
 * reentrant ikut nyatu (satu BEGIN…COMMIT, satu rollback kalau gagal).
 * Tiap create juga nulis baris outbox → seluruh checkout langsung sync-ready.
 */
export class CheckoutService {
  constructor(private readonly db: Db) {}

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!input.lines.length) throw new Error('Keranjang kosong')
    const t = nowMs()

    const result = await this.db.transaction(async (tx) => {
      const salesRepo = new SaleRepository(tx)
      const itemsRepo = new SaleItemRepository(tx)
      const productsRepo = new ProductRepository(tx)
      const cashflowCatRepo = new CashflowCategoryRepository(tx)
      const cashflowRepo = new CashflowEntryRepository(tx)

      const subtotal = input.lines.reduce((s, l) => s + l.price * l.qty, 0)
      const discount = Math.min(input.discount ?? 0, subtotal)
      const total = subtotal - discount // v1 tanpa pajak
      const paid = input.paid
      const change = Math.max(0, paid - total)
      const number = await salesRepo.nextNumber(input.devicePrefix, t)

      const sale = await salesRepo.create({
        session_id: input.sessionId ?? null,
        number,
        subtotal,
        discount,
        tax: 0,
        total,
        paid,
        change_due: change,
        payment_method: input.paymentMethod,
        status: 'completed',
        sold_at: t,
      })

      const items: SaleItem[] = []
      for (const l of input.lines) {
        const item = await itemsRepo.create({
          sale_id: sale.id,
          product_id: l.productId,
          name_snapshot: l.name,
          price_snapshot: l.price,
          qty: l.qty,
          discount: 0,
          line_total: l.price * l.qty,
        })
        items.push(item)
        // Kurangi stok (adjustStock no-op utk produk non-track_stock).
        await productsRepo.adjustStock(l.productId, -l.qty)
      }

      // Catat pemasukan ke ledger (kategori sistem 'Penjualan').
      const salesCat = await cashflowCatRepo.systemSales()
      await cashflowRepo.create({
        category_id: salesCat?.id ?? null,
        session_id: input.sessionId ?? null,
        direction: 'debit', // uang masuk
        amount: total,
        source: 'sale',
        source_ref: sale.id,
        note: `Penjualan ${number}`,
        occurred_at: t,
      })

      return { sale, items }
    })

    // Persist sekali setelah transaksi terluar commit (repo nunda persist
    // saat di dalam transaksi).
    await persist()
    return result
  }
}
