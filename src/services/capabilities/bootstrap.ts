import { Capacitor } from '@capacitor/core'
import { capabilities } from './registry'
import { WebPreviewPrinter } from './printers/webPreviewPrinter'
import { ThermalPrinter } from './printers/thermalPrinter'

/**
 * Daftarin semua capability yang aktif di build ini.
 *
 * Printer:
 * - **Native (Android):** `ThermalPrinter` (ESC/POS via `PrinterTransport`).
 *   Transport Bluetooth/USB native dipasang terpisah dengan `setPrinterTransport(...)`
 *   (mis. di sini, saat plugin sudah ada). Sampai itu, transport = null → cetak
 *   nonaktif dengan anggun & halaman Printer memandu setup.
 * - **Web:** `WebPreviewPrinter` (cetak via dialog browser) sebagai fallback dev.
 */
export function registerCapabilities(): void {
  if (Capacitor.isNativePlatform()) {
    // TODO(transport): saat plugin BT/USB siap →
    //   import { setPrinterTransport } from './printers/transport'
    //   setPrinterTransport(new CapacitorThermalTransport())
    capabilities.register(new ThermalPrinter())
  } else {
    capabilities.register(new WebPreviewPrinter())
  }
}
