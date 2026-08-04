/** Nilai default dari environment (Vite). Bisa dioverride runtime via settings. */
export const ENV_API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:8000/api/v1'

export const ENV_GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || ''
