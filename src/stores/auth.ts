import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { makePinHash, verifyPin } from '@/lib/crypto'

/** Kunci app lokal (PIN). Default OFF — app jalan tanpa login sampai user
 *  mengaktifkannya di Setelan. PIN disimpan sebagai hash bergaram, bukan
 *  plaintext. Tidak ada kaitan dengan sync/cloud (itu urusan AuthProvider). */
export const useAuthStore = defineStore('auth', () => {
  const settings = useSettingsStore()
  const unlocked = ref(false)

  // Terkunci hanya bila login diaktifkan DAN PIN sudah dipasang.
  const isLocked = computed(
    () => settings.loginEnabled && settings.hasPin && !unlocked.value,
  )

  async function verify(pin: string): Promise<boolean> {
    const ok = await verifyPin(pin, settings.pinHash)
    if (ok) unlocked.value = true
    return ok
  }

  /** Set/ganti PIN. Langsung membuka kunci sesi berjalan. */
  async function setPin(pin: string): Promise<void> {
    await settings.setPinHash(await makePinHash(pin))
    unlocked.value = true
  }

  async function enableLogin(): Promise<void> {
    await settings.setLoginEnabled(true)
  }

  /** Matikan login. PIN ikut dibersihkan agar tidak menyisa hash yatim. */
  async function disableLogin(): Promise<void> {
    await settings.setLoginEnabled(false)
    await settings.setPinHash(null)
    unlocked.value = false
  }

  function lock(): void {
    unlocked.value = false
  }

  return { unlocked, isLocked, verify, setPin, enableLogin, disableLogin, lock }
})
