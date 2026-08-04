<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/layout/BottomNav.vue'
import SplashScreen from '@/components/layout/SplashScreen.vue'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const showNav = computed(() => !route.meta.hideNav)

// Splash in-app: tampil sebentar saat boot bila diaktifkan (default OFF).
const settings = useSettingsStore()
const showSplash = ref(settings.splashEnabled)
onMounted(() => {
  if (showSplash.value) setTimeout(() => (showSplash.value = false), 1500)
})
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

  <Transition name="splash">
    <SplashScreen v-if="showSplash" />
  </Transition>
</template>

<style>
.splash-leave-active {
  transition: opacity 0.4s ease;
}
.splash-leave-to {
  opacity: 0;
}
</style>
