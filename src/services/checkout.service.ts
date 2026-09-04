import type { Db } from '@/db/types'
import { persist } from '@/db/sqlite'
import { nowMs } from '@/lib/datetime'
import { SaleItemRepository } from '@/repositories/saleItem.repo'
import { SaleRepository } from '@/repositories/sale.repo'
import {
  assertPayment,
  CheckoutError,
  saleAmounts,
  type CheckoutInput,
  type CheckoutResult,
  type CompleteOpenBillInput,
  type HoldOpenBillInput,
  type OpenBillAccessInput,
  type ReholdOpenBillInput,
} from '@/services/checkout.contract'
import { OpenBillService } from '@/services/openBill.service'
import {
  applySaleStock,
  createSaleCashflow,
  validateSaleStock,
} from '@/services/saleCompletion.service'

export {
  CheckoutError,
  type CheckoutInput,
  type CheckoutLine,
  type CheckoutResult,
  type CompleteOpenBillInput,
  type HoldOpenBillInput,
  type OpenBillAccessInput,
  type OpenBillLabelInput,
  type PaymentInput,
  type ReholdOpenBillInput,
} from '@/services/checkout.contract'

export class CheckoutService {
  private readonly openBills: OpenBillService

  constructor(private readonly db: Db) {
    this.openBills = new OpenBillService(db)
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const amounts = saleAmounts(input.lines, input.discount)
    assertPayment(input)
    if (input.devicePrefix.trim().length === 0) {
      throw new CheckoutError({ kind: 'invalid-input', reason: 'Prefix perangkat wajib diisi' })
    }
    const occurredAt = nowMs()
    const result = await this.db.transaction(async (tx) => {
      const stock = await validateSaleStock(tx, input.lines)
      const sales = new SaleRepository(tx)
      const sale = await sales.create({
        session_id: input.sessionId ?? null,
        number: await sales.nextNumber(input.devicePrefix, occurredAt),
        subtotal: amounts.subtotal,
        discount: amounts.discount,
        tax: 0,
        total: amounts.total,
        paid: input.paid,
        change_due: Math.max(0, input.paid - amounts.total),
        payment_method: input.paymentMethod,
        status: 'completed',
        open_bill_label: null,
        opened_at: null,
        origin_device_id: null,
        sold_at: occurredAt,
      })
      const items = await new SaleItemRepository(tx).createSnapshots(sale.id, input.lines)
      await applySaleStock(tx, stock)
      await createSaleCashflow(tx, sale, occurredAt)
      return { sale, items }
    })
    await persist()
    return result
  }

  hold(input: HoldOpenBillInput): Promise<CheckoutResult> {
    return this.openBills.hold(input)
  }

  viewOpenBill(saleId: string): Promise<CheckoutResult> {
    return this.openBills.view(saleId)
  }

  resume(input: OpenBillAccessInput): Promise<CheckoutResult> {
    return this.openBills.resume(input)
  }

  rehold(input: ReholdOpenBillInput): Promise<CheckoutResult> {
    return this.openBills.rehold(input)
  }

  discard(input: OpenBillAccessInput): Promise<void> {
    return this.openBills.discard(input)
  }

  completeOpenBill(input: CompleteOpenBillInput): Promise<CheckoutResult> {
    return this.openBills.complete(input)
  }
}
