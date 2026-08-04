import { BaseRepository } from '@/db/BaseRepository'
import type { CashierSession } from '@/db/types'

/** Ringkasan uang sesi buat hitung expected cash saat tutup kasir. */
export interface SessionCashSummary {
  openingCash: number
  cashSales: number // penjualan TUNAI dalam sesi (yang nambah laci)
  salesCount: number // jumlah transaksi selesai dalam sesi (semua metode)
  salesTotal: number // omzet semua metode dalam sesi
  manualIn: number // cashflow manual debit (uang masuk laci)
  manualOut: number // cashflow manual credit (uang keluar laci)
  expectedCash: number // perkiraan isi laci = opening + cashSales + manualIn - manualOut
}

export class CashierSessionRepository extends BaseRepository<CashierSession> {
  protected readonly table = 'cashier_sessions'

  /** Sesi yang masih terbuka (harusnya paling banyak satu). */
  async current(): Promise<CashierSession | null> {
    const rows = await this.db.query<CashierSession>(
      `SELECT * FROM cashier_sessions
       WHERE status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
    )
    return rows[0] ?? null
  }

  /** Riwayat sesi terbaru (default 30). */
  listRecent(limit = 30): Promise<CashierSession[]> {
    return this.db.query<CashierSession>(
      `SELECT * FROM cashier_sessions WHERE deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT ?`,
      [limit],
    )
  }

  /**
   * Hitung ringkasan uang sesi. Cash sales diambil langsung dari `sales`
   * (metode 'cash') supaya QRIS/transfer tidak ikut nambah laci. Cashflow
   * 'sale' otomatis di-skip (source='manual') agar tidak dobel-hitung.
   */
  async summary(session: CashierSession): Promise<SessionCashSummary> {
    const [sales] = await this.db.query<{
      cash_sales: number
      sales_count: number
      sales_total: number
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total END), 0) AS cash_sales,
         COUNT(*) AS sales_count,
         COALESCE(SUM(total), 0) AS sales_total
       FROM sales
       WHERE session_id = ? AND status = 'completed' AND deleted_at IS NULL`,
      [session.id],
    )

    const [manual] = await this.db.query<{ manual_in: number; manual_out: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount END), 0) AS manual_in,
         COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount END), 0) AS manual_out
       FROM cashflow_entries
       WHERE session_id = ? AND source = 'manual' AND deleted_at IS NULL`,
      [session.id],
    )

    const cashSales = sales?.cash_sales ?? 0
    const manualIn = manual?.manual_in ?? 0
    const manualOut = manual?.manual_out ?? 0

    return {
      openingCash: session.opening_cash,
      cashSales,
      salesCount: sales?.sales_count ?? 0,
      salesTotal: sales?.sales_total ?? 0,
      manualIn,
      manualOut,
      expectedCash: session.opening_cash + cashSales + manualIn - manualOut,
    }
  }
}
