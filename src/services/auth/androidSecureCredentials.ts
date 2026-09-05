import { Capacitor, registerPlugin } from '@capacitor/core'
import type { SecureCredentialStore } from './accountCredentials'

interface SecureCredentialPlugin {
  get(): Promise<{ readonly value?: string }>
  set(options: { readonly value: string }): Promise<void>
  remove(): Promise<void>
}

const PLUGIN_NAME = 'SecureCredential'
const SecureCredentialNative = registerPlugin<SecureCredentialPlugin>(PLUGIN_NAME)

export class SecureCredentialBridgeUnavailableError extends Error {
  readonly name = 'SecureCredentialBridgeUnavailableError'

  constructor() {
    super('Penyimpanan kredensial aman Android tidak tersedia.')
  }
}

async function callSecureBridge<T>(run: () => Promise<T>): Promise<T> {
  if (!Capacitor.isPluginAvailable(PLUGIN_NAME)) {
    throw new SecureCredentialBridgeUnavailableError()
  }

  try {
    return await run()
  } catch {
    throw new SecureCredentialBridgeUnavailableError()
  }
}

export const androidSecureCredentialStore: SecureCredentialStore = {
  async read(): Promise<string | null> {
    const result = await callSecureBridge(() => SecureCredentialNative.get())
    return result.value ?? null
  },
  async write(value: string): Promise<void> {
    await callSecureBridge(() => SecureCredentialNative.set({ value }))
  },
  async remove(): Promise<void> {
    await callSecureBridge(() => SecureCredentialNative.remove())
  },
}
