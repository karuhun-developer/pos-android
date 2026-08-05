import { SocialLogin } from '@capgo/capacitor-social-login'
import { ENV_GOOGLE_CLIENT_ID } from '@/services/api/config'

let initialized = false

/** Init sekali; webClientId dipakai web & sebagai server_client_id di Android. */
async function ensureInit(clientId: string): Promise<void> {
  if (initialized) return
  await SocialLogin.initialize({ google: { webClientId: clientId } })
  initialized = true
}

/**
 * Login Google → kembalikan **ID token** untuk diverifikasi server
 * (`POST /auth/google { id_token }`). Native pakai Google Sign-In Android,
 * web pakai Google Identity Services — keduanya butuh `VITE_GOOGLE_CLIENT_ID`.
 */
export async function signInWithGoogle(clientId: string = ENV_GOOGLE_CLIENT_ID): Promise<string> {
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID belum diisi — atur di .env dulu.')
  }
  await ensureInit(clientId)
  let res
  try {
    res = await SocialLogin.login({ provider: 'google', options: {} })
  } catch (e) {
    throw new Error(mapGoogleError(e))
  }
  const result = res.result as { idToken?: string | null }
  const idToken = result?.idToken
  if (!idToken) throw new Error('Google tidak mengembalikan id_token.')
  return idToken
}

/** Terjemahkan error native jadi pesan yang actionable saat login gagal. */
function mapGoogleError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = msg.toLowerCase()
  // code 10 / DEVELOPER_ERROR: SHA-1 atau server_client_id belum cocok di GCP.
  if (m.includes('10') && m.includes('developer')) {
    return 'Konfigurasi Google belum cocok (SHA-1 / client ID). Pastikan SHA-1 aplikasi terdaftar di Google Cloud Console.'
  }
  if (m.includes('developer_error') || m.includes('developer error')) {
    return 'DEVELOPER_ERROR: SHA-1 aplikasi belum terdaftar di Google Cloud Console (Android OAuth client).'
  }
  if (m.includes('cancel')) return 'Login Google dibatalkan.'
  if (m.includes('network')) return 'Tidak ada koneksi — coba lagi saat online.'
  return `Login Google gagal: ${msg}`
}

export async function signOutGoogle(): Promise<void> {
  if (!initialized) return
  try {
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    /* offline / belum login — abaikan */
  }
}
