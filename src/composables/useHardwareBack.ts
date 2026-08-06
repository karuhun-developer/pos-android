import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter, type Router } from 'vue-router'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Mundur sesuai riwayat; kalau riwayat kosong (mis. masuk lewat deep-link / setelah
 * redirect) balik ke Home supaya tak pernah mentok / keluar app dari halaman dalam.
 * Dipakai bareng oleh tombol back hardware & tombol back di AppHeader.
 */
export function goBackOrHome(router: Router): void {
  if (window.history.state?.back != null) router.back()
  else void router.replace('/')
}

/**
 * Tangani tombol **back hardware Android** (`@capacitor/app` `backButton`):
 * - `/lock` → di-swallow (tetap terkunci).
 * - Home (`/`) → tekan 2× untuk keluar (hint muncul dulu, back kedua <2s → exit).
 * - Halaman lain → {@link goBackOrHome}.
 *
 * Hanya aktif di platform native; di web listener tak dipasang.
 */
export function useHardwareBack() {
  const router = useRouter()
  const showExitHint = ref(false)

  let handle: PluginListenerHandle | null = null
  let lastBackAt = 0
  let hintTimer: ReturnType<typeof setTimeout> | null = null

  function handleBack() {
    const route = router.currentRoute.value

    // Layar kunci: jangan biarkan back keluar dari kunci.
    if (route.name === 'lock') return

    // Home: tekan back 2× untuk keluar.
    if (route.path === '/') {
      const now = Date.now()
      if (now - lastBackAt < 2000) {
        void App.exitApp()
        return
      }
      lastBackAt = now
      showExitHint.value = true
      if (hintTimer) clearTimeout(hintTimer)
      hintTimer = setTimeout(() => {
        showExitHint.value = false
      }, 2000)
      return
    }

    // Halaman lain: mundur sesuai riwayat (fallback Home).
    goBackOrHome(router)
  }

  onMounted(async () => {
    if (!Capacitor.isNativePlatform()) return
    handle = await App.addListener('backButton', handleBack)
  })

  onUnmounted(() => {
    void handle?.remove()
    if (hintTimer) clearTimeout(hintTimer)
  })

  return { showExitHint }
}
