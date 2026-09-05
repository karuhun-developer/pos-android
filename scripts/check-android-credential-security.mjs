import assert from 'node:assert/strict'

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

function createLegacyStore(initialValue = null) {
  let value = initialValue
  let writes = 0
  let removals = 0

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
      value = null
    },
    snapshot() {
      return { hasValue: value !== null, writes, removals }
    },
  }
}

function createSecureStore(initialValue = null) {
  let value = initialValue
  let writes = 0
  let removals = 0

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

  // Then: no session is returned and the plaintext fallback is erased.
  assert.deepEqual(loaded, { kind: 'secure-unavailable' })
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 2 })
  console.log('PASS unavailable Android bridge fails closed')
}

async function testAndroidFailedPersistErasesLegacyCredential() {
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

  // When: a fresh credential cannot be secured.
  await assert.rejects(() => persistAccountCredential(storage, REDACTED_FIXTURE), {
    name: 'SecureCredentialUnavailableError',
  })

  // Then: Android never retains the plaintext fallback.
  assert.deepEqual(legacy.snapshot(), { hasValue: false, writes: 0, removals: 1 })
  console.log('PASS failed Android persist erases plaintext fallback')
}

await testAndroidSecureStoreReadDelete()
await testAndroidLegacyMigrationErasesPlaintext()
await testBrowserKeepsExistingPersistence()
await testAndroidUnavailableFailsClosed()
await testAndroidFailedPersistErasesLegacyCredential()
