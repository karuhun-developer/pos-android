/** Epoch milliseconds — sumber waktu tunggal seluruh app.
 *  Dipisah jadi fungsi supaya gampang di-mock saat test. */
export function nowMs(): number {
  return Date.now()
}

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFmt = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms))
}

export function formatDateTime(ms: number): string {
  return dateTimeFmt.format(new Date(ms))
}

export function formatTime(ms: number): string {
  return timeFmt.format(new Date(ms))
}

/** Awal hari (00:00:00.000) lokal dari suatu waktu. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Akhir hari (23:59:59.999) lokal dari suatu waktu. */
export function endOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** "YYYY-MM-DD" lokal — dipakai buat grouping ledger per hari. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "YYYY-MM" lokal — dipakai buat ringkasan cashflow per bulan. */
export function monthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** 175... -> "Agustus 2026" */
export function formatMonth(ms: number): string {
  return monthFmt.format(new Date(ms))
}
