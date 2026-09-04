# Fitur: Open Bill

**Status:** ✅ Diimplementasikan · **Surface:** POS Kacaw (kasir) + POS Pro
(riwayat/audit) · **Sync:** entity **sales** dan **sale_items**, kontrak API v1

Open Bill menahan keranjang untuk dilanjutkan nanti tanpa menganggapnya sebagai
penjualan. Nomor transaksi dan snapshot barang sudah ada, tetapi tidak ada stok,
kas, laporan, pembayaran, maupun struk yang boleh diperlakukan sebagai selesai
sampai Open Bill benar-benar dibayar.

> Tidak ada endpoint Open Bill tersendiri. Open Bill memakai row **sales** dan
> **sale_items** yang sama, lalu ikut **POST /sync/push** dan **GET /sync/pull**
> biasa. Detail payload ada di
> [kontrak API v1](../api/pos-pro-api-v1.md#35-open-bill--lifecycle-sales-tanpa-endpoint-baru).

## Lifecycle

~~~text
open ── bayar/selesaikan ──> completed ── void ──> void
  │
  └── discard ──> tombstoned (deleted_at terisi)
~~~

**tombstoned** bukan nilai **sales.status**; itu row soft-delete yang tetap
dibawa sync. Nilai status yang valid adalah **open**, **completed**, dan
**void**. Transisi **open → completed** dan **completed → void** mempertahankan
row transaksi; **open → tombstoned** hanya terjadi melalui discard.

### 1. Hold: membuat open

Saat kasir menahan keranjang, aplikasi membuat satu **sales** dan
**sale_items**:

- Nomor sale/struk sudah dialokasikan saat hold. Nomor itu menjadi identitas yang
  tetap dipakai saat Open Bill diselesaikan; completion **tidak** membuat ID atau
  nomor baru.
- **status='open'**, **open_bill_label**, **opened_at**, dan
  **origin_device_id** diisi. **sold_at** harus **null**. **paid** dan
  **change_due** tetap **0**; **payment_method** default bukan bukti pembayaran.
- Setiap **sale_items** menyimpan snapshot immutable: **name_snapshot**,
  **price_snapshot**, **qty**, dan **discount** (serta **line_total**).
  Perubahan nama, harga, atau stok katalog setelah hold tidak boleh mengubah
  snapshot ini. Dalam model saat ini, **sale_items.discount** bernilai `0`;
  diskon keranjang disimpan di **sales.discount**. Re-hold maupun completion
  tidak memutasi snapshot aktif: keduanya men-tombstone item aktif lalu menyimpan
  set snapshot baru dari keranjang perangkat asal, bukan membaca ulang katalog
  untuk nama atau harga.
- Hold tidak mereservasi maupun mengurangi stok. Hold juga tidak memperbarui
  sesi kasir, akuntansi, laporan, atau **cashflow_entries**.
- Karena belum terjadi pembayaran, Open Bill tidak mencetak atau membagikan
  struk, dan UI tidak menampilkan metode bayar, nilai dibayar, atau kembalian.

### 2. Perangkat asal, resume, re-hold, dan discard

**origin_device_id** adalah **settings.device_id** perangkat yang membuat hold.
Hanya **perangkat asal** yang boleh resume/lanjutkan, mengubah keranjang lalu
re-hold, discard, atau pay. Perangkat lain yang menerima row hasil sync tetap
dapat melihat nomor, label, timestamp, total, dan snapshot barang, tetapi tampil
**read-only** dan tidak boleh menawarkan aksi tersebut.

Discard bukan void dan bukan hard delete. Perangkat asal mengirim delete generik
untuk row sale sehingga **deleted_at** menjadi tombstone yang ikut pull ke
perangkat lain. Tidak ada pengurangan/pengembalian stok, cashflow, sesi, atau
reversal akuntansi, karena hold belum pernah menimbulkan efek finansial.

### 3. Pay: open → completed

Sebelum pembayaran disimpan, aplikasi harus melakukan validasi ulang dalam satu
transaksi database:

1. Pastikan setiap produk pada snapshot masih boleh dijual, lalu gabungkan
   kuantitas per **product_id** untuk memeriksa stok teragregasi. Baris produk
   yang sama tidak boleh lolos hanya karena stok diperiksa satu per satu.
2. Jika validasi gagal, rollback seluruh proses dan Open Bill tetap **open**;
   tidak ada stok atau kas yang berubah.
3. Jika valid, update **sale ID dan nomor yang sama** menjadi **completed**, isi
   pembayaran dan **sold_at**, kurangi stok tracked product sekali, dan tulis
   cashflow penjualan sekali. Sesi kasir, akuntansi, serta laporan baru ikut
   terpengaruh pada titik ini.

Completion tidak membentuk ulang nama/harga/kuantitas/diskon dari katalog. Ia
menyimpan snapshot final dari keranjang perangkat asal (snapshot hasil resume
beserta perubahan kasir yang sengaja dibuat); set item aktif sebelumnya
ditombstone, bukan diedit. Aturan ini menjaga total dan riwayat tetap dapat
diaudit ketika katalog berubah di antara hold dan bayar.

### 4. Void: completed → void

Void hanya berlaku untuk penjualan yang sudah **completed**, bukan untuk Open
Bill. Ia mempertahankan sale sebagai jejak transaksi, mengembalikan stok produk
tracked, dan membuat entri cashflow lawan untuk membatalkan dampak finansial.
Open Bill harus dibuang melalui discard/tombstone, bukan diubah menjadi **void**.

## Data yang disimpan

| Entity | Field | Arti Open Bill |
|---|---|---|
| **sales** | **status** | **open**, **completed**, atau **void**. |
| **sales** | **open_bill_label** | Label bebas untuk mengenali pesanan yang ditahan; nullable. |
| **sales** | **opened_at** | Epoch milliseconds saat hold dibuat; nullable untuk sale lama/non-open. |
| **sales** | **origin_device_id** | UUID **settings.device_id** perangkat asal; nullable untuk sale lama/non-open. Jangan tertukar dengan audit server **origin_device**, yang tidak pernah dipull. |
| **sales** | **sold_at** | Epoch milliseconds saat benar-benar selesai; nullable dan wajib **null** saat **status='open'**. |
| **sale_items** | **name_snapshot**, **price_snapshot**, **qty**, **discount**, **line_total** | Snapshot item immutable untuk hold/penjualan tersebut. |

Nilai uang tetap integer rupiah (minor units) dan semua timestamp tetap epoch
milliseconds, mengikuti kontrak API v1.

## Sync dan kompatibilitas payload

Open Bill adalah penambahan field pada payload **sales**, bukan versi API atau
endpoint baru. **ChangeEnvelope.payload** untuk insert/update tetap full row;
envelope delete tetap hanya membawa **id** dan **deleted_at** seperti aturan sync
umum.

- **Push hold/re-hold:** kirim full row **sales** dengan **status='open'**,
  **open_bill_label**, **opened_at**, **origin_device_id**, dan
  **sold_at:null**, plus row **sale_items** snapshot. Tidak ada
  **cashflow_entries** dari hold.
- **Push completion:** update row **sales** yang sama menjadi **completed** dan
  push perubahan stok/cashflow normal yang dihasilkan completion. Efek lokalnya
  atomik; transport sync tetap memakai envelope per entity yang sudah ada.
- **Push discard:** gunakan operation delete biasa untuk membuat tombstone, bukan
  endpoint atau status baru.
- **Pull:** **GET /sync/pull?entity=sales** mengembalikan field Open Bill ini
  bersama field **sales** lain dan tombstone. Server mempertahankan
  **origin_device_id** dari payload bisnis, tetapi menyembunyikan
  **origin_device** internalnya.

Penambahan field ini bersifat additive di v1. Sale lama yang selesai/void tetap
valid dengan field Open Bill **null** dan **sold_at** terisi; klien yang memahami
Open Bill harus menerima **sold_at:null** untuk status **open**.

## POS Pro: audit read-only untuk Open Bill

POS Pro tidak menjadi perangkat kasir pengganti. Tampilan Open Bill di dashboard
POS Pro bersifat **view-only**: tidak ada resume, re-hold, discard, atau pay dari
web. Dashboard transaksi terbaru sengaja hanya memuat sale **completed** dan
**void**; Open Bill dapat diaudit lewat riwayat/detail sale dengan label, waktu
hold, perangkat asal, total, dan snapshot item.

Di detail Open Bill POS Pro, nilai metode bayar, dibayar, dan kembalian tidak
ditampilkan, dan tidak ada aksi cetak struk. Penyelesaian atau discard kembali
ke perangkat kasir asal.

## Verifikasi penerimaan

- Hold satu keranjang: nomor sale ada, **status='open'**, **sold_at=null**,
  snapshot item tersimpan, stok/cashflow/sesi/laporan tidak berubah.
- Pull di perangkat lain dan POS Pro: data terlihat read-only, tanpa tombol aksi
  kasir atau nilai/struk pembayaran.
- Completion dengan dua baris produk yang sama: stok tervalidasi dari kuantitas
  gabungan, lalu sale ID/nomor yang sama menjadi **completed** dan efek stok serta
  cashflow masing-masing hanya sekali.
- Discard: row **sales.deleted_at** terisi dan ikut sync; tidak ada status
  **void**, cashflow, atau reversal stok baru.
