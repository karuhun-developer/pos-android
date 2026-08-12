import type { Db } from './types'
import { nowMs } from '@/lib/datetime'
import { seedDefaultCashflowCategories } from './seedCashflow'

interface Migration {
  version: number
  name: string
  up: (db: Db) => Promise<void>
}

/** Kolom sync standar yang ditempel ke tiap tabel bisnis. */
const SYNC_COLS = `
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  dirty INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  remote_id TEXT
`

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          color TEXT,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT,
          name TEXT NOT NULL,
          sku TEXT,
          barcode TEXT,
          price INTEGER NOT NULL DEFAULT 0,
          cost INTEGER NOT NULL DEFAULT 0,
          track_stock INTEGER NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          image_path TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS cashier_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          opened_at INTEGER NOT NULL,
          closed_at INTEGER,
          opening_cash INTEGER NOT NULL DEFAULT 0,
          expected_cash INTEGER NOT NULL DEFAULT 0,
          counted_cash INTEGER,
          difference INTEGER,
          status TEXT NOT NULL DEFAULT 'open',
          opened_by TEXT,
          note TEXT,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT,
          number TEXT NOT NULL,
          subtotal INTEGER NOT NULL DEFAULT 0,
          discount INTEGER NOT NULL DEFAULT 0,
          tax INTEGER NOT NULL DEFAULT 0,
          total INTEGER NOT NULL DEFAULT 0,
          paid INTEGER NOT NULL DEFAULT 0,
          change_due INTEGER NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          status TEXT NOT NULL DEFAULT 'completed',
          sold_at INTEGER NOT NULL,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY NOT NULL,
          sale_id TEXT NOT NULL,
          product_id TEXT,
          name_snapshot TEXT NOT NULL,
          price_snapshot INTEGER NOT NULL DEFAULT 0,
          qty INTEGER NOT NULL DEFAULT 1,
          discount INTEGER NOT NULL DEFAULT 0,
          line_total INTEGER NOT NULL DEFAULT 0,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS cashflow_categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'expense',
          is_system INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS cashflow_entries (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT,
          session_id TEXT,
          direction TEXT NOT NULL DEFAULT 'debit',
          amount INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'manual',
          source_ref TEXT,
          note TEXT,
          occurred_at INTEGER NOT NULL,
          ${SYNC_COLS}
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT,
          updated_at INTEGER NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 1,
          sync_version INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          op TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS sync_state (
          entity TEXT PRIMARY KEY NOT NULL,
          last_pulled_at INTEGER NOT NULL DEFAULT 0,
          last_pushed_at INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_dirty ON products(dirty);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id, sold_at);
        CREATE INDEX IF NOT EXISTS idx_cashflow_cat ON cashflow_entries(category_id, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_cashflow_session ON cashflow_entries(session_id);
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);
      `)
    },
  },
  {
    version: 2,
    name: 'seed-defaults',
    up: async (db) => {
      // Kategori cashflow bawaan (idempotent, sumber tunggal di seedCashflow.ts).
      // Tetap dipanggil tiap boot & setelah reset — lihat initDb/resetLocalBusinessData.
      await seedDefaultCashflowCategories(db)
    },
  },
  {
    version: 3,
    name: 'media-table',
    up: async (db) => {
      // Simpan byte gambar terpisah dari row bisnis. products.image_path cuma
      // nyimpen ref 'media://<id>' → row produk & payload outbox tetap ringan.
      // Media = SyncEntity → ikut mekanisme outbox → sync otomatis.
      await db.execute(`
        CREATE TABLE IF NOT EXISTS media (
          id TEXT PRIMARY KEY NOT NULL,
          mime TEXT NOT NULL DEFAULT 'image/jpeg',
          width INTEGER,
          height INTEGER,
          bytes INTEGER,
          hash TEXT,
          data TEXT,
          remote_url TEXT,
          ${SYNC_COLS}
        );

        CREATE INDEX IF NOT EXISTS idx_media_hash ON media(hash);
        CREATE INDEX IF NOT EXISTS idx_media_dirty ON media(dirty);
      `)
    },
  },
  {
    version: 4,
    name: 'product-barcode-type',
    up: async (db) => {
      // Simbologi barcode per produk — dipakai JsBarcode buat render & validasi.
      // NOT NULL wajib punya DEFAULT di ALTER TABLE SQLite; 'EAN13' = standar
      // barcode produk ritel, jadi default yang paling sering benar.
      // Index barcode buat lookup mode scan kasir.
      await db.execute(`
        ALTER TABLE products ADD COLUMN barcode_type TEXT NOT NULL DEFAULT 'EAN13';
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      `)
    },
  },
]

/** Jalanin migrasi yang belum di-apply, berurutan, tiap satu dalam transaksi. */
export async function runMigrations(db: Db): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)

  const applied = await db.query<{ version: number }>(
    'SELECT version FROM schema_migrations',
  )
  const done = new Set(applied.map((r) => r.version))

  for (const m of migrations.sort((a, b) => a.version - b.version)) {
    if (done.has(m.version)) continue
    await db.transaction(async (tx) => {
      await m.up(tx)
      await tx.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, nowMs()],
      )
    })
  }
}
