<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ShoppingCart,
  Package,
  Receipt,
  Wallet,
  Printer,
  UserCog,
  Store,
  CalendarClock,
  Cloud,
  BarChart3,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'

const settings = useSettingsStore()
const media = useMediaStore()
const { storeName, storeOwner, storeLogo } = storeToRefs(settings)

onMounted(() => {
  if (storeLogo.value) media.ensure([storeLogo.value])
})

const menu = [
  { to: '/pos', label: 'Point of Sale', desc: 'Mulai transaksi', icon: ShoppingCart, tint: 'bg-primary/10 text-primary' },
  { to: '/products', label: 'Produk', desc: 'Kelola barang', icon: Package, tint: 'bg-amber-500/10 text-amber-600' },
  { to: '/transactions', label: 'Transaksi', desc: 'Riwayat penjualan', icon: Receipt, tint: 'bg-violet-500/10 text-violet-600' },
  { to: '/cashflow', label: 'Cashflow', desc: 'Pemasukan & pengeluaran', icon: Wallet, tint: 'bg-emerald-500/10 text-emerald-600' },
  { to: '/reports', label: 'Laporan', desc: 'Ringkasan & grafik', icon: BarChart3, tint: 'bg-indigo-500/10 text-indigo-600' },
  { to: '/cashier', label: 'Buka/Tutup Kasir', desc: 'Sesi kasir', icon: CalendarClock, tint: 'bg-sky-500/10 text-sky-600' },
  { to: '/printer', label: 'Printer', desc: 'Cetak struk', icon: Printer, tint: 'bg-rose-500/10 text-rose-600' },
  { to: '/settings', label: 'Akun & Setelan', desc: 'Login, PIN, toko', icon: UserCog, tint: 'bg-slate-500/10 text-slate-600' },
]
</script>

<template>
  <div class="min-h-full bg-background pb-6">
    <!-- Header profil toko -->
    <div
      class="bg-gradient-to-b from-primary to-primary/80 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] text-primary-foreground"
    >
      <div class="flex items-center gap-3">
        <div class="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15">
          <img
            v-if="media.url(storeLogo)"
            :src="media.url(storeLogo)!"
            alt="Logo toko"
            class="size-full object-contain p-1"
          />
          <Store v-else class="size-6" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-lg font-bold leading-tight">{{ storeName }}</p>
          <p class="truncate text-sm text-primary-foreground/75">
            {{ storeOwner || 'Belum ada nama pemilik' }}
          </p>
        </div>
      </div>

      <!-- Banner konek POS Pro (placeholder future) -->
      <RouterLink
        to="/settings"
        class="mt-5 flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur transition hover:bg-white/20"
      >
        <Cloud class="size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">Sambungkan ke POS Pro</p>
          <p class="text-xs text-primary-foreground/75">
            Login online & sinkronkan data ke cloud
          </p>
        </div>
        <span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
          Segera
        </span>
      </RouterLink>
    </div>

    <!-- Grid menu -->
    <div class="relative -mt-6 rounded-t-3xl bg-background px-4 pb-4 pt-5">
      <p class="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Menu Utama
      </p>
      <div class="grid grid-cols-2 gap-3">
        <RouterLink
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          class="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition active:scale-[.98] hover:border-primary/40"
        >
          <div
            class="flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
            :class="item.tint"
          >
            <component :is="item.icon" class="size-5.5" />
          </div>
          <div>
            <p class="text-sm font-semibold leading-tight">{{ item.label }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ item.desc }}</p>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
