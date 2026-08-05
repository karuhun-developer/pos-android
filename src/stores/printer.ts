import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDb } from '@/db/sqlite'
import { SettingsRepository } from '@/repositories/settings.repo'
import {
  getPrinterTransport,
  setSelectedPrinter,
  type DiscoveredPrinter,
  type PrinterConnection,
} from '@/services/capabilities/printers/transport'

const KEYS = {
  connection: 'printer_connection',
  id: 'printer_id',
  name: 'printer_name',
  width: 'printer_width',
} as const

/** Lebar kertas dalam karakter monospace: 58mm ≈ 32, 80mm ≈ 48. */
export type PaperWidth = 32 | 48

/**
 * State printer thermal (device-local, disimpan di tabel `settings`).
 * Transport native (BT/USB) dipasang terpisah; store ini cuma memilih &
 * menyimpan device + scan lewat transport yang aktif.
 */
export const usePrinterStore = defineStore('printer', () => {
  const connection = ref<PrinterConnection | null>(null)
  const deviceId = ref<string | null>(null)
  const deviceName = ref<string | null>(null)
  const paperWidth = ref<PaperWidth>(32)

  const devices = ref<DiscoveredPrinter[]>([])
  const scanning = ref(false)
  const error = ref('')

  // Sifat transport aktif (di-snapshot; transport di-set sekali saat bootstrap).
  const transportAvailable = ref(getPrinterTransport().available)
  const supportedConnections = ref<PrinterConnection[]>(getPrinterTransport().connections)

  const selected = computed(() =>
    deviceId.value && connection.value
      ? { id: deviceId.value, name: deviceName.value ?? deviceId.value, connection: connection.value }
      : null,
  )

  function repo() {
    return new SettingsRepository(getDb())
  }

  async function load() {
    const all = await repo().getAll()
    connection.value = (all[KEYS.connection] as PrinterConnection) || null
    deviceId.value = all[KEYS.id] || null
    deviceName.value = all[KEYS.name] || null
    paperWidth.value = all[KEYS.width] === '48' ? 48 : 32
    // Segarkan snapshot transport (kalau native plugin sudah pasang saat boot).
    transportAvailable.value = getPrinterTransport().available
    supportedConnections.value = getPrinterTransport().connections
    syncSelected()
  }

  // Beritahu ThermalPrinter device mana yang aktif.
  function syncSelected() {
    setSelectedPrinter(selected.value)
  }

  async function scan(conn: PrinterConnection) {
    if (scanning.value) return
    error.value = ''
    scanning.value = true
    connection.value = conn
    try {
      devices.value = await getPrinterTransport().list(conn)
      if (devices.value.length === 0) error.value = 'Tidak ada printer ditemukan.'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Gagal memindai printer.'
      devices.value = []
    } finally {
      scanning.value = false
    }
  }

  async function select(d: DiscoveredPrinter) {
    connection.value = d.connection
    deviceId.value = d.id
    deviceName.value = d.name
    await repo().setMany({
      [KEYS.connection]: d.connection,
      [KEYS.id]: d.id,
      [KEYS.name]: d.name,
    })
    syncSelected()
  }

  async function setWidth(w: PaperWidth) {
    paperWidth.value = w
    await repo().set(KEYS.width, String(w))
  }

  async function clear() {
    connection.value = null
    deviceId.value = null
    deviceName.value = null
    devices.value = []
    await repo().setMany({ [KEYS.connection]: '', [KEYS.id]: '', [KEYS.name]: '' })
    syncSelected()
  }

  return {
    connection,
    deviceId,
    deviceName,
    paperWidth,
    devices,
    scanning,
    error,
    transportAvailable,
    supportedConnections,
    selected,
    load,
    scan,
    select,
    setWidth,
    clear,
  }
})
