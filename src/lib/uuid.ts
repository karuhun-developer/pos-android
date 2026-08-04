import { v4 as uuidv4 } from 'uuid'

/** Client-generated UUID v4 — dipakai sebagai primary key semua tabel bisnis
 *  supaya aman di multi-device (gak ada tabrakan PK saat sync). */
export function uuid(): string {
  return uuidv4()
}

/**
 * ID device lokal — prefix buat nomor struk supaya gak nabrak antar device
 * walaupun dibuat offline. Disimpan di settings (key: device_id).
 */
export function shortId(len = 6): string {
  return uuidv4().replace(/-/g, '').slice(0, len).toUpperCase()
}
