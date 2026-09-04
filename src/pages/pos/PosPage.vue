<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CartSheet from '@/components/pos/CartSheet.vue'
import OpenBillsSheet from '@/components/pos/OpenBillsSheet.vue'
import PaymentDialog from '@/components/pos/PaymentDialog.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Package, Search, ShoppingCart, Check, Printer, PlusCircle, DoorOpen, DoorClosed, ScanLine,
  ReceiptText, Trash2, X,
} from 'lucide-vue-next'
import { useProductsStore } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'
import { useMediaStore } from '@/stores/media'
import { useCartStore } from '@/stores/cart'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import { useCashierStore } from '@/stores/cashier'
import { usePrinterStore } from '@/stores/printer'
import { capabilities } from '@/services/capabilities/registry'
import type { PrinterCapability } from '@/services/capabilities/registry'
import { CheckoutError, type CheckoutResult } from '@/services/checkout.service'
import type { CartLine } from '@/stores/cart'
import type { Sale } from '@/db/types'
import { buildReceipt } from '@/lib/receipt'
import { formatRupiah } from '@/lib/money'
import { cn } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()
const media = useMediaStore()
const cart = useCartStore()
const sales = useSalesStore()
const settings = useSettingsStore()
const cashier = useCashierStore()
const { filtered, query, categoryFilter } = storeToRefs(products)
const { openBills } = storeToRefs(sales)

const showCart = ref(false)
const showPayment = ref(false)
const showOpenBills = ref(false)
const showHoldForm = ref(false)
const showDiscardConfirm = ref(false)
const paying = ref(false)
const holding = ref(false)
const success = ref(false)
const scannerReady = ref(false)
const lastResult = ref<CheckoutResult | null>(null)
const holdLabel = ref('')
const selectedDiscardBill = ref<Sale | null>(null)
const openBillBusyId = ref<string | null>(null)
const operationError = ref<string | null>(null)

const headerSubtitle = computed(() => {
  if (cart.activeOpenBillId) {
    return `Open Bill: ${cart.activeOpenBillLabel ?? cart.activeOpenBillId}`
  }
  return cart.count ? `${cart.count} item di keranjang` : 'Ketuk produk untuk menambah'
})

onMounted(async () => {
  scannerReady.value = await capabilities.has('scanner')
  await Promise.all([products.load(), categories.load(), cashier.load()])
  await media.ensure(products.items.map((p) => p.image_path))

  // Balik dari mode scan lewat tombol Bayar (/pos?pay=1): langsung buka dialog
  // pembayaran. Checkout tetap satu jalur di halaman ini — gak ada duplikasi.
  if (route.query.pay === '1') {
    void router.replace('/pos')
    if (!cart.isEmpty) showPayment.value = true
  }
})

function setFilter(id: string | null) {
  categoryFilter.value = categoryFilter.value === id ? null : id
}

function soldOut(stock: number, track: number) {
  return !!track && stock <= 0
}

function checkoutLines() {
  return cart.lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    price: line.price,
    qty: line.qty,
  }))
}

async function refreshPosState() {
  await products.load()
  await media.ensure(products.items.map((product) => product.image_path))
  await cashier.refreshSummary()
}

function openHoldForm() {
  operationError.value = null
  holdLabel.value = cart.activeOpenBillLabel ?? ''
  showHoldForm.value = true
}

async function submitHold() {
  if (cart.isEmpty || holding.value) return

  holding.value = true
  operationError.value = null
  try {
    const label = holdLabel.value.trim() || null
    if (cart.activeOpenBillId) {
      await sales.rehold({
        saleId: cart.activeOpenBillId,
        deviceId: settings.deviceId,
        lines: checkoutLines(),
        discount: cart.discount,
        label,
      })
    } else {
      await sales.hold({
        lines: checkoutLines(),
        discount: cart.discount,
        devicePrefix: settings.devicePrefix || 'POS',
        deviceId: settings.deviceId,
        label,
      })
    }
    cart.clear()
    showHoldForm.value = false
    showCart.value = false
    await refreshPosState()
  } catch (error) {
    if (error instanceof CheckoutError) {
      operationError.value = error.message
      return
    }
    throw error
  } finally {
    holding.value = false
  }
}

async function openOpenBills() {
  operationError.value = null
  showCart.value = false
  showOpenBills.value = true
  await sales.load()
}

