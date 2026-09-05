import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SCREENSHOT = process.env.SCREENSHOT ?? '/tmp/pos-kacaw-ack-guard-evidence/push-response-guard-browser.png'

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
const consoleErrors = []
const network = []
const pushRequests = []
let pushResponse = { acked: [], rejected: [] }

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(String(error)))
page.on('request', (request) => {
  if (request.url().includes('/api/v1/sync/')) network.push(`request ${request.method()} ${request.url()}`)
})
page.on('response', (response) => {
  if (response.url().includes('/api/v1/sync/')) network.push(`response ${response.status()} ${response.url()}`)
})

async function query(sql, params = []) {
  return page.evaluate(
    ({ statement, values }) => window.__db.query(statement, values),
    { statement: sql, values: params },
  )
}

async function transaction(work) {
  return page.evaluate(
    async (operations) =>
      window.__db.transaction(async (db) => {
        for (const operation of operations) await db.run(operation.sql, operation.params)
      }),
    work,
  )
}

async function resetDatabase() {
  await transaction([
    { sql: 'DELETE FROM outbox', params: [] },
    { sql: 'DELETE FROM products', params: [] },
    { sql: 'DELETE FROM sync_state', params: [] },
  ])
}

function productOperation(id, dirty = 1) {
  return {
    sql: `INSERT INTO products (id, name, created_at, updated_at, deleted_at, dirty, sync_version, remote_id)
          VALUES (?, ?, 1, 101, NULL, ?, 0, NULL)`,
    params: [id, `Produk ${id}`, dirty],
  }
}

function outboxOperation(id, productId, status = 'pending', lastError = null, createdAt = 1) {
  return {
    sql: `INSERT INTO outbox (id, entity, entity_id, op, payload, created_at, attempts, last_error, status)
          VALUES (?, 'products', ?, 'update', ?, ?, 0, ?, ?)`,
    params: [id, productId, JSON.stringify({ id: productId, updated_at: 101 }), createdAt, lastError, status],
  }
}

async function outboxRow(id) {
  const rows = await query(
    'SELECT id, status, attempts, last_error FROM outbox WHERE id = ?',
    [id],
  )
  return rows[0] ?? null
}

async function productDirty(id) {
  const rows = await query('SELECT dirty FROM products WHERE id = ?', [id])
  return rows[0]?.dirty ?? null
}

async function runSync() {
  return page.evaluate(async () => {
    const [{ ApiClient }, { SyncEngine }] = await Promise.all([
      import('/src/services/api/client.ts'),
      import('/src/services/sync/SyncEngine.ts'),
    ])
    const client = new ApiClient({
      baseUrl: () => `${window.location.origin}/api/v1`,
      token: () => 'smoke-token',
      deviceId: () => 'smoke-device',
      storeId: () => 'smoke-store',
      onUnauthorized: () => {
        throw new Error('Unexpected unauthorized response')
      },
    })
    const engine = new SyncEngine(client, () => true, 60_000)
    await engine.syncOnce()
    return { status: engine.status(), error: engine.lastError() }
  })
}

async function finalizeDirectly(rows, acked, rejected) {
  return page.evaluate(
    async (finalization) => {
      const [{ OutboxRepository }, { getDb }] = await Promise.all([
        import('/src/repositories/outbox.repo.ts'),
        import('/src/db/sqlite.ts'),
      ])
      await new OutboxRepository(getDb()).finalizePush(finalization)
    },
    { rows, acked, rejected },
  )
}

function assertInvalid(result, name) {
  assert.equal(result.status, 'error', `${name}: invalid response must fail the sync cycle`)
  assert.notEqual(result.error, null, `${name}: invalid response must expose an error`)
}

async function assertUnchanged(rows, dirtyIds, name) {
  for (const expected of rows) {
    assert.deepEqual(await outboxRow(expected.id), expected, `${name}: outbox ${expected.id} changed`)
  }
  for (const id of dirtyIds) {
    assert.equal(await productDirty(id), 1, `${name}: dirty business row ${id} changed`)
  }
}

const failures = []

async function scenario(name, given, response, verify) {
  try {
    await resetDatabase()
    const fixture = await given()
    pushResponse = response
    const result = await runSync()
    const request = pushRequests.at(-1)
    assert.ok(request, `${name}: sync push request was not observed`)
    await verify({ fixture, result, request })
    console.log(`PASS ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${name}: ${message}`)
    console.error(`FAIL ${name}: ${message}`)
  }
}

