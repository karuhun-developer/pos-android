# Fitur: Printer & Plugin (Capability)

**Status:** 🟡 Web preview aktif (Phase 0); thermal menyusul (Phase 6/7) · **Route:** `/printer`

## Konsep
Kemampuan opsional (printer, scanner, cash drawer) didaftarkan ke
`CapabilityRegistry`. Core **tidak** mengimpor plugin konkret — cukup memanggil
`capabilities.get('printer')`. Jika tidak ada / tidak tersedia, aksi cetak
disembunyikan/di-disable.

## Sudah ada (Phase 0)
- `WebPreviewPrinter` — render struk sebagai HTML lalu buka dialog print browser.
  Membuat seluruh alur "cetak struk" berfungsi tanpa hardware.
- Halaman `/printer` dengan status + tombol **Test Print**.

## Menambah printer thermal (nanti)
1. Install plugin Capacitor thermal (Bluetooth/USB).
2. Buat `ThermalPrinter implements PrinterCapability` yang membungkus plugin.
3. Daftarkan di `src/services/capabilities/bootstrap.ts`:
   `capabilities.register(new ThermalPrinter())`.
4. **Tidak ada** perubahan di core/UI — tombol cetak otomatis memakai printer aktif.

## Kontrak
```ts
interface PrinterCapability extends Capability {
  id: 'printer'
  print(job: ReceiptJob): Promise<void>
  listDevices?(): Promise<PrinterDevice[]>
}
```

## Kode
- `src/services/capabilities/registry.ts`, `bootstrap.ts`, `printers/webPreviewPrinter.ts`
- `src/pages/printer/PrinterPage.vue`
