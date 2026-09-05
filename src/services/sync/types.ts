import type { OutboxOp } from '@/db/types'

/** Satu baris outbox yang siap dikirim ke server. */
export interface ChangeEnvelope {
  id: string
  entity: string
  entityId: string
  op: OutboxOp
  payload: unknown
  createdAt: number
}

export interface RejectedPushChange {
  readonly id: string
  readonly reason: string
}

export interface PushResult {
  readonly acked: readonly string[] // outbox id yang diterima server
  readonly rejected: readonly RejectedPushChange[]
}

export class InvalidPushResultError extends Error {
  constructor(message: string) {
    super(`Respons sync push tidak valid: ${message}`)
    this.name = 'InvalidPushResultError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every((key) => keys.includes(key))
}

function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidPushResultError(`${field} harus berupa string tidak kosong`)
  }
  return value
}

export function parsePushResult(value: unknown): PushResult {
  if (!isRecord(value) || !hasExactKeys(value, ['acked', 'rejected'])) {
    throw new InvalidPushResultError('bentuk root harus tepat berisi acked dan rejected')
  }

  if (!Array.isArray(value.acked)) {
    throw new InvalidPushResultError('acked harus berupa array')
  }
  if (!Array.isArray(value.rejected)) {
    throw new InvalidPushResultError('rejected harus berupa array')
  }

  const acked = value.acked.map((id, index) => parseNonEmptyString(id, `acked[${index}]`))
  const rejected = value.rejected.map((change, index): RejectedPushChange => {
    if (!isRecord(change) || !hasExactKeys(change, ['id', 'reason'])) {
      throw new InvalidPushResultError(`rejected[${index}] harus tepat berisi id dan reason`)
    }
    return {
      id: parseNonEmptyString(change.id, `rejected[${index}].id`),
      reason: parseNonEmptyString(change.reason, `rejected[${index}].reason`),
    }
  })

  return { acked, rejected }
}

export function assertPushResultMatchesSubmitted(
  result: PushResult,
  submittedIds: Iterable<string>,
): void {
  const submitted = new Set(submittedIds)
  const resolved = new Set<string>()

  for (const id of result.acked) {
    if (!submitted.has(id)) {
      throw new InvalidPushResultError(`acked memuat id di luar batch: ${id}`)
    }
    if (resolved.has(id)) {
      throw new InvalidPushResultError(`id diselesaikan lebih dari sekali: ${id}`)
    }
    resolved.add(id)
  }

  for (const rejected of result.rejected) {
    if (!submitted.has(rejected.id)) {
      throw new InvalidPushResultError(`rejected memuat id di luar batch: ${rejected.id}`)
    }
    if (resolved.has(rejected.id)) {
      throw new InvalidPushResultError(`id diselesaikan lebih dari sekali: ${rejected.id}`)
    }
    resolved.add(rejected.id)
  }
}

export interface PullResult {
  entity: string
  changes: Record<string, unknown>[]
  cursor: number // updated_at terbaru dari server
}

/**
 * Kontrak transport ke "POS Pro" (Generic REST/JWT). v1 belum ada
 * implementasi konkret → SyncEngine idle. Nanti: HttpSyncAdapter.
 */
export interface SyncAdapter {
  push(changes: ChangeEnvelope[]): Promise<PushResult>
  pull(entity: string, since: number): Promise<PullResult>
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled'

export interface SyncEngine {
  syncOnce(): Promise<void>
  start(): void
  stop(): void
  status(): SyncStatus
}
