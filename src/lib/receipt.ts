import type { Sale, SaleItem } from '@/db/types'
import type { ReceiptJob, ReceiptLine } from '@/services/capabilities/registry'
import { formatRupiah } from './money'
import { formatDateTime } from './datetime'

export interface ReceiptOpts {
  storeName: string
  storeOwner?: string
  width?: number // karakter per baris (monospace); default 32 ala thermal 58mm
}

type ReceiptErrorDetail =
  | { readonly kind: 'open-sale'; readonly number: string }
  | { readonly kind: 'missing-sold-at'; readonly number: string }

export class ReceiptError extends Error {
  readonly name = 'ReceiptError'

  constructor(readonly detail: ReceiptErrorDetail) {
    super(receiptErrorMessage(detail))
  }
}

const PAY_LABEL: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}

function receiptErrorMessage(detail: ReceiptErrorDetail): string {
  switch (detail.kind) {
    case 'open-sale':
      return `Open Bill ${detail.number} belum dapat dicetak`
    case 'missing-sold-at':
      return `Waktu pembayaran untuk transaksi ${detail.number} tidak tersedia`
  }
}

function completedSaleTime(sale: Sale): number {
  if (sale.status === 'open') {
    throw new ReceiptError({ kind: 'open-sale', number: sale.number })
  }
  const soldAt = sale.sold_at
  if (soldAt === null) {
    throw new ReceiptError({ kind: 'missing-sold-at', number: sale.number })
  }
  return soldAt
}

/** Baris dua kolom rata kiri-kanan (monospace). */
function row(left: string, right: string, width: number): string {
  const l = left.length + right.length > width ? left.slice(0, width - right.length - 1) : left
  const gap = Math.max(1, width - l.length - right.length)
  return l + ' '.repeat(gap) + right
}

/** Bangun ReceiptJob dari sale + items → dipakai printer capability apa pun. */
export function buildReceipt(
  sale: Sale,
  items: SaleItem[],
  opts: ReceiptOpts,
): ReceiptJob {
  const soldAt = completedSaleTime(sale)
  const w = opts.width ?? 32
  const div = '-'.repeat(w)
  const lines: ReceiptLine[] = []

  lines.push({ text: opts.storeName, align: 'center', bold: true, size: 'large' })
  if (opts.storeOwner) lines.push({ text: opts.storeOwner, align: 'center' })
  lines.push({ text: div })
  lines.push({ text: `No  : ${sale.number}` })
  lines.push({ text: `Tgl : ${formatDateTime(soldAt)}` })
  lines.push({ text: div })

  for (const it of items) {
    lines.push({ text: it.name_snapshot })
    lines.push({
      text: row(`  ${it.qty} x ${formatRupiah(it.price_snapshot)}`, formatRupiah(it.line_total), w),
    })
  }

  lines.push({ text: div })
  lines.push({ text: row('Subtotal', formatRupiah(sale.subtotal), w) })
  if (sale.discount > 0) {
    lines.push({ text: row('Diskon', `-${formatRupiah(sale.discount)}`, w) })
  }
  lines.push({ text: row('TOTAL', formatRupiah(sale.total), w), bold: true })
  lines.push({ text: row(PAY_LABEL[sale.payment_method] ?? 'Bayar', formatRupiah(sale.paid), w) })
  if (sale.change_due > 0) {
    lines.push({ text: row('Kembali', formatRupiah(sale.change_due), w) })
  }
  lines.push({ text: div })
  lines.push({ text: 'Terima kasih 🙏', align: 'center' })

  return { title: `Struk ${sale.number}`, lines }
}
