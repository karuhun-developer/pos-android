<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CartSheet from '@/components/pos/CartSheet.vue'
import PaymentDialog from '@/components/pos/PaymentDialog.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Package, Search, ShoppingCart, Check, Printer, PlusCircle, DoorOpen, DoorClosed,
} from 'lucide-vue-next'
import { useProductsStore } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'
import { useMediaStore } from '@/stores/media'
import { useCartStore } from '@/stores/cart'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import { useCashierStore } from '@/stores/cashier'
import { capabilities } from '@/services/capabilities/registry'
import type { PrinterCapability } from '@/services/capabilities/registry'
import type { CheckoutResult } from '@/services/checkout.service'
import { buildReceipt } from '@/lib/receipt'
import { formatRupiah } from '@/lib/money'
import { cn } from '@/lib/utils'

const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()
const media = useMediaStore()
const cart = useCartStore()
const sales = useSalesStore()
const settings = useSettingsStore()
const cashier = useCashierStore()
const { filtered, query, categoryFilter } = storeToRefs(products)

const showCart = ref(false)
const showPayment = ref(false)
const paying = ref(false)
const success = ref(false)
const lastResult = ref<CheckoutResult | null>(null)

onMounted(async () => {
  await Promise.all([products.load(), categories.load(), cashier.load()])
  await media.ensure(products.items.map((p) => p.image_path))
})

function setFilter(id: string | null) {
  categoryFilter.value = categoryFilter.value === id ? null : id
}

function soldOut(stock: number, track: number) {
  return !!track && stock <= 0
}

async function pay({ paid, paymentMethod }: { paid: number; paymentMethod: string }) {
  paying.value = true
  try {
    const res = await sales.checkout({
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        price: l.price,
        qty: l.qty,
      })),
      paid,
      paymentMethod,
      discount: cart.discount,
      sessionId: cashier.current?.id ?? null, // link ke sesi kasir aktif (bila ada)
      devicePrefix: settings.deviceId || 'POS',
    })
    lastResult.value = res
    showPayment.value = false
    showCart.value = false
    cart.clear()
    // Refresh stok yang berkurang di grid + ringkasan laci sesi kasir.
    await products.load()
    await media.ensure(products.items.map((p) => p.image_path))
    await cashier.refreshSummary()
    success.value = true
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
    <AppHeader
      title="Point of Sale"
      :subtitle="cart.count ? `${cart.count} item di keranjang` : 'Ketuk produk untuk menambah'"
    />

    <!-- Search + filter -->
    <div class="shrink-0 space-y-3 border-b border-border bg-background px-4 py-3">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Cari produk / SKU / barcode" class="pl-9" />
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
      class="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700"
    >
      <DoorClosed class="size-3.5" />
      <span class="flex-1">Kasir belum dibuka — transaksi tidak terhitung ke sesi.</span>
      <span class="font-semibold underline">Buka</span>
    </RouterLink>
    <RouterLink
      v-else
      to="/cashier"
      class="flex shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700"
    >
      <DoorOpen class="size-3.5" />
      <span class="flex-1">Kasir terbuka · perkiraan laci {{ formatRupiah(cashier.summary?.expectedCash ?? 0) }}</span>
    </RouterLink>

    <!-- Grid produk (area scroll) -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="filtered.length" class="grid grid-cols-2 gap-3 p-4">
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
            <p class="mt-1 text-sm font-bold text-primary">{{ formatRupiah(p.price) }}</p>
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
          <span class="flex-1 text-left text-sm font-semibold">Lihat Keranjang</span>
          <span class="text-base font-bold">{{ formatRupiah(cart.total) }}</span>
        </button>
      </div>
    </Transition>

    <CartSheet v-model:open="showCart" @pay="showCart = false; showPayment = true" />
    <PaymentDialog v-model:open="showPayment" :total="cart.total" :busy="paying" @confirm="pay" />

    <!-- Sukses -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="success && lastResult" class="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col items-center justify-center gap-1 bg-background p-6">
          <div class="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
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
              <span class="font-semibold text-emerald-600">{{ formatRupiah(lastResult.sale.change_due) }}</span>
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
