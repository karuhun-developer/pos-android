import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  clearAccountCredential,
  loadAccountCredential,
  persistAccountCredential,
} from '../src/services/auth/accountCredentials.ts'

const REDACTED_FIXTURE = 'redacted-test-credential'

function fingerprint(value) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createLegacyStore(initialValue = null, options = {}) {
  let value = initialValue
  let writes = 0
  let removals = 0
  let failRemove = options.failRemove ?? false

  return {
    async read() {
      return value
    },
    async write(nextValue) {
      writes += 1
      value = nextValue
    },
    async remove() {
      removals += 1
      if (failRemove) throw new Error('legacy removal failed')
      value = null
    },
    setRemoveFailure(nextValue) {
      failRemove = nextValue
    },
    snapshot() {
      return { hasValue: value !== null, writes, removals }
    },
  }
}

function createSecureStore(initialValue = null, options = {}) {
  let value = initialValue
  let writes = 0
  let removals = 0
  const failRemove = options.failRemove ?? false

  return {
    async read() {
      return value
    },
    async write(nextValue) {
      writes += 1
      value = nextValue
    },
    async remove() {
      removals += 1
      if (failRemove) throw new Error('secure removal failed')
      value = null
    },
    snapshot() {
      return { hasValue: value !== null, writes, removals, fingerprint: value ? fingerprint(value) : null }
    },
  }
}

async function testAndroidSecureStoreReadDelete() {
  // Given: Android has no legacy credential and a functional secure store.
  const legacy = createLegacyStore()
  const secure = createSecureStore()
  const storage = { kind: 'android', legacy, secure }

  // When: a credential is persisted, loaded, then cleared.
  await persistAccountCredential(storage, REDACTED_FIXTURE)
  const loaded = await loadAccountCredential(storage)
  await clearAccountCredential(storage)

  // Then: only the secure store held it and both stores are cleared.
  assert.equal(loaded.kind, 'loaded')
  if (loaded.kind === 'loaded') {
    assert.equal(fingerprint(loaded.value), fingerprint(REDACTED_FIXTURE))
  }
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 3 })
  assert.deepEqual(secure.snapshot(), { hasValue: false, writes: 1, removals: 1, fingerprint: null })
  console.log('PASS android secure store/read/delete')
}

async function testAndroidLegacyMigrationErasesPlaintext() {
  // Given: Android starts with a legacy SQLite credential only.
  const legacy = createLegacyStore(REDACTED_FIXTURE)
  const secure = createSecureStore()
  const storage = { kind: 'android', legacy, secure }

  // When: the credential is loaded.
  const loaded = await loadAccountCredential(storage)

  // Then: it is available from secure storage and the plaintext source is erased.
  assert.equal(loaded.kind, 'loaded')
  if (loaded.kind === 'loaded') {
    assert.equal(fingerprint(loaded.value), fingerprint(REDACTED_FIXTURE))
  }
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 1 })
  assert.deepEqual(secure.snapshot(), { hasValue: true, writes: 1, removals: 0, fingerprint: fingerprint(REDACTED_FIXTURE) })
  console.log('PASS Android one-time migration removes plaintext')
}

async function testBrowserKeepsExistingPersistence() {
  // Given: a browser credential store.
  const legacy = createLegacyStore()
  const storage = { kind: 'browser', legacy }

  // When: the credential is persisted and loaded.
  await persistAccountCredential(storage, REDACTED_FIXTURE)
  const loaded = await loadAccountCredential(storage)

  // Then: browser persistence continues to use its legacy storage.
  assert.equal(loaded.kind, 'loaded')
  if (loaded.kind === 'loaded') {
    assert.equal(fingerprint(loaded.value), fingerprint(REDACTED_FIXTURE))
  }
  assert.deepEqual(legacy.snapshot(), { hasValue: true, writes: 1, removals: 0 })
  console.log('PASS non-Android persistence remains compatible')
}

async function testAndroidUnavailableFailsClosed() {
  // Given: Android has a plaintext legacy credential but the native bridge fails.
  const legacy = createLegacyStore(REDACTED_FIXTURE)
  const storage = {
    kind: 'android',
    legacy,
    secure: {
      async read() {
        throw new Error('bridge unavailable')
      },
      async write() {
        throw new Error('bridge unavailable')
      },
      async remove() {
        throw new Error('bridge unavailable')
      },
    },
  }

  // When: the account attempts to load its credential.
  const loaded = await loadAccountCredential(storage)
  await assert.rejects(() => persistAccountCredential(storage, REDACTED_FIXTURE), {
    name: 'SecureCredentialUnavailableError',
  })

  // Then: no session is returned but the only recoverable credential remains.
  assert.deepEqual(loaded, { kind: 'secure-unavailable' })
  assert.deepEqual(legacy.snapshot(), { hasValue: true, writes: 0, removals: 0 })
  console.log('PASS unavailable Android bridge fails closed without credential loss')
}

async function testAndroidSecureWriteFailurePreservesLegacyCredential() {
  // Given: an old plaintext credential and an Android bridge that cannot persist.
  const legacy = createLegacyStore(REDACTED_FIXTURE)
  const storage = {
    kind: 'android',
    legacy,
    secure: {
      async read() {
        return null
      },
      async write() {
        throw new Error('bridge unavailable')
      },
      async remove() {
        throw new Error('bridge unavailable')
      },
    },
  }

  // When: migration and a fresh Android authentication cannot secure a credential.
  const loaded = await loadAccountCredential(storage)
  await assert.rejects(() => persistAccountCredential(storage, REDACTED_FIXTURE), {
    name: 'SecureCredentialUnavailableError',
  })

  // Then: Android fails closed without deleting the only recoverable credential.
  assert.deepEqual(loaded, { kind: 'secure-unavailable' })
  assert.deepEqual(legacy.snapshot(), { hasValue: true, writes: 0, removals: 0 })
  console.log('PASS secure-write failure preserves legacy credential')
}

