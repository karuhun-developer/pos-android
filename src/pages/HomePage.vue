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
  ChevronRight,
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
  { to: '/pos', label: 'Point of Sale', desc: 'Mulai transaksi', icon: ShoppingCart },
  { to: '/products', label: 'Produk', desc: 'Kelola barang', icon: Package },
  { to: '/transactions', label: 'Transaksi', desc: 'Riwayat penjualan', icon: Receipt },
  { to: '/cashflow', label: 'Cashflow', desc: 'Pemasukan & pengeluaran', icon: Wallet },
  { to: '/reports', label: 'Laporan', desc: 'Ringkasan & grafik', icon: BarChart3 },
  { to: '/cashier', label: 'Sesi Kasir', desc: 'Buka/tutup kasir', icon: CalendarClock },
  { to: '/printer', label: 'Printer', desc: 'Cetak struk', icon: Printer },
  { to: '/settings', label: 'Akun & Setelan', desc: 'Login, PIN, toko', icon: UserCog },
]
</script>

<template>
  <div class="min-h-full bg-background pb-6">
    <!-- Header profil toko — hero gelap, konsisten di light & dark -->
    <header
      class="bg-gradient-to-br from-hero to-hero/90 px-5 pb-14 pt-[max(1.5rem,env(safe-area-inset-top))] text-hero-foreground md:px-6"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur"
        >
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
          <p class="truncate text-sm text-hero-foreground/70">
            {{ storeOwner || 'Belum ada nama pemilik' }}
          </p>
        </div>
      </div>

      <!-- Banner konek POS Pro -->
      <RouterLink
        to="/settings"
        class="group mt-5 flex items-center gap-3 rounded-2xl bg-white/12 p-3.5 backdrop-blur transition hover:bg-white/[.18]"
      >
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15"
        >
          <Cloud class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">Sambungkan ke POS Pro</p>
          <p class="truncate text-xs text-hero-foreground/70">
            Login online & sinkronkan data ke cloud
          </p>
        </div>
        <ChevronRight
          class="size-5 shrink-0 text-hero-foreground/70 transition-transform group-hover:translate-x-0.5"
        />
      </RouterLink>
    </header>

    <!-- Panel menu yang menimpa hero -->
    <div class="-mt-6 rounded-t-3xl bg-background px-4 pt-5 md:px-6">
      <p
        class="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Menu Utama
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <RouterLink
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          class="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[.98]"
        >
          <div
            class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105"
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
