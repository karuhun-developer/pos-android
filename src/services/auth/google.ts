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
  const res = await SocialLogin.login({ provider: 'google', options: {} })
  const result = res.result as { idToken?: string | null }
  const idToken = result?.idToken
  if (!idToken) throw new Error('Google tidak mengembalikan id_token.')
  return idToken
}

export async function signOutGoogle(): Promise<void> {
  if (!initialized) return
  try {
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    /* offline / belum login — abaikan */
  }
}
