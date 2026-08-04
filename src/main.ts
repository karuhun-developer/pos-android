import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/index.css'
import App from './App.vue'
import { router } from '@/router'
import { initDb } from '@/db/sqlite'
import { registerCapabilities } from '@/services/capabilities/bootstrap'
import { useSettingsStore } from '@/stores/settings'

async function bootstrap() {
  // Urutan penting: DB dulu -> capabilities -> pinia -> load settings -> router
  const db = await initDb()
  registerCapabilities()

  // Debug hook (dev only) — dipakai smoke test buat inspeksi DB/outbox.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __db: typeof db }).__db = db
  }

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // Muat setelan (device_id, tema, dll) sebelum UI tampil.
  await useSettingsStore().load()

  app.use(router)
  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('[POS Kacaw] gagal inisialisasi:', err)
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#b00">
      <h2>Gagal memuat aplikasi</h2>
      <pre style="white-space:pre-wrap">${String(err)}</pre></div>`
  }
})
