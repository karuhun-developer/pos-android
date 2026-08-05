# Fitur: Printer & Plugin (Capability)

**Status:** ✅ Layer software thermal ESC/POS + ✅ transport native Bluetooth
Classic (SPP) & USB · Web preview sebagai fallback dev · **Route:** `/printer`

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
   bytes) }`. Default `nullTransport` (`available=false`); build native memasang
   `CapacitorThermalTransport` lewat `setPrinterTransport(...)`. Device terpilih
   disimpan di `setSelectedPrinter()`/`getSelectedPrinter()`.
3. **Capability** `printers/thermalPrinter.ts` — `ThermalPrinter implements
   PrinterCapability`: `isAvailable()` = transport ada **dan** printer terpilih;
   `print(job)` = encode → `transport.print(target, bytes)`.

Registrasi (`bootstrap.ts`): **native → `setPrinterTransport(new
CapacitorThermalTransport())` + `ThermalPrinter`**, **web → `WebPreviewPrinter`**
(dialog browser).

## Transport native (`CapacitorThermalTransport` + plugin `ThermalPrinter`)
Byte ESC/POS sudah dibentuk di JS, jadi lapisan native **cuma jadi "kabel"**:
list device → buka koneksi → kirim byte mentah. Karena itu **tidak butuh library
eksternal** (DantSu dsb) — cukup API Android bawaan (`BluetoothSocket` SPP +
`UsbManager`/`bulkTransfer`). Zero dependency Gradle tambahan, kontrol penuh.

- **JS:** `printers/nativePlugin.ts` (`registerPlugin('ThermalPrinter')`) +
  `printers/capacitorThermalTransport.ts` (byte → base64 → plugin).
- **Native:** `android/app/src/main/java/.../ThermalPrinterPlugin.java`
  (`@CapacitorPlugin(name="ThermalPrinter")`), didaftarkan di `MainActivity.java`
  (`registerPlugin(ThermalPrinterPlugin.class)`).
- **Method plugin:**
  - `listBluetooth()` → `{ printers:[{id(MAC),name}] }` — device yang sudah paired.
  - `listUsb()` → `{ printers:[{id(deviceName),name}] }` — device tercolok.
  - `print({ connection, id, data(base64) })` — kirim byte.
- **Bluetooth:** `BluetoothSocket` via `createRfcommSocketToServiceRecord(SPP_UUID
  0x1101)`, IO di background thread (hindari ANR). Butuh **BLUETOOTH_CONNECT**
  (API 31+, diminta runtime lewat sistem izin Capacitor); hanya device paired
  (tak butuh SCAN/lokasi).
- **USB:** cari interface kelas PRINTER (7) → bulk-OUT endpoint (fallback: bulk-OUT
  apa pun) → `UsbManager.requestPermission` (dialog per-device via
  `BroadcastReceiver`) → `bulkTransfer` per 16KB.
- **Izin manifest:** `BLUETOOTH`/`BLUETOOTH_ADMIN` (`maxSdkVersion=30`),
  `BLUETOOTH_CONNECT`, `<uses-feature usb.host required=false>`.

> **File native tidak ditimpa `cap sync`** (sync hanya menyalin aset web +
> config). Aman di-commit di `android/`.

## Setelan Printer (`/printer`)
- **Native:** pilih koneksi (Bluetooth/USB) → **Pindai** → daftar device → pilih
  → tersimpan (device-local di `settings`: `printer_connection/id/name`). Pilih
  **lebar kertas** 58mm (32 kolom) / 80mm (48 kolom, `printer_width`). Tombol
  **Test Print** + **Hapus**.
- **Web:** hanya Test Print via preview browser.
- State di `src/stores/printer.ts` (settings-backed); dimuat saat boot (`main.ts`)
  supaya cetak ulang struk memakai lebar kertas yang benar.

## Uji di device (butuh Android Studio + printer fisik)
1. `npm run build && npx cap sync android` → build & run dari Android Studio.
2. **Bluetooth:** pair printer lewat Setelan Android → app `/printer` → Bluetooth
   → Pindai → pilih → Test Print (izinkan BLUETOOTH_CONNECT saat diminta) →
   struk keluar.
3. **USB:** colok printer (OTG) → `/printer` → USB → Pindai → pilih → Test Print
   → setujui dialog izin USB → struk keluar.
4. Checkout / detail transaksi → **Cetak Ulang Struk** pakai printer & lebar
   kertas terpilih.

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
- `src/services/capabilities/printers/{transport,thermalPrinter,webPreviewPrinter,
  nativePlugin,capacitorThermalTransport}.ts`
- `android/app/src/main/java/.../{ThermalPrinterPlugin,MainActivity}.java`,
  `AndroidManifest.xml`
- `src/stores/printer.ts`, `src/pages/printer/PrinterPage.vue`
- Pemakai cetak: `PosPage.vue`, `TransactionDetailPage.vue` (lebar kertas dari store).
