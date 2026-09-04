import type { Db, Sale } from '@/db/types'
import { persist } from '@/db/sqlite'
import { nowMs } from '@/lib/datetime'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { SaleRepository } from '@/repositories/sale.repo'
import {
  assertDeviceId,
  assertPayment,
  CheckoutError,
  saleAmounts,
  type CheckoutResult,
  type CompleteOpenBillInput,
  type HoldOpenBillInput,
  type OpenBillAccessInput,
  type OpenBillLabelInput,
  type ReholdOpenBillInput,
} from '@/services/checkout.contract'
import {
  applySaleStock,
  createSaleCashflow,
  validateSaleStock,
} from '@/services/saleCompletion.service'

function openBillLabel(sale: Sale, input: OpenBillLabelInput): string | null {
  if (input.label !== undefined) return input.label
  if (input.note !== undefined) return input.note
  return sale.open_bill_label
}

function assertOrigin(sale: Sale, deviceId: string): void {
  if (sale.origin_device_id !== deviceId) {
    throw new CheckoutError({ kind: 'foreign-device', saleId: sale.id })
  }
}

async function findOpenBill(repository: SaleRepository, saleId: string): Promise<Sale> {
  const sale = await repository.findById(saleId)
  if (sale === null) throw new CheckoutError({ kind: 'sale-not-found', saleId })
  if (sale.status !== 'open') throw new CheckoutError({ kind: 'sale-not-open', saleId })
  return sale
}

export class OpenBillService {
  constructor(private readonly db: Db) {}

  async hold(input: HoldOpenBillInput): Promise<CheckoutResult> {
    const amounts = saleAmounts(input.lines, input.discount)
    assertDeviceId(input.deviceId)
    if (input.devicePrefix.trim().length === 0) {
      throw new CheckoutError({ kind: 'invalid-input', reason: 'Prefix perangkat wajib diisi' })
    }
    const openedAt = nowMs()
    const result = await this.db.transaction(async (tx) => {
      const sales = new SaleRepository(tx)
      const sale = await sales.create({
        session_id: null,
        number: await sales.nextNumber(input.devicePrefix, openedAt),
        subtotal: amounts.subtotal,
        discount: amounts.discount,
        tax: 0,
        total: amounts.total,
        paid: 0,
        change_due: 0,
        payment_method: 'cash',
        status: 'open',
        open_bill_label: input.label ?? input.note ?? null,
        opened_at: openedAt,
        origin_device_id: input.deviceId,
        sold_at: null,
      })
      const items = await new SaleItemRepository(tx).createSnapshots(sale.id, input.lines)
      return { sale, items }
    })
    await persist()
    return result
  }

  async view(saleId: string): Promise<CheckoutResult> {
    const sale = await findOpenBill(new SaleRepository(this.db), saleId)
    const items = await new SaleItemRepository(this.db).bySale(sale.id)
    return { sale, items }
  }

  async resume(input: OpenBillAccessInput): Promise<CheckoutResult> {
    assertDeviceId(input.deviceId)
    const result = await this.view(input.saleId)
    assertOrigin(result.sale, input.deviceId)
    return result
  }

  async rehold(input: ReholdOpenBillInput): Promise<CheckoutResult> {
    const amounts = saleAmounts(input.lines, input.discount)
    assertDeviceId(input.deviceId)
    const result = await this.db.transaction(async (tx) => {
      const sales = new SaleRepository(tx)
      const sale = await findOpenBill(sales, input.saleId)
      assertOrigin(sale, input.deviceId)
      const updated = await sales.update(sale.id, {
        subtotal: amounts.subtotal,
        discount: amounts.discount,
        tax: 0,
        total: amounts.total,
        open_bill_label: openBillLabel(sale, input),
      })
      if (updated === null) throw new CheckoutError({ kind: 'sale-not-found', saleId: sale.id })
      const items = await new SaleItemRepository(tx).replaceActiveSnapshots(sale.id, input.lines)
      return { sale: updated, items }
    })
    await persist()
    return result
  }

  async discard(input: OpenBillAccessInput): Promise<void> {
    assertDeviceId(input.deviceId)
    await this.db.transaction(async (tx) => {
      const sales = new SaleRepository(tx)
      const sale = await findOpenBill(sales, input.saleId)
      assertOrigin(sale, input.deviceId)
      await sales.softDelete(sale.id)
      await new SaleItemRepository(tx).tombstoneActiveBySale(sale.id)
    })
    await persist()
  }

  async complete(input: CompleteOpenBillInput): Promise<CheckoutResult> {
    const amounts = saleAmounts(input.lines, input.discount)
    assertPayment(input)
    assertDeviceId(input.deviceId)
    const occurredAt = nowMs()
    const result = await this.db.transaction(async (tx) => {
      const sales = new SaleRepository(tx)
      const sale = await findOpenBill(sales, input.saleId)
      assertOrigin(sale, input.deviceId)
      const stock = await validateSaleStock(tx, input.lines)
      const updated = await sales.update(sale.id, {
        session_id: input.sessionId ?? null,
        subtotal: amounts.subtotal,
        discount: amounts.discount,
        tax: 0,
        total: amounts.total,
        paid: input.paid,
        change_due: Math.max(0, input.paid - amounts.total),
        payment_method: input.paymentMethod,
        status: 'completed',
        sold_at: occurredAt,
      })
      if (updated === null) throw new CheckoutError({ kind: 'sale-not-found', saleId: sale.id })
      const items = await new SaleItemRepository(tx).replaceActiveSnapshots(sale.id, input.lines)
      await applySaleStock(tx, stock)
      await createSaleCashflow(tx, updated, occurredAt)
      return { sale: updated, items }
    })
    await persist()
    return result
  }
}