try {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/sync/push') {
      pushRequests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pushResponse),
      })
      return
    }
    if (url.pathname === '/api/v1/sync/pull') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ changes: [], cursor: 0 }),
      })
      return
    }
    await route.fulfill({ status: 404, body: 'Unexpected smoke request' })
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('Menu Utama').waitFor({ timeout: 15_000 })

  await scenario(
    'malformed strict response is rejected before finalization',
    async () => {
      const productId = 'product-malformed'
      const row = { id: 'batch-malformed', status: 'pending', attempts: 0, last_error: null }
      await transaction([productOperation(productId), outboxOperation(row.id, productId)])
      return { productId, row }
    },
    { acked: [], rejected: [], unexpected: true },
    async ({ fixture, result, request }) => {
      assertInvalid(result, 'malformed strict response')
      assert.deepEqual(request.changes.map((change) => change.id), [fixture.row.id])
      await assertUnchanged([fixture.row], [fixture.productId], 'malformed strict response')
    },
  )

  await scenario(
    'acknowledging a non-batched failed row leaves every row untouched',
    async () => {
      const batchProduct = 'product-batch-failed-ack'
      const failedProduct = 'product-failed-ack'
      const batch = { id: 'batch-failed-ack', status: 'pending', attempts: 0, last_error: null }
      const failed = { id: 'failed-outside-batch', status: 'failed', attempts: 0, last_error: 'retry manually' }
      const sent = { id: 'sent-outside-batch', status: 'sent', attempts: 0, last_error: null }
      await transaction([
        productOperation(batchProduct),
        productOperation(failedProduct),
        outboxOperation(batch.id, batchProduct),
        outboxOperation(failed.id, failedProduct, 'failed', failed.last_error),
        outboxOperation(sent.id, 'sent-product', 'sent'),
      ])
      return { batchProduct, failedProduct, batch, failed, sent }
    },
    { acked: ['failed-outside-batch'], rejected: [] },
    async ({ fixture, result, request }) => {
      assertInvalid(result, 'non-batched failed acknowledgement')
      assert.deepEqual(request.changes.map((change) => change.id), [fixture.batch.id])
      await assertUnchanged(
        [fixture.batch, fixture.failed, fixture.sent],
        [fixture.batchProduct, fixture.failedProduct],
        'non-batched failed acknowledgement',
      )
    },
  )

  await scenario(
    'finalization rejects an alternate caller acknowledging a non-batched failed row',
    async () => {
      const batchProduct = 'product-direct-batch'
      const failedProduct = 'product-direct-failed'
      const batch = { id: 'batch-direct', status: 'pending', attempts: 0, last_error: null }
      const failed = { id: 'failed-direct', status: 'failed', attempts: 0, last_error: 'retry manually' }
      await transaction([
        productOperation(batchProduct),
        productOperation(failedProduct),
        outboxOperation(batch.id, batchProduct),
        outboxOperation(failed.id, failedProduct, 'failed', failed.last_error),
      ])
      const rows = await query('SELECT * FROM outbox WHERE id = ?', [batch.id])
      return { batchProduct, failedProduct, batch, failed, rows }
    },
    { acked: [], rejected: [] },
    async ({ fixture }) => {
      await assert.rejects(
        () => finalizeDirectly(fixture.rows, [fixture.failed.id], []),
        /Respons sync push tidak valid/,
        'finalization must reject a response ID outside its submitted rows',
      )
      await assertUnchanged(
        [fixture.batch, fixture.failed],
        [fixture.batchProduct, fixture.failedProduct],
        'alternate finalizer caller',
      )
    },
  )

  await scenario(
    'rejecting a pending row outside the submitted limit leaves it pending',
    async () => {
      const productId = 'product-pending-outside-batch'
      const target = { id: 'pending-outside-batch', status: 'pending', attempts: 0, last_error: null }
      const operations = [productOperation(productId)]
      for (let index = 1; index <= 200; index += 1) {
        operations.push(outboxOperation(`batch-${index}`, productId, 'pending', null, index))
      }
      operations.push(outboxOperation(target.id, productId, 'pending', null, 201))
      await transaction(operations)
      return { productId, target }
    },
    { acked: [], rejected: [{ id: 'pending-outside-batch', reason: 'stale' }] },
    async ({ fixture, result, request }) => {
      assertInvalid(result, 'non-batched pending rejection')
      const submitted = request.changes.map((change) => change.id)
      assert.equal(submitted.length, 200, 'only the pending batch limit may be submitted')
      assert.ok(!submitted.includes(fixture.target.id), 'target pending row was not submitted')
      await assertUnchanged([fixture.target], [fixture.productId], 'non-batched pending rejection')
    },
  )

  await scenario(
    'duplicate acknowledgement leaves the submitted row pending',
    async () => {
      const productId = 'product-duplicate-ack'
      const row = { id: 'batch-duplicate-ack', status: 'pending', attempts: 0, last_error: null }
      await transaction([productOperation(productId), outboxOperation(row.id, productId)])
      return { productId, row }
    },
    { acked: ['batch-duplicate-ack', 'batch-duplicate-ack'], rejected: [] },
    async ({ fixture, result }) => {
      assertInvalid(result, 'duplicate acknowledgement')
      await assertUnchanged([fixture.row], [fixture.productId], 'duplicate acknowledgement')
    },
  )

  await scenario(
    'acknowledgement and rejection conflict leaves the submitted row pending',
    async () => {
      const productId = 'product-ack-reject-conflict'
      const row = { id: 'batch-ack-reject-conflict', status: 'pending', attempts: 0, last_error: null }
      await transaction([productOperation(productId), outboxOperation(row.id, productId)])
      return { productId, row }
    },
    {
      acked: ['batch-ack-reject-conflict'],
      rejected: [{ id: 'batch-ack-reject-conflict', reason: 'stale' }],
    },
    async ({ fixture, result }) => {
      assertInvalid(result, 'acknowledgement/rejection conflict')
      await assertUnchanged([fixture.row], [fixture.productId], 'acknowledgement/rejection conflict')
    },
  )

  await scenario(
    'valid acknowledgement and rejection mutate only submitted rows',
    async () => {
      const ackProduct = 'product-valid-ack'
      const rejectProduct = 'product-valid-reject'
      const failedProduct = 'product-existing-failed'
      const ack = { id: 'batch-valid-ack', status: 'pending', attempts: 0, last_error: null }
      const rejected = { id: 'batch-valid-reject', status: 'pending', attempts: 0, last_error: null }
      const failed = { id: 'failed-existing', status: 'failed', attempts: 0, last_error: 'retry manually' }
      const sent = { id: 'sent-existing', status: 'sent', attempts: 0, last_error: null }
      await transaction([
        productOperation(ackProduct),
        productOperation(rejectProduct),
        productOperation(failedProduct),
        outboxOperation(ack.id, ackProduct),
        outboxOperation(rejected.id, rejectProduct),
        outboxOperation(failed.id, failedProduct, 'failed', failed.last_error),
        outboxOperation(sent.id, 'sent-product', 'sent'),
      ])
      return { ackProduct, rejectProduct, failedProduct, ack, rejected, failed, sent }
    },
    { acked: ['batch-valid-ack'], rejected: [{ id: 'batch-valid-reject', reason: 'stale' }] },
    async ({ fixture, result, request }) => {
      assert.equal(result.status, 'idle', 'valid response must finish the sync cycle')
      assert.equal(result.error, null, 'valid response must not expose an error')
      assert.deepEqual(
        new Set(request.changes.map((change) => change.id)),
        new Set([fixture.ack.id, fixture.rejected.id]),
      )
      assert.equal(await outboxRow(fixture.ack.id), null, 'acknowledged submitted row must be cleaned up')
      assert.equal(await productDirty(fixture.ackProduct), 0, 'acknowledgement must clear matching dirty data')
      assert.deepEqual(
        await outboxRow(fixture.rejected.id),
        { id: fixture.rejected.id, status: 'failed', attempts: 1, last_error: 'stale' },
        'rejection must fail only the submitted row',
      )
      assert.equal(await productDirty(fixture.rejectProduct), 1, 'rejection must retain dirty business data')
      await assertUnchanged([fixture.failed, fixture.sent], [fixture.failedProduct], 'valid response')
    },
  )

  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join(' | ')}`)
  await page.screenshot({ path: SCREENSHOT, fullPage: true })
  console.log(`Manual QA artifact: ${SCREENSHOT}`)
  console.log(`Network evidence: ${network.length} sync events observed`)
  if (failures.length) throw new Error(`Push response guard failures:\n${failures.join('\n')}`)
  console.log('PASS push-response-guard smoke: 7 scenarios')
} finally {
  await context.close()
  await browser.close()
}
