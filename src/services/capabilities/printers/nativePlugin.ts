import { registerPlugin } from '@capacitor/core'

/**
 * Jembatan ke plugin native `ThermalPrinter`
 * (`android/app/src/main/java/.../ThermalPrinterPlugin.java`).
 *
 * Byte ESC/POS dibentuk di JS (`src/lib/escpos.ts`) lalu dikirim sebagai base64.
 * Di web, memanggil method ini akan menolak ("not implemented") — makanya transport
 * ini hanya dipasang saat `Capacitor.isNativePlatform()` di `bootstrap.ts`.
 */
export interface NativePrinter {
  id: string
  name: string
}

export interface ThermalPrinterPlugin {
  /** Daftar printer Bluetooth yang sudah di-pair. */
  listBluetooth(): Promise<{ printers: NativePrinter[] }>
  /** Daftar printer USB yang tercolok. */
  listUsb(): Promise<{ printers: NativePrinter[] }>
  /** Kirim byte (base64) ke printer target. */
  print(options: { connection: 'bluetooth' | 'usb'; id: string; data: string }): Promise<void>
}

export const ThermalPrinterNative = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter')
