<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/layout/BottomNav.vue'

const route = useRoute()
const showNav = computed(() => !route.meta.hideNav)
</script>

<template>
  <!-- Frame mobile: dipusatkan di layar lebar, full di HP -->
  <div
    class="mx-auto flex h-full max-w-md flex-col overflow-hidden bg-background shadow-xl sm:h-screen"
  >
    <main class="no-scrollbar flex-1 overflow-y-auto">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>
    <BottomNav v-if="showNav" />
  </div>
</template>