function restoreOpenBill(result: CheckoutResult): boolean {
  const lines: CartLine[] = []
  for (const item of result.items) {
    if (item.product_id === null) return false
    const product = products.items.find((entry) => entry.id === item.product_id)
    lines.push({
      productId: item.product_id,
      name: item.name_snapshot,
      price: item.price_snapshot,
      qty: item.qty,
      image_path: product?.image_path ?? null,
      track_stock: product?.track_stock ?? 0,
      stock: product?.stock ?? 0,
    })
  }

  cart.loadOpenBill({
    bill: {
      id: result.sale.id,
      label: result.sale.open_bill_label ?? result.sale.number,
    },
    snapshot: { lines, discount: result.sale.discount },
  })
  return true
}

async function resumeOpenBill(bill: Sale) {
  if (!cart.isEmpty) {
    operationError.value = 'Kosongkan atau tahan keranjang aktif sebelum melanjutkan Open Bill lain.'
    return
  }

  openBillBusyId.value = bill.id
  operationError.value = null
  try {
    const result = await sales.resume({ saleId: bill.id, deviceId: settings.deviceId })
    if (!restoreOpenBill(result)) {
      operationError.value = 'Open Bill tidak dapat dilanjutkan karena ada item tanpa produk.'
      return
    }
    showOpenBills.value = false
    showCart.value = true
  } catch (error) {
    if (error instanceof CheckoutError) {
      operationError.value = error.message
      return
    }
    throw error
  } finally {
    openBillBusyId.value = null
  }
}

function requestDiscardOpenBill(bill: Sale) {
  if (settings.deviceId === '' || bill.origin_device_id !== settings.deviceId) {
    operationError.value = 'Open Bill dari perangkat lain hanya dapat dilihat.'
    return
  }
  operationError.value = null
  selectedDiscardBill.value = bill
  showDiscardConfirm.value = true
}

async function discardOpenBill() {
  const bill = selectedDiscardBill.value
  if (bill === null || openBillBusyId.value !== null) return

  openBillBusyId.value = bill.id
  operationError.value = null
  try {
    await sales.discard({ saleId: bill.id, deviceId: settings.deviceId })
    if (cart.activeOpenBillId === bill.id) cart.clear()
    selectedDiscardBill.value = null
    showDiscardConfirm.value = false
  } catch (error) {
    if (error instanceof CheckoutError) {
      operationError.value = error.message
      return
    }
    throw error
  } finally {
    openBillBusyId.value = null
  }
}

async function pay({ paid, paymentMethod }: { paid: number; paymentMethod: string }) {
  paying.value = true
  operationError.value = null
  try {
    const activeOpenBillId = cart.activeOpenBillId
    const payment = {
      lines: checkoutLines(),
      paid,
      paymentMethod,
      discount: cart.discount,
      sessionId: cashier.current?.id ?? null,
    }
    const res = activeOpenBillId
      ? await sales.completeOpenBill({
          ...payment,
          saleId: activeOpenBillId,
          deviceId: settings.deviceId,
        })
      : await sales.checkout({
          ...payment,
          devicePrefix: settings.devicePrefix || 'POS',
        })
    lastResult.value = res
    showPayment.value = false
    showCart.value = false
    cart.clear()
    await refreshPosState()
    success.value = true
  } catch (error) {
    if (error instanceof CheckoutError) {
      operationError.value = error.message
      return
    }
    throw error
  } finally {
    paying.value = false
  }
}

async function printReceipt() {
  if (!lastResult.value) return
  const printer = capabilities.get<PrinterCapability>('printer')
  if (!printer) return
  await printer.print(
    buildReceipt(lastResult.value.sale, lastResult.value.items, {
      storeName: settings.storeName,
      storeOwner: settings.storeOwner,
      width: usePrinterStore().paperWidth,
    }),
  )
}

function newTransaction() {
  success.value = false
  lastResult.value = null
}
</script>

