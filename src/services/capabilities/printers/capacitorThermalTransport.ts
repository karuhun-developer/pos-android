import type {
  DiscoveredPrinter,
  PrinterConnection,
  PrinterTarget,
  PrinterTransport,
} from './transport'
import { ThermalPrinterNative } from './nativePlugin'

/** Uint8Array → base64 (chunked, aman untuk payload struk yang panjang). */
function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/**
 * Transport native (Bluetooth Classic SPP + USB) memakai plugin `ThermalPrinter`.
 * Dipasang di `bootstrap.ts` lewat `setPrinterTransport(...)` hanya di build
 * native — **tanpa mengubah encoder, capability, halaman Printer, atau checkout.**
 */
export class CapacitorThermalTransport implements PrinterTransport {
  readonly available = true
  readonly connections: PrinterConnection[] = ['bluetooth', 'usb']

  async list(connection: PrinterConnection): Promise<DiscoveredPrinter[]> {
    const res =
      connection === 'bluetooth'
        ? await ThermalPrinterNative.listBluetooth()
        : await ThermalPrinterNative.listUsb()
    return res.printers.map((p) => ({ id: p.id, name: p.name, connection }))
  }

  async print(target: PrinterTarget, bytes: Uint8Array): Promise<void> {
    await ThermalPrinterNative.print({
      connection: target.connection,
      id: target.id,
      data: toBase64(bytes),
    })
  }
}
