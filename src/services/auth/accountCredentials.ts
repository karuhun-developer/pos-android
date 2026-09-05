export interface LegacyCredentialStore {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  remove(): Promise<void>
}

export interface SecureCredentialStore {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  remove(): Promise<void>
}

export type AccountCredentialStorage =
  | {
      readonly kind: 'android'
      readonly legacy: LegacyCredentialStore
      readonly secure: SecureCredentialStore
    }
  | {
      readonly kind: 'browser'
      readonly legacy: LegacyCredentialStore
    }

export type LoadedAccountCredential =
  | { readonly kind: 'loaded'; readonly value: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'migration-incomplete' }
  | { readonly kind: 'secure-unavailable' }

export class SecureCredentialUnavailableError extends Error {
  readonly name = 'SecureCredentialUnavailableError'

  constructor() {
    super('Penyimpanan kredensial aman Android tidak tersedia.')
  }
}

export class LegacyCredentialRemovalError extends Error {
  readonly name = 'LegacyCredentialRemovalError'

  constructor() {
    super(
      'Kredensial aman sudah tersimpan, tetapi token lama belum dapat dihapus. Coba lagi untuk menyelesaikan migrasi keamanan.',
    )
  }
}

export async function loadAccountCredential(
  storage: AccountCredentialStorage,
): Promise<LoadedAccountCredential> {
  switch (storage.kind) {
    case 'browser': {
      const value = await storage.legacy.read()
      return value ? { kind: 'loaded', value } : { kind: 'missing' }
    }
    case 'android':
      return loadAndroidAccountCredential(storage)
  }
}

async function loadAndroidAccountCredential(
  storage: Extract<AccountCredentialStorage, { readonly kind: 'android' }>,
): Promise<LoadedAccountCredential> {
  let secureValue: string | null
  try {
    secureValue = await storage.secure.read()
  } catch {
    return { kind: 'secure-unavailable' }
  }

  if (secureValue) {
    if (!(await eraseLegacyCredential(storage.legacy))) {
      return { kind: 'migration-incomplete' }
    }
    return { kind: 'loaded', value: secureValue }
  }

  const legacyValue = await storage.legacy.read()
  if (!legacyValue) return { kind: 'missing' }

  try {
    await storage.secure.write(legacyValue)
  } catch {
    return { kind: 'secure-unavailable' }
  }

  if (!(await eraseLegacyCredential(storage.legacy))) {
    return { kind: 'migration-incomplete' }
  }
  return { kind: 'loaded', value: legacyValue }
}

export async function persistAccountCredential(
  storage: AccountCredentialStorage,
  value: string,
): Promise<void> {
  switch (storage.kind) {
    case 'browser':
      await storage.legacy.write(value)
      return
    case 'android':
      try {
        await storage.secure.write(value)
      } catch {
        throw new SecureCredentialUnavailableError()
      }
      if (!(await eraseLegacyCredential(storage.legacy))) {
        throw new LegacyCredentialRemovalError()
      }
  }
}

export async function clearAccountCredential(
  storage: AccountCredentialStorage,
): Promise<void> {
  switch (storage.kind) {
    case 'browser':
      await storage.legacy.remove()
      return
    case 'android':
      try {
        await storage.secure.remove()
      } catch {
        await eraseLegacyCredential(storage.legacy)
        throw new SecureCredentialUnavailableError()
      }
      if (!(await eraseLegacyCredential(storage.legacy))) {
        throw new LegacyCredentialRemovalError()
      }
  }
}

async function eraseLegacyCredential(legacy: LegacyCredentialStore): Promise<boolean> {
  try {
    await legacy.remove()
    return true
  } catch {
    return false
  }
}
