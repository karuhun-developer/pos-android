<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Store } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'

const settings = useSettingsStore()
const media = useMediaStore()
const { storeName, storeLogo, splashBg } = storeToRefs(settings)

const BG: Record<string, string> = {
  brand: 'bg-gradient-to-b from-primary to-primary/80 text-primary-foreground',
  light: 'bg-background text-foreground',
  dark: 'bg-slate-900 text-white',
}

onMounted(() => {
  // Pastikan logo ada di cache biar langsung tampil.
  if (storeLogo.value) media.ensure([storeLogo.value])
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 mx-auto flex max-w-md flex-col items-center justify-center gap-5"
    :class="BG[splashBg] || BG.brand"
  >
    <div
      class="flex size-24 items-center justify-center overflow-hidden rounded-3xl shadow-lg"
      :class="splashBg === 'brand' ? 'bg-white/15' : 'bg-primary/10'"
    >
      <img
        v-if="media.url(storeLogo)"
        :src="media.url(storeLogo)!"
        alt="Logo toko"
        class="size-full object-contain p-1.5"
      />
      <Store v-else class="size-12" :class="splashBg === 'brand' ? '' : 'text-primary'" />
    </div>
    <div class="text-center">
      <p class="text-xl font-bold">{{ storeName }}</p>
      <p class="mt-1 text-xs opacity-70">Point of Sale</p>
    </div>
    <div class="absolute bottom-16">
      <div
        class="size-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60"
      />
    </div>
  </div>
</template>
