package com.karuhundeveloper.poskacaw;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.Arrays;
import java.util.UUID;

/**
 * Transport printer thermal native (Bluetooth Classic SPP + USB) untuk POS Kacaw.
 *
 * Byte ESC/POS sudah dibentuk di sisi JS (`src/lib/escpos.ts`), jadi plugin ini
 * cuma jadi "kabel": list device, buka koneksi, kirim byte mentah. Karena itu
 * TIDAK butuh library eksternal (DantSu dsb) — cukup API Android bawaan.
 *
 * Method:
 *  - listBluetooth() -> { printers: [{id(MAC), name}] }  (device yang sudah paired)
 *  - listUsb()       -> { printers: [{id(deviceName), name}] } (device tercolok)
 *  - print({ connection, id, data(base64) }) -> void
 */
@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class ThermalPrinterPlugin extends Plugin {
    /** UUID standar Serial Port Profile — dipakai hampir semua printer BT thermal. */
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String ACTION_USB_PERMISSION = "com.karuhundeveloper.poskacaw.USB_PERMISSION";

    // ---------------------------------------------------------------- Bluetooth

    @PluginMethod
    public void listBluetooth(PluginCall call) {
        if (needsBtPermission()) {
            requestPermissionForAlias("bluetooth", call, "btPermCallback");
            return;
        }
        new Thread(() -> doListBluetooth(call)).start();
    }

    @SuppressLint("MissingPermission")
    private void doListBluetooth(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak punya Bluetooth.", "no_bluetooth");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth mati. Nyalakan dulu lalu pindai lagi.", "bluetooth_off");
            return;
        }
        JSArray printers = new JSArray();
        for (BluetoothDevice d : adapter.getBondedDevices()) {
            JSObject o = new JSObject();
            o.put("id", d.getAddress());
            o.put("name", d.getName() != null ? d.getName() : d.getAddress());
            printers.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("printers", printers);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private void printBluetooth(PluginCall call, byte[] bytes) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth tidak aktif.", "bluetooth_off");
            return;
        }
        String id = call.getString("id");
        if (id == null) {
            call.reject("ID printer kosong.", "no_id");
            return;
        }
        BluetoothSocket socket = null;
        try {
            BluetoothDevice device = adapter.getRemoteDevice(id);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            adapter.cancelDiscovery(); // discovery bikin connect lambat/gagal
            socket.connect();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
            // beri jeda supaya buffer benar-benar terkirim sebelum socket ditutup
            try { Thread.sleep(250); } catch (InterruptedException ignored) {}
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal mencetak lewat Bluetooth: " + e.getMessage(), "print_failed");
        } finally {
            if (socket != null) {
                try { socket.close(); } catch (Exception ignored) {}
            }
        }
    }

    private boolean needsBtPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false; // <31: izin normal
        return getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    @PermissionCallback
    private void btPermCallback(PluginCall call) {
        if (needsBtPermission()) {
            call.reject("Izin Bluetooth ditolak.", "permission_denied");
            return;
        }
        if ("print".equals(call.getMethodName())) {
            byte[] bytes = decode(call);
            if (bytes == null) { call.reject("Data cetak kosong.", "no_data"); return; }
            new Thread(() -> printBluetooth(call, bytes)).start();
        } else {
            new Thread(() -> doListBluetooth(call)).start();
        }
    }

    // ---------------------------------------------------------------------- USB

    @PluginMethod
    public void listUsb(PluginCall call) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        JSArray printers = new JSArray();
        if (usbManager != null) {
            for (UsbDevice d : usbManager.getDeviceList().values()) {
                JSObject o = new JSObject();
                o.put("id", d.getDeviceName());
                String name = d.getProductName();
                o.put("name", name != null && !name.isEmpty()
                    ? name
                    : "USB " + Integer.toHexString(d.getVendorId()) + ":" + Integer.toHexString(d.getProductId()));
                printers.put(o);
            }
        }
        JSObject ret = new JSObject();
        ret.put("printers", printers);
        call.resolve(ret);
    }

    private void printUsb(PluginCall call, byte[] bytes) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        if (usbManager == null) {
            call.reject("Perangkat ini tidak mendukung USB host.", "no_usb");
            return;
        }
        String id = call.getString("id");
        UsbDevice device = null;
        for (UsbDevice d : usbManager.getDeviceList().values()) {
            if (d.getDeviceName().equals(id)) { device = d; break; }
        }
        if (device == null) {
            call.reject("Printer USB tidak ditemukan / tercabut.", "device_not_found");
            return;
        }
        if (!usbManager.hasPermission(device)) {
            requestUsbPermission(call, usbManager, device, bytes);
            return;
        }
        final UsbDevice target = device;
        new Thread(() -> doPrintUsb(call, usbManager, target, bytes)).start();
    }

    private void requestUsbPermission(PluginCall call, UsbManager usbManager, UsbDevice device, byte[] bytes) {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent pi = PendingIntent.getBroadcast(
            getContext(), 0, new Intent(ACTION_USB_PERMISSION).setPackage(getContext().getPackageName()), flags);

        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                try { getContext().unregisterReceiver(this); } catch (Exception ignored) {}
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                if (granted) {
                    new Thread(() -> doPrintUsb(call, usbManager, device, bytes)).start();
                } else {
                    call.reject("Izin akses printer USB ditolak.", "permission_denied");
                }
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
        usbManager.requestPermission(device, pi);
    }

    private void doPrintUsb(PluginCall call, UsbManager usbManager, UsbDevice device, byte[] bytes) {
        UsbInterface iface = null;
        UsbEndpoint endpoint = null;

        // Prioritaskan interface kelas PRINTER (7), lalu fallback ke bulk-OUT apa pun.
        for (int pass = 0; pass < 2 && endpoint == null; pass++) {
            for (int i = 0; i < device.getInterfaceCount() && endpoint == null; i++) {
                UsbInterface ui = device.getInterface(i);
                if (pass == 0 && ui.getInterfaceClass() != UsbConstants.USB_CLASS_PRINTER) continue;
                for (int j = 0; j < ui.getEndpointCount(); j++) {
                    UsbEndpoint ep = ui.getEndpoint(j);
                    if (ep.getDirection() == UsbConstants.USB_DIR_OUT
                        && ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                        iface = ui; endpoint = ep; break;
                    }
                }
            }
        }
        if (iface == null || endpoint == null) {
            call.reject("Endpoint printer USB tidak ditemukan.", "no_endpoint");
            return;
        }

        UsbDeviceConnection conn = null;
        try {
            conn = usbManager.openDevice(device);
            if (conn == null) {
                call.reject("Gagal membuka koneksi USB.", "open_failed");
                return;
            }
            if (!conn.claimInterface(iface, true)) {
                call.reject("Gagal mengklaim interface printer USB.", "claim_failed");
                return;
            }
            int sent = 0;
            while (sent < bytes.length) {
                int chunk = Math.min(16384, bytes.length - sent);
                byte[] slice = (sent == 0 && chunk == bytes.length)
                    ? bytes : Arrays.copyOfRange(bytes, sent, sent + chunk);
                int r = conn.bulkTransfer(endpoint, slice, slice.length, 5000);
                if (r < 0) {
                    call.reject("Transfer data ke printer USB gagal.", "transfer_failed");
                    return;
                }
                sent += chunk;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal mencetak lewat USB: " + e.getMessage(), "print_failed");
        } finally {
            if (conn != null) conn.close();
        }
    }

    // ------------------------------------------------------------------ Dispatch

    @PluginMethod
    public void print(PluginCall call) {
        String connection = call.getString("connection", "");
        byte[] bytes = decode(call);
        if (bytes == null) {
            call.reject("Data cetak kosong.", "no_data");
            return;
        }
        if ("bluetooth".equals(connection)) {
            if (needsBtPermission()) {
                requestPermissionForAlias("bluetooth", call, "btPermCallback");
                return;
            }
            new Thread(() -> printBluetooth(call, bytes)).start();
        } else if ("usb".equals(connection)) {
            printUsb(call, bytes);
        } else {
            call.reject("Jenis koneksi tidak dikenal: " + connection, "unknown_connection");
        }
    }

    private byte[] decode(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) return null;
        return Base64.decode(data, Base64.DEFAULT);
    }
}
