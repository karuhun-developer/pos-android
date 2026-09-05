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
  | { readonly kind: 'secure-unavailable' }

export class SecureCredentialUnavailableError extends Error {
  readonly name = 'SecureCredentialUnavailableError'

  constructor() {
    super('Penyimpanan kredensial aman Android tidak tersedia.')
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
    await storage.legacy.remove()
    return { kind: 'secure-unavailable' }
  }

  if (secureValue) {
    await storage.legacy.remove()
    return { kind: 'loaded', value: secureValue }
  }

  const legacyValue = await storage.legacy.read()
  if (!legacyValue) return { kind: 'missing' }

  try {
    await storage.secure.write(legacyValue)
  } catch {
    await storage.legacy.remove()
    return { kind: 'secure-unavailable' }
  }

  await storage.legacy.remove()
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
        await storage.legacy.remove()
        throw new SecureCredentialUnavailableError()
      }
      await storage.legacy.remove()
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
        throw new SecureCredentialUnavailableError()
      } finally {
        await storage.legacy.remove()
      }
  }
}
