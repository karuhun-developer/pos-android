/**
 * Seam transport printer thermal. Layer software (encoder + capability + UI)
 * bicara ke interface ini; **implementasi native (plugin Capacitor untuk
 * Bluetooth/USB) dipasang belakangan** lewat `setPrinterTransport()` di
 * `capabilities/bootstrap.ts` — tanpa mengubah core.
 *
 * Sampai transport terpasang, `nullTransport` aktif (`available=false`) → tombol
 * cetak dinonaktifkan dengan anggun & halaman Printer menampilkan status "belum
 * terpasang".
 */
export type PrinterConnection = 'bluetooth' | 'usb'

export interface DiscoveredPrinter {
  id: string
  name: string
  connection: PrinterConnection
}

export interface PrinterTarget {
  id: string
  connection: PrinterConnection
}

export interface PrinterTransport {
  /** True bila plugin native benar-benar ada di build ini. */
  readonly available: boolean
  /** Jenis koneksi yang didukung transport ini (mis. ['bluetooth','usb']). */
  readonly connections: PrinterConnection[]
  /** Cari printer untuk satu jenis koneksi (paired BT / device USB tercolok). */
  list(connection: PrinterConnection): Promise<DiscoveredPrinter[]>
  /** Kirim byte ESC/POS ke printer target. */
  print(target: PrinterTarget, bytes: Uint8Array): Promise<void>
}

const nullTransport: PrinterTransport = {
  available: false,
  connections: [],
  async list() {
    return []
  },
  async print() {
    throw new Error('Transport printer belum terpasang di build ini.')
  },
}

let active: PrinterTransport = nullTransport
/** Dipanggil native plugin saat bootstrap untuk mengaktifkan transport asli. */
export function setPrinterTransport(t: PrinterTransport): void {
  active = t
}
export function getPrinterTransport(): PrinterTransport {
  return active
}

// Printer terpilih (device-local). Di-set oleh store printer saat load/pilih,
// dibaca oleh ThermalPrinter saat mencetak.
let selected: PrinterTarget | null = null
export function setSelectedPrinter(t: PrinterTarget | null): void {
  selected = t
}
export function getSelectedPrinter(): PrinterTarget | null {
  return selected
}
