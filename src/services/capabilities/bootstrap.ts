import { Capacitor } from '@capacitor/core'
import { capabilities } from './registry'
import { WebPreviewPrinter } from './printers/webPreviewPrinter'
import { ThermalPrinter } from './printers/thermalPrinter'
import { setPrinterTransport } from './printers/transport'
import { CapacitorThermalTransport } from './printers/capacitorThermalTransport'
import { WebScanner } from './scanner/webScanner'

/**
 * Daftarin semua capability yang aktif di build ini.
 *
 * Printer:
 * - **Native (Android):** transport `CapacitorThermalTransport` (plugin native
 *   Bluetooth Classic SPP + USB) dipasang lewat `setPrinterTransport(...)`, lalu
 *   `ThermalPrinter` (ESC/POS via `PrinterTransport`) didaftarkan. Kalau printer
 *   belum dipilih, cetak nonaktif dengan anggun & halaman Printer memandu setup.
 * - **Web:** `WebPreviewPrinter` (cetak via dialog browser) sebagai fallback dev.
 *
 * Scanner:
 * - `WebScanner` (`getUserMedia` + `<video>` inline) dipakai di **dua platform**.
 *   Di Android, WebView Capacitor yang minta izin kamera runtime-nya, dan
 *   decode-nya jatuh ke `BarcodeDetector` bawaan platform (mesin ML Kit yang
 *   sama) — jadi tanpa plugin native pun kualitasnya setara, sementara preview
 *   tetap elemen DOM biasa sehingga layout kamera-setengah-layar gampang.
 *   Kalau nanti butuh engine native (mis. ML Kit langsung), tinggal daftarkan
 *   implementasi lain di sini — `ScannerCapability` yang jadi kontraknya.
 */
export function registerCapabilities(): void {
  if (Capacitor.isNativePlatform()) {
    setPrinterTransport(new CapacitorThermalTransport())
    capabilities.register(new ThermalPrinter())
  } else {
    capabilities.register(new WebPreviewPrinter())
  }

  capabilities.register(new WebScanner())
}
