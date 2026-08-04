import type { Db, CashierSession } from '@/db/types'
import {
  CashierSessionRepository,
  type SessionCashSummary,
} from '@/repositories/cashierSession.repo'
import { nowMs } from '@/lib/datetime'

export interface OpenSessionInput {
  openingCash: number
  openedBy?: string | null
  note?: string | null
}

export interface CloseSessionInput {
  sessionId: string
  countedCash: number
  note?: string | null
}

/**
 * Orkestrasi buka/tutup kasir. Buka = bikin sesi 'open' (tolak kalau sudah ada
 * sesi terbuka). Tutup = hitung expected cash dari transaksi sesi, simpan
 * counted + selisih, set status 'closed'.
 */
export class CashierService {
  constructor(private readonly db: Db) {}

  private repo() {
    return new CashierSessionRepository(this.db)
  }

  async open(input: OpenSessionInput): Promise<CashierSession> {
    const existing = await this.repo().current()
    if (existing) throw new Error('Masih ada sesi kasir yang terbuka')

    return this.repo().create({
      opened_at: nowMs(),
      closed_at: null,
      opening_cash: Math.max(0, Math.round(input.openingCash || 0)),
      expected_cash: 0,
      counted_cash: null,
      difference: null,
      status: 'open',
      opened_by: input.openedBy ?? null,
      note: input.note ?? null,
    })
  }

  /** Ringkasan uang sesi terbuka (buat tampil live sebelum tutup). */
  async summary(session: CashierSession): Promise<SessionCashSummary> {
    return this.repo().summary(session)
  }

  async close(input: CloseSessionInput): Promise<CashierSession | null> {
    const repo = this.repo()
    const session = await repo.findById(input.sessionId)
    if (!session) throw new Error('Sesi tidak ditemukan')
    if (session.status !== 'open') throw new Error('Sesi sudah ditutup')

    const { expectedCash } = await repo.summary(session)
    const counted = Math.max(0, Math.round(input.countedCash || 0))

    return repo.update(session.id, {
      closed_at: nowMs(),
      expected_cash: expectedCash,
      counted_cash: counted,
      difference: counted - expectedCash,
      status: 'closed',
      note: input.note ?? session.note,
    })
  }
}
