import { Capacitor } from '@capacitor/core'
import { capabilities } from './registry'
import { WebPreviewPrinter } from './printers/webPreviewPrinter'
import { ThermalPrinter } from './printers/thermalPrinter'
import { setPrinterTransport } from './printers/transport'
import { CapacitorThermalTransport } from './printers/capacitorThermalTransport'

/**
 * Daftarin semua capability yang aktif di build ini.
 *
 * Printer:
 * - **Native (Android):** transport `CapacitorThermalTransport` (plugin native
 *   Bluetooth Classic SPP + USB) dipasang lewat `setPrinterTransport(...)`, lalu
 *   `ThermalPrinter` (ESC/POS via `PrinterTransport`) didaftarkan. Kalau printer
 *   belum dipilih, cetak nonaktif dengan anggun & halaman Printer memandu setup.
 * - **Web:** `WebPreviewPrinter` (cetak via dialog browser) sebagai fallback dev.
 */
export function registerCapabilities(): void {
  if (Capacitor.isNativePlatform()) {
    setPrinterTransport(new CapacitorThermalTransport())
    capabilities.register(new ThermalPrinter())
  } else {
    capabilities.register(new WebPreviewPrinter())
  }
}
