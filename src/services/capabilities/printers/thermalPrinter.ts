import type { PrinterCapability, PrinterDevice, ReceiptJob } from '@/services/capabilities/registry'
import { encodeReceipt } from '@/lib/escpos'
import { getPrinterTransport, getSelectedPrinter } from './transport'

/**
 * Printer thermal ESC/POS (Bluetooth/USB). Menggantikan WebPreviewPrinter di
 * build native. Encode struk → byte lalu kirim lewat `PrinterTransport` yang
 * aktif. `isAvailable()` baru true saat transport terpasang **dan** printer
 * sudah dipilih → tombol cetak nonaktif dengan anggun bila belum siap.
 */
export class ThermalPrinter implements PrinterCapability {
  readonly id = 'printer' as const

  async isAvailable(): Promise<boolean> {
    return getPrinterTransport().available && getSelectedPrinter() !== null
  }

  async listDevices(): Promise<PrinterDevice[]> {
    const t = getPrinterTransport()
    const groups = await Promise.all(t.connections.map((c) => t.list(c)))
    return groups.flat().map((d) => ({ id: d.id, name: d.name }))
  }

  async print(job: ReceiptJob): Promise<void> {
    const target = getSelectedPrinter()
    if (!target) throw new Error('Printer belum dipilih. Atur di Setelan → Printer.')
    await getPrinterTransport().print(target, encodeReceipt(job))
  }
}
