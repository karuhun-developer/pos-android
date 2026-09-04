import type { Sale, SaleItem } from '@/db/types'

export interface CheckoutLine {
  readonly productId: string
  readonly name: string
  readonly price: number
  readonly qty: number
}

export interface PaymentInput {
  readonly lines: readonly CheckoutLine[]
  readonly paid: number
  readonly paymentMethod: string
  readonly discount?: number
  readonly sessionId?: string | null
}

export interface CheckoutInput extends PaymentInput {
  readonly devicePrefix: string
}

export interface OpenBillAccessInput {
  readonly saleId: string
  readonly deviceId: string
}

export interface OpenBillLabelInput {
  readonly label?: string | null
  readonly note?: string | null
}

export interface HoldOpenBillInput extends OpenBillLabelInput {
  readonly lines: readonly CheckoutLine[]
  readonly discount?: number
  readonly devicePrefix: string
  readonly deviceId: string
}

export interface ReholdOpenBillInput extends OpenBillAccessInput, OpenBillLabelInput {
  readonly lines: readonly CheckoutLine[]
  readonly discount?: number
}

export interface CompleteOpenBillInput extends PaymentInput, OpenBillAccessInput {}

export interface CheckoutResult {
  readonly sale: Sale
  readonly items: SaleItem[]
}

export interface SaleAmounts {
  readonly subtotal: number
  readonly discount: number
  readonly total: number
}

export type CheckoutErrorDetail =
  | { readonly kind: 'empty-cart' }
  | { readonly kind: 'invalid-input'; readonly reason: string }
  | { readonly kind: 'sale-not-found'; readonly saleId: string }
  | { readonly kind: 'sale-not-open'; readonly saleId: string }
  | { readonly kind: 'foreign-device'; readonly saleId: string }
  | { readonly kind: 'product-missing'; readonly productId: string }
  | { readonly kind: 'product-deleted'; readonly productId: string }
  | { readonly kind: 'product-inactive'; readonly productId: string }
  | {
      readonly kind: 'insufficient-stock'
      readonly productId: string
      readonly requested: number
      readonly available: number
    }

export class CheckoutError extends Error {
  readonly name = 'CheckoutError'
  readonly kind: CheckoutErrorDetail['kind']

  constructor(readonly detail: CheckoutErrorDetail) {
    super(checkoutErrorMessage(detail))
    this.kind = detail.kind
  }
}

function checkoutErrorMessage(detail: CheckoutErrorDetail): string {
  switch (detail.kind) {
    case 'empty-cart':
      return 'Keranjang kosong'
    case 'invalid-input':
      return detail.reason
    case 'sale-not-found':
      return `Open Bill ${detail.saleId} tidak ditemukan`
    case 'sale-not-open':
      return `Open Bill ${detail.saleId} sudah tidak aktif`
    case 'foreign-device':
      return `Perangkat ini tidak dapat mengubah Open Bill ${detail.saleId}`
    case 'product-missing':
      return `Produk ${detail.productId} tidak ditemukan`
    case 'product-deleted':
      return `Produk ${detail.productId} sudah dihapus`
    case 'product-inactive':
      return `Produk ${detail.productId} tidak aktif`
    case 'insufficient-stock':
      return `Stok produk ${detail.productId} tidak cukup (${detail.available}/${detail.requested})`
    default:
      return assertNever(detail)
  }
}

function assertNever(value: never): never {
  throw new CheckoutError({
    kind: 'invalid-input',
    reason: `Checkout state tidak dikenal: ${JSON.stringify(value)}`,
  })
}

export function saleAmounts(
  lines: readonly CheckoutLine[],
  requestedDiscount: number | undefined,
): SaleAmounts {
  if (lines.length === 0) throw new CheckoutError({ kind: 'empty-cart' })
  for (const line of lines) {
    if (
      !Number.isSafeInteger(line.price) ||
      line.price < 0 ||
      !Number.isSafeInteger(line.qty) ||
      line.qty <= 0 ||
      line.productId.trim().length === 0
    ) {
      throw new CheckoutError({ kind: 'invalid-input', reason: 'Baris keranjang tidak valid' })
    }
  }
  const discount = requestedDiscount ?? 0
  if (!Number.isSafeInteger(discount) || discount < 0) {
    throw new CheckoutError({ kind: 'invalid-input', reason: 'Diskon tidak valid' })
  }
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const appliedDiscount = Math.min(discount, subtotal)
  return { subtotal, discount: appliedDiscount, total: subtotal - appliedDiscount }
}

export function assertPayment(input: PaymentInput): void {
  if (!Number.isSafeInteger(input.paid) || input.paid < 0) {
    throw new CheckoutError({ kind: 'invalid-input', reason: 'Nominal pembayaran tidak valid' })
  }
  if (input.paymentMethod.trim().length === 0) {
    throw new CheckoutError({ kind: 'invalid-input', reason: 'Metode pembayaran wajib diisi' })
  }
}

export function assertDeviceId(deviceId: string): void {
  if (deviceId.trim().length === 0) {
    throw new CheckoutError({ kind: 'invalid-input', reason: 'ID perangkat wajib diisi' })
  }
}
