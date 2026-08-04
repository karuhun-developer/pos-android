import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SettingsRepository } from '@/repositories/settings.repo'
import { deviceUuid, devicePrefixOf } from '@/lib/uuid'

export type SplashBg = 'brand' | 'light' | 'dark'

const KEYS = {
  storeName: 'store_name',
  storeOwner: 'store_owner',
  storeLogo: 'store_logo',
  loginEnabled: 'login_enabled',
  pinHash: 'pin_hash',
  deviceId: 'device_id',
  theme: 'theme',
  splashEnabled: 'splash_enabled',
  splashBg: 'splash_bg',
  qrisPayload: 'qris_payload',
  qrisDynamic: 'qris_dynamic',
} as const

export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const storeName = ref('POS Kacaw')
  const storeOwner = ref('')
  const storeLogo = ref<string | null>(null) // ref media://<id>
  const loginEnabled = ref(false) // DEFAULT: tanpa login
  const pinHash = ref<string | null>(null)
  const deviceId = ref('')
  const theme = ref<'light' | 'dark'>('light')
  const splashEnabled = ref(false) // DEFAULT: splash mati
  const splashBg = ref<SplashBg>('brand') // DEFAULT: warna brand
  const qrisPayload = ref<string | null>(null) // string EMV QRIS statis hasil decode
  const qrisDynamic = ref(false) // DEFAULT: off — nominal QRIS di-inject otomatis

  const hasPin = computed(() => !!pinHash.value)
  // Prefix pendek nomor struk, diturunkan dari device UUID (biar struk tetap ringkas).
  const devicePrefix = computed(() => devicePrefixOf(deviceId.value))

  function repo() {
    return new SettingsRepository(getDb())
  }

  async function load() {
    const all = await repo().getAll()
    storeName.value = all[KEYS.storeName] || 'POS Kacaw'
    storeOwner.value = all[KEYS.storeOwner] || ''
    storeLogo.value = all[KEYS.storeLogo] || null
    loginEnabled.value = all[KEYS.loginEnabled] === '1'
    pinHash.value = all[KEYS.pinHash] || null
    theme.value = all[KEYS.theme] === 'dark' ? 'dark' : 'light'
    // Splash: default mati; aktif hanya bila di-set '1'. bg default 'brand'.
    splashEnabled.value = all[KEYS.splashEnabled] === '1'
    const bg = all[KEYS.splashBg]
    splashBg.value = bg === 'light' || bg === 'dark' ? bg : 'brand'
    qrisPayload.value = all[KEYS.qrisPayload] || null
    qrisDynamic.value = all[KEYS.qrisDynamic] === '1'

    // device_id dibuat sekali: UUID v7 (timestamp-based, unik lintas device).
    // Nilai lama yang pendek (< 36 char, sebelum v0.1 rilis) di-upgrade ke v7.
    deviceId.value = all[KEYS.deviceId] || ''
    if (!deviceId.value || deviceId.value.length < 36) {
      deviceId.value = deviceUuid()
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

  async function setLogo(ref_: string | null) {
    storeLogo.value = ref_
    await repo().set(KEYS.storeLogo, ref_ ?? '')
  }

  async function setSplash(opts: { enabled?: boolean; bg?: SplashBg }) {
    const patch: Record<string, string> = {}
    if (opts.enabled !== undefined) {
      splashEnabled.value = opts.enabled
      patch[KEYS.splashEnabled] = opts.enabled ? '1' : '0'
    }
    if (opts.bg !== undefined) {
      splashBg.value = opts.bg
      patch[KEYS.splashBg] = opts.bg
    }
    if (Object.keys(patch).length) await repo().setMany(patch)
  }

  async function setQris(payload: string | null) {
    qrisPayload.value = payload
    await repo().set(KEYS.qrisPayload, payload ?? '')
    // Matiin dinamis otomatis kalau QRIS dihapus.
    if (!payload && qrisDynamic.value) await setQrisDynamic(false)
  }

  async function setQrisDynamic(enabled: boolean) {
    qrisDynamic.value = enabled
    await repo().set(KEYS.qrisDynamic, enabled ? '1' : '0')
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
    storeLogo,
    loginEnabled,
    pinHash,
    deviceId,
    theme,
    splashEnabled,
    splashBg,
    qrisPayload,
    qrisDynamic,
    hasPin,
    devicePrefix,
    load,
    setProfile,
    setLogo,
    setSplash,
    setQris,
    setQrisDynamic,
    setLoginEnabled,
    setPinHash,
    toggleTheme,
  }
})
