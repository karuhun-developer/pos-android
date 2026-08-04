import { capabilities } from './registry'
import { WebPreviewPrinter } from './printers/webPreviewPrinter'

/**
 * Daftarin semua capability yang aktif di build ini.
 * Nanti nambah thermal printer = tambah 1 baris di sini, tanpa sentuh core:
 *   capabilities.register(new ThermalPrinter())
 */
export function registerCapabilities(): void {
  capabilities.register(new WebPreviewPrinter())
}
