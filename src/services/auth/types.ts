/** Sumber token untuk sync ke cloud. Satu-satunya tempat token hidup. */
export interface AuthProvider {
  /** null saat offline / belum login. */
  getToken(): Promise<string | null>
  isAuthenticated(): boolean
  /** Dipanggil saat server balikin 401. */
  onUnauthorized(): void
}

/** v1: selalu null → SyncEngine mati total. POS Pro nanti ganti dengan
 *  JwtAuthProvider (login online / Google) tanpa ubah kode lain. */
export class NullAuthProvider implements AuthProvider {
  async getToken(): Promise<string | null> {
    return null
  }
  isAuthenticated(): boolean {
    return false
  }
  onUnauthorized(): void {
    /* no-op */
  }
}
