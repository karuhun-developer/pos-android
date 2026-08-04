import type { ChangeEnvelope, PushResult, PullResult } from '@/services/sync/types'

/** Bentuk error standar Laravel `{ message, errors }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface AccountUser {
  id: string
  name: string
  email: string
  avatar_url: string | null
  current_store_id: string | number | null
}

export interface AccountStore {
  id: string | number
  name: string
  role: string
}

export interface AuthPayload {
  token: string
  user: AccountUser
  stores: AccountStore[]
}

/** Sumber header dinamis (token/store/device) — di-resolve tiap request. */
export interface ApiContext {
  baseUrl(): string
  token(): string | null
  deviceId(): string
  storeId(): string | null
  /** Dipanggil saat server balikin 401 (token invalid/kadaluarsa). */
  onUnauthorized(): void
}

/**
 * Klien HTTP tipis ke backend POS Pro (Laravel, `api/v1`). Semua endpoint di
 * kontrak `docs/api/pos-pro-api-v1.md` dibungkus di sini. Header auth/device/
 * store di-resolve dari `ApiContext` tiap request sehingga selalu terkini.
 */
export class ApiClient {
  constructor(private readonly ctx: ApiContext) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const token = this.ctx.token()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const device = this.ctx.deviceId()
    if (device) headers['X-Device-Id'] = device
    const store = this.ctx.storeId()
    if (store) headers['X-Store-Id'] = String(store)

    let res: Response
    try {
      res = await fetch(this.ctx.baseUrl() + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      // Gagal jaringan (offline / server mati).
      throw new ApiError(0, `Tidak bisa terhubung ke server: ${String(e)}`)
    }

    if (res.status === 401) {
      this.ctx.onUnauthorized()
      throw new ApiError(401, 'Sesi berakhir, silakan masuk kembali.')
    }
    if (res.status === 204) return undefined as T

    let data: unknown = null
    const text = await res.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }

    if (!res.ok) {
      const d = (data ?? {}) as { message?: string; errors?: Record<string, string[]> }
      throw new ApiError(res.status, d.message || `Error ${res.status}`, d.errors)
    }
    return data as T
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  loginGoogle(idToken: string): Promise<AuthPayload> {
    return this.request('POST', '/auth/google', { id_token: idToken })
  }

  loginEmail(email: string, password: string): Promise<AuthPayload> {
    return this.request('POST', '/auth/login', { email, password })
  }

  registerEmail(name: string, email: string, password: string): Promise<AuthPayload> {
    return this.request('POST', '/auth/register', { name, email, password })
  }

  me(): Promise<{ user: AccountUser; stores: AccountStore[] }> {
    return this.request('GET', '/auth/me')
  }

  logout(): Promise<void> {
    return this.request('POST', '/auth/logout')
  }

  stores(): Promise<{ stores: AccountStore[] }> {
    return this.request('GET', '/stores')
  }

  createStore(name: string): Promise<{ store: AccountStore; stores: AccountStore[] }> {
    return this.request('POST', '/stores', { name })
  }

  renameStore(id: string | number, name: string): Promise<{ store: AccountStore }> {
    return this.request('PATCH', `/stores/${id}`, { name })
  }

  // ── Sync ────────────────────────────────────────────────────────────────
  syncPush(changes: ChangeEnvelope[]): Promise<PushResult> {
    return this.request('POST', '/sync/push', { changes })
  }

  syncPull(entity: string, since: number): Promise<PullResult> {
    const q = `?entity=${encodeURIComponent(entity)}&since=${since}`
    return this.request('GET', '/sync/pull' + q)
  }

  health(): Promise<{ status: string; time: number; version: string }> {
    return this.request('GET', '/health')
  }
}
