<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Home, ShoppingCart, Receipt, Wallet, Settings } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const route = useRoute()

const items = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/pos', label: 'Kasir', icon: ShoppingCart },
  { to: '/transactions', label: 'Transaksi', icon: Receipt },
  { to: '/cashflow', label: 'Cashflow', icon: Wallet },
  { to: '/settings', label: 'Akun', icon: Settings },
]

function isActive(to: string, exact?: boolean) {
  return exact ? route.path === to : route.path.startsWith(to)
}
</script>

<template>
  <nav
    class="sticky bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
  >
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
      :class="
        cn(
          isActive(item.to, item.exact)
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )
      "
    >
      <component :is="item.icon" class="size-5" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
