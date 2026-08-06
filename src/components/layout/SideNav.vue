<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Store } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'
import { navItems, isNavActive } from './navItems'

const route = useRoute()
const settings = useSettingsStore()
const media = useMediaStore()
const { storeName, storeOwner, storeLogo } = storeToRefs(settings)

onMounted(() => {
  if (storeLogo.value) media.ensure([storeLogo.value])
})
</script>

<template>
  <aside
    class="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex"
  >
    <!-- Profil toko -->
    <RouterLink
      to="/"
      class="flex items-center gap-3 border-b border-border px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div
        class="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary"
      >
        <img
          v-if="media.url(storeLogo)"
          :src="media.url(storeLogo)!"
          alt="Logo toko"
          class="size-full object-contain p-1"
        />
        <Store v-else class="size-5" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-bold leading-tight">{{ storeName }}</p>
        <p class="truncate text-xs text-muted-foreground">
          {{ storeOwner || 'POS Kacaw' }}
        </p>
      </div>
    </RouterLink>

    <!-- Menu -->
    <nav class="no-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
        :class="
          cn(
            isNavActive(route.path, item)
              ? 'bg-primary/10 font-semibold text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )
        "
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
