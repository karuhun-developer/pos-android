# Fitur: Printer & Plugin (Capability)

**Status:** ✅ Layer software thermal ESC/POS siap (encoder + capability + setelan) ·
🟡 transport native Bluetooth/USB menyusul · Web preview sebagai fallback dev ·
**Route:** `/printer`

## Konsep
Kemampuan opsional (printer, scanner, cash drawer) didaftarkan ke
`CapabilityRegistry`. Core **tidak** mengimpor plugin konkret — cukup memanggil
`capabilities.get('printer')`. Jika tidak ada / tidak tersedia, aksi cetak
disembunyikan/di-disable.

## Arsitektur printer (3 lapis)
1. **Encoder** `src/lib/escpos.ts` — `encodeReceipt(job) → Uint8Array` (perintah
   ESC/POS: init, align, bold, ukuran, LF, potong). Murni, bebas hardware.
2. **Transport (seam)** `src/services/capabilities/printers/transport.ts` —
   interface `PrinterTransport { available, connections, list(conn), print(target,
   bytes) }`. Default `nullTransport` (`available=false`) sampai plugin native
   dipasang lewat `setPrinterTransport(...)`. Device terpilih disimpan di
   `setSelectedPrinter()`/`getSelectedPrinter()`.
3. **Capability** `printers/thermalPrinter.ts` — `ThermalPrinter implements
   PrinterCapability`: `isAvailable()` = transport ada **dan** printer terpilih;
   `print(job)` = encode → `transport.print(target, bytes)`.

Registrasi (`bootstrap.ts`): **native → `ThermalPrinter`**, **web →
`WebPreviewPrinter`** (dialog browser).

## Setelan Printer (`/printer`)
- **Native:** pilih koneksi (Bluetooth/USB, hanya yang didukung transport) →
  **Pindai** → daftar device → pilih → tersimpan (device-local di `settings`:
  `printer_connection/id/name`). Pilih **lebar kertas** 58mm (32 kolom) / 80mm
  (48 kolom, `printer_width`). Tombol **Test Print** + **Hapus**.
- Selama transport belum terpasang → kartu info "Transport belum terpasang"
  (encoder & pemilihan device sudah siap; tinggal pasang plugin).
- **Web:** hanya Test Print via preview browser.
- State di `src/stores/printer.ts` (settings-backed); dimuat saat boot (`main.ts`)
  supaya cetak ulang struk memakai lebar kertas yang benar.

## Memasang transport native (langkah berikutnya)
Tidak ada plugin Capacitor 8 tunggal yang mendukung BT Classic **dan** USB, jadi
rencananya bungkus **DantSu ESCPOS-ThermalPrinter-Android** (BT Classic + USB +
ESC/POS + logo) sebagai plugin Capacitor lokal, lalu:
```ts
// src/services/capabilities/printers/capacitorThermalTransport.ts
export class CapacitorThermalTransport implements PrinterTransport {
  available = true
  connections: PrinterConnection[] = ['bluetooth', 'usb']
  async list(conn) { /* panggil plugin → device[] */ }
  async print(target, bytes) { /* panggil plugin → kirim byte */ }
}
```
```ts
// bootstrap.ts (native)
setPrinterTransport(new CapacitorThermalTransport())
capabilities.register(new ThermalPrinter())
```
**Zero perubahan** di encoder, capability, halaman Printer, atau alur checkout.

## Kontrak
```ts
interface PrinterCapability extends Capability {
  id: 'printer'
  print(job: ReceiptJob): Promise<void>
  listDevices?(): Promise<PrinterDevice[]>
}
```

## Kode
- `src/lib/escpos.ts` — encoder ESC/POS.
- `src/services/capabilities/registry.ts`, `bootstrap.ts`
- `src/services/capabilities/printers/{transport,thermalPrinter,webPreviewPrinter}.ts`
- `src/stores/printer.ts`, `src/pages/printer/PrinterPage.vue`
- Pemakai cetak: `PosPage.vue`, `TransactionDetailPage.vue` (lebar kertas dari store).
