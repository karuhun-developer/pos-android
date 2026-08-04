import { nowMs, startOfDay, endOfDay, dayKey, formatDate } from './datetime'

/** Preset rentang tanggal buat filter riwayat (transaksi & cashflow). */
export type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

/** Rentang inklusif dalam epoch ms + preset asalnya (buat highlight tombol). */
export interface DateRange {
  from: number
  to: number
  preset: RangePreset
}

export const PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Hari ini',
  yesterday: 'Kemarin',
  week: 'Minggu ini',
  month: 'Bulan ini',
  custom: 'Kustom',
}

/** Bangun rentang dari preset. `to` di-cap ke akhir hari ini (tak ada data masa depan). */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, now = nowMs()): DateRange {
  const d = new Date(now)
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), preset }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { from: startOfDay(y.getTime()), to: endOfDay(y.getTime()), preset }
    }
    case 'week': {
      // Awal minggu = Senin. getDay(): 0=Minggu..6=Sabtu → offset ke Senin.
      const offsetToMonday = (d.getDay() + 6) % 7
      const monday = new Date(now)
      monday.setDate(d.getDate() - offsetToMonday)
      return { from: startOfDay(monday.getTime()), to: endOfDay(now), preset }
    }
    case 'month': {
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      return { from: startOfDay(first.getTime()), to: endOfDay(now), preset }
    }
  }
}

/** Rentang kustom dari dua string "YYYY-MM-DD" (dari `<input type="date">`). */
export function customRange(fromDay: string, toDay: string): DateRange {
  return {
    from: startOfDay(new Date(`${fromDay}T00:00:00`).getTime()),
    to: endOfDay(new Date(`${toDay}T00:00:00`).getTime()),
    preset: 'custom',
  }
}

/** Label ringkas buat header — nama preset atau "1 Agu – 5 Agu" untuk kustom. */
export function rangeLabel(r: DateRange): string {
  if (r.preset !== 'custom') return PRESET_LABEL[r.preset]
  const f = dayKey(r.from)
  const t = dayKey(r.to)
  return f === t ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`
}