async function testAndroidLegacyEraseFailureRequiresExplicitRetry() {
  // Given: Android has a legacy credential and its plaintext erase initially fails.
  const legacy = createLegacyStore(REDACTED_FIXTURE, { failRemove: true })
  const secure = createSecureStore()
  const storage = { kind: 'android', legacy, secure }

  // When: migration writes securely but cannot erase the legacy value.
  const incomplete = await loadAccountCredential(storage)

  // Then: no session is claimed, both locations are visible to recovery, and retry can finish.
  assert.deepEqual(incomplete, { kind: 'migration-incomplete' })
  assert.deepEqual(legacy.snapshot(), { hasValue: true, writes: 0, removals: 1 })
  assert.deepEqual(secure.snapshot(), { hasValue: true, writes: 1, removals: 0, fingerprint: fingerprint(REDACTED_FIXTURE) })
  legacy.setRemoveFailure(false)
  const retried = await loadAccountCredential(storage)
  assert.equal(retried.kind, 'loaded')
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 2 })
  console.log('PASS legacy erase failure is visible and retried')
}

async function testAndroidAuthLegacyEraseFailureIsRecoverable() {
  // Given: a legacy credential cannot be erased after a successful secure write.
  const legacy = createLegacyStore(REDACTED_FIXTURE, { failRemove: true })
  const secure = createSecureStore()
  const storage = { kind: 'android', legacy, secure }

  // When: a new Android authentication persists its credential.
  await assert.rejects(() => persistAccountCredential(storage, REDACTED_FIXTURE), {
    name: 'LegacyCredentialRemovalError',
  })

  // Then: the secret is not silently cleared or reported as a successful session.
  assert.deepEqual(legacy.snapshot(), { hasValue: true, writes: 0, removals: 1 })
  assert.deepEqual(secure.snapshot(), { hasValue: true, writes: 1, removals: 0, fingerprint: fingerprint(REDACTED_FIXTURE) })
  console.log('PASS auth migration erase failure remains recoverable')
}

async function testLogoutSecureDeleteFailureKeepsSessionState() {
  // Given: secure credential deletion fails during logout.
  const legacy = createLegacyStore(REDACTED_FIXTURE)
  const secure = createSecureStore(REDACTED_FIXTURE, { failRemove: true })
  const storage = { kind: 'android', legacy, secure }

  // When: logout clears credentials.
  await assert.rejects(() => clearAccountCredential(storage), {
    name: 'SecureCredentialUnavailableError',
  })

  // Then: the secure secret remains and production orders state clearing after deletion.
  assert.deepEqual(secure.snapshot(), { hasValue: true, writes: 0, removals: 1, fingerprint: fingerprint(REDACTED_FIXTURE) })
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 1 })
  const accountSource = await readFile(new URL('../src/stores/account.ts', import.meta.url), 'utf8')
  const clearSession = accountSource.match(/async function clearSession\(\): Promise<void> \{([\s\S]*?)\n  \}/)
  assert.ok(clearSession, 'account store must retain a clearSession implementation')
  assert.ok(
    clearSession[1].indexOf('await clearAccountCredential') < clearSession[1].indexOf('token.value = null'),
    'logout must not clear in-memory authentication before secure credential deletion succeeds',
  )
  console.log('PASS logout secure-delete failure keeps session state')
}

async function testLogoutSecureDeleteFailureIsVisibleInUi() {
  // Given: the explicit logout path can reject when secure deletion fails.
  const connectPageSource = await readFile(new URL('../src/pages/settings/ConnectPage.vue', import.meta.url), 'utf8')

  // When: the page handles the user-triggered logout action.

  // Then: it must surface a meaningful Indonesian error without exposing credential data.
  assert.match(
    connectPageSource,
    /async function onLogout\(\) \{[\s\S]*?try \{[\s\S]*?await account\.logout\(\)[\s\S]*?\} catch \(error\) \{[\s\S]*?error instanceof SecureCredentialUnavailableError[\s\S]*?account\.error = 'Gagal keluar dengan aman\. Kredensial perangkat belum dihapus\.'/,
    'logout UI must surface a meaningful Indonesian secure-delete error',
  )
  console.log('PASS logout secure-delete failure is visible in UI')
}

const tests = [
  testAndroidSecureStoreReadDelete,
  testAndroidLegacyMigrationErasesPlaintext,
  testBrowserKeepsExistingPersistence,
  testAndroidUnavailableFailsClosed,
  testAndroidSecureWriteFailurePreservesLegacyCredential,
  testAndroidLegacyEraseFailureRequiresExplicitRetry,
  testAndroidAuthLegacyEraseFailureIsRecoverable,
  testLogoutSecureDeleteFailureKeepsSessionState,
  testLogoutSecureDeleteFailureIsVisibleInUi,
]

let failures = 0
for (const test of tests) {
  try {
    await test()
  } catch (error) {
    failures += 1
    const message = error instanceof Error ? error.message : String(error)
    console.error('FAIL ' + test.name + ': ' + message)
  }
}

if (failures > 0) {
  console.error('FAILED ' + failures + ' focused credential-security cases')
  process.exitCode = 1
}
