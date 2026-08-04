import { getDb } from './sqlite'

/**
 * Tabel bisnis yang ikut sync (ter-scope per outlet di server). Diurut anak →
 * induk sekadar rapi; FK tidak di-enforce keras jadi urutan tak wajib.
 * `settings` TIDAK termasuk — device-local (PIN, device_id, token akun, tema).
 */
const BUSINESS_TABLES = [
  'sale_items',
  'sales',
  'cashflow_entries',
  'cashflow_categories',
  'cashier_sessions',
  'products',
  'categories',
  'media',
] as const

/**
 * Buang seluruh data bisnis lokal + antrean outbox + cursor sync dalam satu
 * transaksi. Dipakai saat **pindah outlet**: data outlet lama dihapus supaya
 * tidak nyampur, `sync_state` dikosongkan agar siklus sync berikutnya menarik
 * ulang data outlet baru dari nol (`since=0` → pull penuh).
 *
 * Catatan: pastikan outbox pending sudah di-*push* dulu sebelum memanggil ini,
 * karena antrean yang belum terkirim ikut terhapus.
 */
export async function resetLocalBusinessData(): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    for (const t of BUSINESS_TABLES) await tx.run(`DELETE FROM ${t}`)
    await tx.run('DELETE FROM outbox')
    await tx.run('DELETE FROM sync_state')
  })
}
