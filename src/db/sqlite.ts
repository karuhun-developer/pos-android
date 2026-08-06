import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import type { Db, RunResult } from './types'
import { runMigrations } from './migrations'
import { seedDefaultCashflowCategories } from './seedCashflow'

const DB_NAME = 'poskacaw'
const DB_VERSION = 1

let sqlite: SQLiteConnection | null = null
let dbConn: SQLiteDBConnection | null = null
let db: Db | null = null
let initPromise: Promise<Db> | null = null

const isWeb = Capacitor.getPlatform() === 'web'

/**
 * Bootstrap khusus web: jeep-sqlite adalah web-component yang mem-provide
 * SQLite via WebAssembly (sql.js) + persist ke IndexedDB. WAJIB dijalanin
 * SEBELUM query apapun. Di Android ini di-skip total (pakai SQLite native).
 */
async function initWebStore(conn: SQLiteConnection): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader')
  defineCustomElements(window)
  let el = document.querySelector('jeep-sqlite')
  if (!el) {
    el = document.createElement('jeep-sqlite')
    document.body.appendChild(el)
  }
  await customElements.whenDefined('jeep-sqlite')
  await conn.initWebStore()
}

/** Wrapper yang meng-implement interface Db di atas SQLiteDBConnection.
 *  Reentrant transaction: kalau sudah di dalam tx, join tx yang jalan. */
class SqliteDb implements Db {
  constructor(
    private readonly conn: SQLiteDBConnection,
    private inTx = false,
  ) {}

  get inTransaction(): boolean {
    return this.inTx
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.conn.query(sql, params as never[])
    return (res.values ?? []) as T[]
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    // transaction:false -> jangan auto-commit; commit dikontrol oleh transaction()
    const res = await this.conn.run(sql, params as never[], false)
    return {
      changes: res.changes?.changes ?? 0,
      lastId: res.changes?.lastId,
    }
  }

  async execute(sql: string): Promise<void> {
    await this.conn.execute(sql, false)
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.inTx) {
      // sudah di dalam transaksi -> join, jangan buka transaksi baru
      return fn(this)
    }
    const tx = new SqliteDb(this.conn, true)
    await this.conn.beginTransaction()
    try {
      const result = await fn(tx)
      if (await this.conn.isTransactionActive()) {
        await this.conn.commitTransaction()
      }
      return result
    } catch (err) {
      if (await this.conn.isTransactionActive()) {
        await this.conn.rollbackTransaction()
      }
      throw err
    }
  }
}

/** Inisialisasi DB sekali saja (idempotent). Panggil di main.ts sebelum mount. */
export async function initDb(): Promise<Db> {
  if (db) return db
  if (initPromise) return initPromise

  initPromise = (async () => {
    sqlite = new SQLiteConnection(CapacitorSQLite)

    if (isWeb) {
      await initWebStore(sqlite)
    }

    // Reuse koneksi lama kalau ada (hot reload).
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result
    dbConn = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)

    await dbConn.open()

    db = new SqliteDb(dbConn)
    await runMigrations(db)
    // Jamin kategori cashflow default selalu ada (idempotent) — nutup kasus
    // migration tak re-run setelah reset & set default yang diperluas.
    await seedDefaultCashflowCategories(db)

    if (isWeb) {
      // persist schema awal ke IndexedDB
      await sqlite.saveToStore(DB_NAME)
    }
    return db
  })()

  return initPromise
}

/** Ambil instance Db yang sudah siap. Lempar error kalau belum initDb(). */
export function getDb(): Db {
  if (!db) throw new Error('DB belum diinisialisasi — panggil initDb() dulu di main.ts')
  return db
}

/** Persist ke IndexedDB (khusus web). Dipanggil setelah write penting. */
export async function persist(): Promise<void> {
  if (isWeb && sqlite) {
    await sqlite.saveToStore(DB_NAME)
  }
}

export async function closeDb(): Promise<void> {
  if (dbConn) await dbConn.close()
  if (sqlite) await sqlite.closeConnection(DB_NAME, false)
  db = null
  dbConn = null
  sqlite = null
  initPromise = null
}
