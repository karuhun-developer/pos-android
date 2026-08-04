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

export interface PushResult {
  acked: string[] // outbox id yang diterima server
  rejected: { id: string; reason: string }[]
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
