/**
 * Kontrak sync — SEMUA tabel bisnis punya kolom ini sejak hari 1.
 * Ini yang bikin app siap sync ke "POS Pro" cloud nanti tanpa migrasi besar.
 */
export interface SyncEntity {
  id: string // UUID v4 (client-generated)
  created_at: number // epoch ms
  updated_at: number // epoch ms — di-bump tiap write, jadi cursor pull + last-write-wins
  deleted_at: number | null // soft delete
  dirty: number // 1 = ada perubahan lokal belum ke-push
  sync_version: number // revisi dari server (buat deteksi konflik)
  remote_id: string | null // key server kalau beda dari UUID
}

/** Hasil operasi write. */
export interface RunResult {
  changes: number
  lastId?: number
}

/** Abstraksi DB — repository & service HANYA kenal interface ini, gak pernah
 *  nyentuh plugin SQLite langsung. Implementasinya ada di sqlite.ts. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<RunResult>
  /** Untuk DDL multi-statement (migrations). */
  execute(sql: string): Promise<void>
  /** Jalanin fn dalam 1 transaksi atomic. Reentrant: kalau sudah di dalam
   *  transaksi, fn ikut transaksi yang sedang berjalan (gak nested-commit). */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
}

// ── Row types ────────────────────────────────────────────────────────────────

export interface Category extends SyncEntity {
  name: string
  sort_order: number
  color: string | null
}

export interface Product extends SyncEntity {
  category_id: string | null
  name: string
  sku: string | null
  barcode: string | null
  price: number // minor units
  cost: number
  track_stock: number // 0/1
  stock: number
  image_path: string | null
  active: number // 0/1
}

export interface Media extends SyncEntity {
  mime: string // mis. 'image/jpeg'
  width: number | null
  height: number | null
  bytes: number | null // ukuran biner (perkiraan) buat info/limit
  hash: string | null // SHA-256 hex dari base64 → dedup + deteksi perubahan
  data: string | null // base64 (tanpa prefix data:) — null saat remote_url terisi (future)
  remote_url: string | null // diisi POS Pro nanti; kalau ada, data boleh di-drop
}

export interface CashierSession extends SyncEntity {
  opened_at: number
  closed_at: number | null
  opening_cash: number
  expected_cash: number
  counted_cash: number | null
  difference: number | null
  status: 'open' | 'closed'
  opened_by: string | null
  note: string | null
}

export interface Sale extends SyncEntity {
  session_id: string | null
  number: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  change_due: number
  payment_method: string
  status: 'completed' | 'void'
  sold_at: number
}

export interface SaleItem extends SyncEntity {
  sale_id: string
  product_id: string | null
  name_snapshot: string
  price_snapshot: number
  qty: number
  discount: number
  line_total: number
}

export interface CashflowCategory extends SyncEntity {
  name: string
  type: 'income' | 'expense'
  is_system: number // 0/1 — kategori 'Penjualan' gak bisa dihapus
  sort_order: number
}

export interface CashflowEntry extends SyncEntity {
  category_id: string | null
  session_id: string | null
  direction: 'debit' | 'credit' // debit = uang masuk, credit = uang keluar
  amount: number
  source: 'manual' | 'sale'
  source_ref: string | null // sales.id kalau dari checkout
  note: string | null
  occurred_at: number
}

export interface SettingRow {
  key: string
  value: string
  updated_at: number
  dirty: number
  sync_version: number
}

export type OutboxOp = 'insert' | 'update' | 'delete'
export type OutboxStatus = 'pending' | 'sent' | 'failed'

export interface OutboxRow {
  id: string
  entity: string
  entity_id: string
  op: OutboxOp
  payload: string // JSON
  created_at: number
  attempts: number
  last_error: string | null
  status: OutboxStatus
}

export interface SyncStateRow {
  entity: string
  last_pulled_at: number
  last_pushed_at: number
}
