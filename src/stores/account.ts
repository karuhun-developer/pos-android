import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { resetLocalBusinessData } from '@/db/reset'
import { SettingsRepository } from '@/repositories/settings.repo'
import { useSettingsStore } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'
import {
  ApiClient,
  ApiError,
  type ApiContext,
  type AccountUser,
  type AccountStore,
  type AuthPayload,
} from '@/services/api/client'
import { ENV_API_BASE_URL } from '@/services/api/config'
import { signInWithGoogle, signOutGoogle } from '@/services/auth/google'

/** Semua device-local (disimpan di tabel settings, tidak ikut sync). */
const KEYS = {
  baseUrl: 'account_base_url',
  token: 'account_token',
  user: 'account_user',
  stores: 'account_stores',
  storeId: 'account_store_id',
} as const

/**
 * Akun cloud POS Pro: sumber tunggal token bearer + toko aktif. Beda dengan
 * `stores/auth.ts` (kunci PIN lokal). Token & profil dipersist di tabel settings.
 */
export const useAccountStore = defineStore('account', () => {
  const settings = useSettingsStore()

  const baseUrl = ref(ENV_API_BASE_URL)
  const token = ref<string | null>(null)
  const user = ref<AccountUser | null>(null)
  const stores = ref<AccountStore[]>([])
  const currentStoreId = ref<string | null>(null)
  const status = ref<'idle' | 'loading'>('idle')
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const currentStore = computed(
    () => stores.value.find((s) => String(s.id) === currentStoreId.value) ?? null,
  )

  function repo() {
    return new SettingsRepository(getDb())
  }

  // Header dinamis untuk ApiClient (di-resolve tiap request).
  const context: ApiContext = {
    baseUrl: () => baseUrl.value,
    token: () => token.value,
    deviceId: () => settings.deviceId,
    storeId: () => currentStoreId.value,
    onUnauthorized: () => void clearSession(),
  }
  const api = new ApiClient(context)

  async function load(): Promise<void> {
    const all = await repo().getAll()
    baseUrl.value = all[KEYS.baseUrl] || ENV_API_BASE_URL
    token.value = all[KEYS.token] || null
    user.value = all[KEYS.user] ? (JSON.parse(all[KEYS.user]) as AccountUser) : null
    stores.value = all[KEYS.stores] ? (JSON.parse(all[KEYS.stores]) as AccountStore[]) : []
    currentStoreId.value = all[KEYS.storeId] || null
  }

  async function setBaseUrl(url: string): Promise<void> {
    baseUrl.value = url.trim().replace(/\/+$/, '')
    await repo().set(KEYS.baseUrl, baseUrl.value)
  }

  async function applyAuth(p: AuthPayload): Promise<void> {
    token.value = p.token
    user.value = p.user
    stores.value = p.stores
    currentStoreId.value =
      (p.user.current_store_id != null ? String(p.user.current_store_id) : null) ??
      (p.stores[0] ? String(p.stores[0].id) : null)
    await repo().setMany({
      [KEYS.token]: p.token,
      [KEYS.user]: JSON.stringify(p.user),
      [KEYS.stores]: JSON.stringify(p.stores),
      [KEYS.storeId]: currentStoreId.value ?? '',
    })
  }

  async function withLogin(fn: () => Promise<AuthPayload>): Promise<boolean> {
    status.value = 'loading'
    error.value = null
    try {
      await applyAuth(await fn())
      return true
    } catch (e) {
      error.value =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)
      return false
    } finally {
      status.value = 'idle'
    }
  }

  function loginEmail(email: string, password: string): Promise<boolean> {
    return withLogin(() => api.loginEmail(email, password))
  }

  function registerEmail(name: string, email: string, password: string): Promise<boolean> {
    return withLogin(() => api.registerEmail(name, email, password))
  }

  function loginGoogle(): Promise<boolean> {
    return withLogin(async () => api.loginGoogle(await signInWithGoogle()))
  }

  /**
   * Pindah outlet aktif. Karena SQLite lokal single-tenant, data outlet lama
   * dibuang (`resetLocalBusinessData`) + cache media dikosongkan supaya tidak
   * bocor ke outlet baru; siklus sync berikutnya menarik ulang data outlet baru
   * dari nol. Antrean outbox pending sebaiknya sudah di-push sebelum ini
   * (ConnectPage memanggil `sync.syncNow()` dulu).
   */
  async function setCurrentStore(id: string): Promise<void> {
    if (id === currentStoreId.value) return
    await resetLocalBusinessData()
    useMediaStore().clear()
    currentStoreId.value = id
    await repo().set(KEYS.storeId, id)
  }

  async function persistStores(): Promise<void> {
    await repo().set(KEYS.stores, JSON.stringify(stores.value))
  }

  /** Buat outlet baru → jadikan toko aktif. Balik true kalau sukses. */
  async function createStore(name: string): Promise<boolean> {
    status.value = 'loading'
    error.value = null
    try {
      const res = await api.createStore(name)
      stores.value = res.stores
      await persistStores()
      await setCurrentStore(String(res.store.id))
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      status.value = 'idle'
    }
  }

  /** Ganti nama outlet (khusus owner). Balik true kalau sukses. */
  async function renameStore(id: string | number, name: string): Promise<boolean> {
    error.value = null
    try {
      const res = await api.renameStore(id, name)
      const i = stores.value.findIndex((s) => String(s.id) === String(id))
      if (i !== -1) stores.value[i] = { ...stores.value[i], name: res.store.name }
      await persistStores()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  async function clearSession(): Promise<void> {
    token.value = null
    user.value = null
    stores.value = []
    currentStoreId.value = null
    await repo().setMany({
      [KEYS.token]: '',
      [KEYS.user]: '',
      [KEYS.stores]: '',
      [KEYS.storeId]: '',
    })
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
    } catch {
      /* token mungkin sudah invalid — tetap bersihkan lokal */
    }
    await signOutGoogle()
    await clearSession()
  }

  return {
    baseUrl,
    token,
    user,
    stores,
    currentStoreId,
    status,
    error,
    isAuthenticated,
    currentStore,
    api,
    load,
    setBaseUrl,
    loginEmail,
    registerEmail,
    loginGoogle,
    setCurrentStore,
    createStore,
    renameStore,
    logout,
  }
})
