import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SettingsRepository } from '@/repositories/settings.repo'
import { shortId } from '@/lib/uuid'

const KEYS = {
  storeName: 'store_name',
  storeOwner: 'store_owner',
  loginEnabled: 'login_enabled',
  pinHash: 'pin_hash',
  deviceId: 'device_id',
  theme: 'theme',
} as const

export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const storeName = ref('POS Kacaw')
  const storeOwner = ref('')
  const loginEnabled = ref(false) // DEFAULT: tanpa login
  const pinHash = ref<string | null>(null)
  const deviceId = ref('')
  const theme = ref<'light' | 'dark'>('light')

  const hasPin = computed(() => !!pinHash.value)

  function repo() {
    return new SettingsRepository(getDb())
  }

  async function load() {
    const all = await repo().getAll()
    storeName.value = all[KEYS.storeName] || 'POS Kacaw'
    storeOwner.value = all[KEYS.storeOwner] || ''
    loginEnabled.value = all[KEYS.loginEnabled] === '1'
    pinHash.value = all[KEYS.pinHash] || null
    theme.value = all[KEYS.theme] === 'dark' ? 'dark' : 'light'

    // device_id dibuat sekali, dipakai buat prefix nomor struk.
    deviceId.value = all[KEYS.deviceId] || ''
    if (!deviceId.value) {
      deviceId.value = shortId(4)
      await repo().set(KEYS.deviceId, deviceId.value)
    }
    applyTheme()
    loaded.value = true
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
  }

  async function setProfile(name: string, owner: string) {
    storeName.value = name
    storeOwner.value = owner
    await repo().setMany({ [KEYS.storeName]: name, [KEYS.storeOwner]: owner })
  }

  async function setLoginEnabled(enabled: boolean) {
    loginEnabled.value = enabled
    await repo().set(KEYS.loginEnabled, enabled ? '1' : '0')
  }

  async function setPinHash(hash: string | null) {
    pinHash.value = hash
    await repo().set(KEYS.pinHash, hash ?? '')
  }

  async function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme()
    await repo().set(KEYS.theme, theme.value)
  }

  return {
    loaded,
    storeName,
    storeOwner,
    loginEnabled,
    pinHash,
    deviceId,
    theme,
    hasPin,
    load,
    setProfile,
    setLoginEnabled,
    setPinHash,
    toggleTheme,
  }
})
