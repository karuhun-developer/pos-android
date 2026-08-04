import { v4 as uuidv4, v7 as uuidv7 } from 'uuid'

/** Client-generated UUID v4 — dipakai sebagai primary key semua tabel bisnis
 *  supaya aman di multi-device (gak ada tabrakan PK saat sync). */
export function uuid(): string {
  return uuidv4()
}

/**
 * ID device lokal — **UUID v7** (48-bit timestamp di depan + acak). Terurut waktu
 * dan praktis unik lintas device, jadi aman jadi `X-Device-Id` (audit origin_device
 * di server) sekaligus sumber prefix nomor struk. Disimpan sekali di settings
 * (key: device_id).
 */
export function deviceUuid(): string {
  return uuidv7()
}

/**
 * Prefix pendek nomor struk, diturunkan dari device UUID. Ambil ekor (segmen
 * acak v7) supaya tetap pendek tapi beda antar device. Fallback ke slug acak
 * kalau id kosong.
 */
export function devicePrefixOf(id: string, len = 4): string {
  const hex = (id || uuidv4()).replace(/-/g, '')
  return hex.slice(-len).toUpperCase()
}

/**
 * Slug acak pendek (dipakai tempat lain yang tak butuh keterurutan waktu).
 */
export function shortId(len = 6): string {
  return uuidv4().replace(/-/g, '').slice(0, len).toUpperCase()
}
