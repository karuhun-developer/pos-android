import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product } from '@/db/types'

export interface CartLine {
  productId: string
  name: string
  price: number // snapshot harga jual (minor units)
  qty: number
  image_path: string | null
  track_stock: number
  stock: number
}

export interface CartSnapshot {
  readonly lines: readonly CartLine[]
  readonly discount: number
}

export interface ActiveOpenBill {
  readonly id: string
  readonly label: string | null
}

export interface OpenBillCartState {
  readonly bill: ActiveOpenBill
  readonly snapshot: CartSnapshot
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  const discount = ref(0)
  const activeOpenBillId = ref<string | null>(null)
  const activeOpenBillLabel = ref<string | null>(null)

  const count = computed(() => lines.value.reduce((s, l) => s + l.qty, 0))
  const subtotal = computed(() => lines.value.reduce((s, l) => s + l.price * l.qty, 0))
  const total = computed(() => Math.max(0, subtotal.value - discount.value))
  const isEmpty = computed(() => lines.value.length === 0)

  /** Batas qty: kalau produk track_stock, gak boleh lebih dari stok. */
  function maxQty(line: CartLine): number {
    return line.track_stock ? Math.max(0, line.stock) : Infinity
  }

  function find(productId: string) {
    return lines.value.find((l) => l.productId === productId)
  }

  function add(p: Product) {
    const existing = find(p.id)
    if (existing) {
      if (existing.qty < maxQty(existing)) existing.qty++
      return
    }
    if (p.track_stock && p.stock <= 0) return // habis
    lines.value.push({
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: 1,
      image_path: p.image_path,
      track_stock: p.track_stock,
      stock: p.stock,
    })
  }

  function inc(productId: string) {
    const l = find(productId)
    if (l && l.qty < maxQty(l)) l.qty++
  }

  function dec(productId: string) {
    const l = find(productId)
    if (!l) return
    l.qty--
    if (l.qty <= 0) remove(productId)
  }

  function remove(productId: string) {
    lines.value = lines.value.filter((l) => l.productId !== productId)
  }

  function clear() {
    lines.value = []
    discount.value = 0
    activeOpenBillId.value = null
    activeOpenBillLabel.value = null
  }

  function snapshot(): CartSnapshot {
    return {
      lines: lines.value.map((line) => ({ ...line })),
      discount: discount.value,
    }
  }

  function restore(next: CartSnapshot) {
    lines.value = next.lines.map((line) => ({ ...line }))
    discount.value = next.discount
  }

  function markOpenBill(bill: ActiveOpenBill) {
    activeOpenBillId.value = bill.id
    activeOpenBillLabel.value = bill.label
  }

  function loadOpenBill(next: OpenBillCartState) {
    restore(next.snapshot)
    markOpenBill(next.bill)
  }

  return {
    lines,
    discount,
    activeOpenBillId,
    activeOpenBillLabel,
    count,
    subtotal,
    total,
    isEmpty,
    maxQty,
    find,
    add,
    inc,
    dec,
    remove,
    clear,
    snapshot,
    restore,
    markOpenBill,
    loadOpenBill,
  }
})