<template>
  <div class="flex h-full flex-col">
    <AppHeader title="Point of Sale" :subtitle="headerSubtitle">
      <template #actions>
        <Button variant="outline" size="sm" class="gap-1.5" @click="openOpenBills">
          <ReceiptText class="size-4" /> Open Bills
        </Button>
      </template>
    </AppHeader>

    <!-- Search + filter -->
    <div class="shrink-0 space-y-3 border-b border-border bg-background px-4 py-3">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" placeholder="Cari produk / SKU / barcode" class="pl-9" />
        </div>
        <Button
          v-if="scannerReady"
          variant="outline"
          size="icon"
          title="Scan barcode"
          @click="router.push('/pos/scan')"
        >
          <ScanLine class="size-5" />
        </Button>
      </div>
      <div v-if="categories.items.length" class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        <button
          class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
          :class="cn(!categoryFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')"
          @click="setFilter(null)"
        >
          Semua
        </button>
        <button
          v-for="c in categories.items"
          :key="c.id"
          class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
          :class="cn(categoryFilter === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')"
          @click="setFilter(c.id)"
        >
          {{ c.name }}
        </button>
      </div>
    </div>

    <!-- Status sesi kasir -->
    <RouterLink
      v-if="!cashier.isOpen"
      to="/cashier"
      class="flex shrink-0 items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-warning-foreground"
    >
      <DoorClosed class="size-3.5" />
      <span class="flex-1">Kasir belum dibuka — transaksi tidak terhitung ke sesi.</span>
      <span class="font-semibold underline">Buka</span>
    </RouterLink>
    <RouterLink
      v-else
      to="/cashier"
      class="flex shrink-0 items-center gap-2 border-b border-success/20 bg-success/10 px-4 py-2 text-xs text-success"
    >
      <DoorOpen class="size-3.5" />
      <span class="flex-1">Kasir terbuka · perkiraan laci {{ formatRupiah(cashier.summary?.expectedCash ?? 0) }}</span>
    </RouterLink>

    <!-- Grid produk (area scroll) -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="filtered.length"
        class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <button
          v-for="p in filtered"
          :key="p.id"
          type="button"
          :disabled="soldOut(p.stock, p.track_stock)"
          class="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition active:scale-[.97] disabled:opacity-50"
          @click="cart.add(p)"
        >
          <div class="relative flex aspect-square items-center justify-center overflow-hidden bg-muted text-muted-foreground">
            <img
              v-if="media.url(p.image_path)"
              :src="media.url(p.image_path)!"
              :alt="p.name"
              class="size-full object-cover"
            />
            <Package v-else class="size-8" />
            <!-- Badge qty di keranjang -->
            <span
              v-if="cart.find(p.id)"
              class="absolute right-1.5 top-1.5 flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow"
            >
              {{ cart.find(p.id)!.qty }}
            </span>
            <span
              v-if="soldOut(p.stock, p.track_stock)"
              class="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white"
            >
              Habis
            </span>
          </div>
          <div class="flex flex-1 flex-col p-2.5">
            <p class="line-clamp-2 text-xs font-medium leading-snug">{{ p.name }}</p>
            <p class="mt-1 text-sm font-bold text-info">{{ formatRupiah(p.price) }}</p>
            <p v-if="p.track_stock" class="text-[11px] text-muted-foreground">Stok {{ p.stock }}</p>
          </div>
        </button>
      </div>

      <EmptyState
        v-else
        :icon="Package"
        :title="query || categoryFilter ? 'Produk tidak ditemukan' : 'Belum ada produk'"
        description="Tambahkan produk dulu di menu Produk untuk mulai berjualan."
      >
        <Button variant="outline" @click="router.push('/products')">Ke Produk</Button>
      </EmptyState>
    </div>

    <!-- Bar keranjang — footer nempel di atas BottomNav -->
    <Transition name="cartbar">
      <div v-if="!cart.isEmpty" class="shrink-0 border-t border-border bg-background p-3">
        <button
          class="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg transition active:scale-[.99]"
          @click="showCart = true"
        >
          <div class="relative">
            <ShoppingCart class="size-6" />
            <span class="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-primary">
              {{ cart.count }}
            </span>
          </div>
          <span class="flex-1 truncate text-left text-sm font-semibold">
            {{ cart.activeOpenBillId ? `Open Bill: ${cart.activeOpenBillLabel ?? cart.activeOpenBillId}` : 'Lihat Keranjang' }}
          </span>
          <span class="text-base font-bold">{{ formatRupiah(cart.total) }}</span>
        </button>
      </div>
    </Transition>

    <CartSheet
      v-model:open="showCart"
      @hold="openHoldForm"
      @open-bills="openOpenBills"
      @pay="showCart = false; showPayment = true"
    />
    <PaymentDialog v-model:open="showPayment" :total="cart.total" :busy="paying" @confirm="pay" />
    <OpenBillsSheet
      v-model:open="showOpenBills"
      :bills="openBills"
      :device-id="settings.deviceId"
      :cart-has-lines="!cart.isEmpty"
      :busy-bill-id="openBillBusyId"
      @resume="resumeOpenBill"
      @discard="requestDiscardOpenBill"
    />

    <BottomSheet v-model:open="showHoldForm" :title="cart.activeOpenBillId ? 'Simpan Perubahan Open Bill' : 'Tahan Pesanan'">
      <form class="space-y-5 p-5" @submit.prevent="submitHold">
        <div class="space-y-2">
          <Label for="open-bill-label">Label pesanan</Label>
          <Input
            id="open-bill-label"
            v-model="holdLabel"
            autocomplete="off"
            placeholder="Contoh: Meja 4 / Nama pelanggan"
          />
          <p class="text-xs leading-relaxed text-muted-foreground">
            Gunakan label agar pesanan mudah ditemukan saat dilanjutkan.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" :disabled="holding" @click="showHoldForm = false">
            Batal
          </Button>
          <Button type="submit" :disabled="holding || cart.isEmpty">
            {{ holding ? 'Menyimpan…' : cart.activeOpenBillId ? 'Simpan Perubahan' : 'Tahan Pesanan' }}
          </Button>
        </div>
      </form>
    </BottomSheet>

    <BottomSheet v-model:open="showDiscardConfirm" title="Buang Open Bill?">
      <div class="space-y-5 p-5">
        <div class="flex gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 class="size-5" />
          </div>
          <p class="text-sm leading-relaxed text-muted-foreground">
            Open Bill <span class="font-semibold text-foreground">{{ selectedDiscardBill?.open_bill_label ?? selectedDiscardBill?.number }}</span>
            beserta itemnya akan dibuang dan tidak dapat dilanjutkan lagi.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" :disabled="openBillBusyId !== null" @click="showDiscardConfirm = false">
            Batal
          </Button>
          <Button type="button" variant="destructive" :disabled="openBillBusyId !== null" @click="discardOpenBill">
            {{ openBillBusyId ? 'Membuang…' : 'Buang Open Bill' }}
          </Button>
        </div>
      </div>
    </BottomSheet>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="operationError"
          class="fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-destructive/30 bg-card p-3 shadow-lg"
          role="alert"
        >
          <p class="min-w-0 flex-1 text-sm leading-relaxed text-destructive">{{ operationError }}</p>
          <Button size="icon" variant="ghost" class="size-8 shrink-0" aria-label="Tutup pesan" @click="operationError = null">
            <X class="size-4" />
          </Button>
        </div>
      </Transition>
    </Teleport>

    <!-- Sukses -->
    <Teleport to="body">
      <Transition name="fade">
        <!-- Latar full-bleed, isinya yang di-cap max-w-md (pola BottomSheet).
             Kalau max-w-md dipasang di elemen fixed-nya sendiri, latarnya cuma
             selebar 448px dan layar di belakangnya nongol di kiri-kanan. -->
        <div
          v-if="success && lastResult"
          data-testid="success-overlay"
          class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background p-6"
        >
          <div class="flex w-full max-w-md flex-col items-center gap-1">
            <div class="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
              <Check class="size-10" />
            </div>
            <p class="mt-4 text-lg font-bold">Transaksi Berhasil</p>
            <p class="text-sm text-muted-foreground">No. {{ lastResult.sale.number }}</p>

            <div class="mt-6 w-full space-y-2 rounded-2xl bg-muted/50 p-4">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Total</span>
                <span class="font-semibold">{{ formatRupiah(lastResult.sale.total) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Bayar</span>
                <span>{{ formatRupiah(lastResult.sale.paid) }}</span>
              </div>
              <div v-if="lastResult.sale.change_due > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">Kembalian</span>
                <span class="font-semibold text-success">{{ formatRupiah(lastResult.sale.change_due) }}</span>
              </div>
            </div>

            <div class="mt-6 grid w-full grid-cols-2 gap-3">
              <Button variant="outline" class="gap-2" @click="printReceipt">
                <Printer class="size-4" /> Cetak Struk
              </Button>
              <Button class="gap-2" @click="newTransaction">
                <PlusCircle class="size-4" /> Transaksi Baru
              </Button>
            </div>
            <button class="mt-3 text-xs text-muted-foreground underline" @click="router.push('/transactions')">
              Lihat semua transaksi
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.cartbar-enter-active,
.cartbar-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.cartbar-enter-from,
.cartbar-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
