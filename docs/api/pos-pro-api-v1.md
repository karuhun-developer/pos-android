# POS Pro — Kontrak API v1

**Status:** ✅ Final (Phase 6) · **Base URL:** `https://<host>/api/v1` · **Format:** JSON

Dokumen ini **sumber kebenaran** kontrak antara **FE POS Kacaw** (yang meng-*consume*)
dan **BE POS Pro / Laravel** (yang meng-*implement*). Tipe di sini WAJIB byte-compatible
dengan `src/services/sync/types.ts` & `src/db/types.ts` di FE. Jangan diubah sepihak —
perubahan breaking = versi baru (`api/v2`).

> Referensi hidup (di-generate dari kode BE) tersedia di `GET /docs/api` (Scramble UI)
> dan `GET /docs/api.json` (OpenAPI 3). Dokumen ini = kontrak naratif + aturan bisnis;
> Scramble = schema dari implementasi. Keduanya harus konsisten.

---

## 1. Konvensi umum

| Aturan | Nilai |
|---|---|
| Uang | **INTEGER minor units** (rupiah bulat, tanpa desimal). Tidak pernah float. |
| Timestamp | **epoch milliseconds** (`number`, mis. `1722762000000`). Bukan ISO string. |
| ID | **UUID v4** string, **di-generate client**. PK di server = UUID yang sama. |
| Soft delete | `deleted_at` = epoch ms saat dihapus, `null` kalau hidup. Row tidak pernah hard-delete. |
| Boolean | dikirim sebagai **0/1 integer** (mirror SQLite FE), bukan `true/false`. |
| Charset | UTF-8. |

### Header wajib

```
Authorization: Bearer <token>       # kecuali /auth/google, /auth/login, /health
Accept: application/json
Content-Type: application/json       # untuk request ber-body
X-Device-Id: <settings.device_id>   # opsional; dipakai audit origin_device & scoping nomor struk
```

### Model error

Semua error pakai bentuk standar Laravel:

```json
{ "message": "Pesan ringkas", "errors": { "field": ["detail validasi"] } }
```

| HTTP | Makna | Aksi FE |
|---|---|---|
| `401` | Token invalid/kadaluarsa | `AuthProvider.onUnauthorized()` → hapus token, minta login ulang |
| `403` | Terautentikasi tapi tak punya permission (RBAC) | Tampilkan pesan, jangan retry |
| `404` | Resource/route tak ada | — |
| `413` | Payload melebihi limit (mis. media > batas) | Turunkan ukuran / skip |
| `422` | Validasi gagal | Perbaiki payload |
| `429` | Rate limit | Backoff |
| `5xx` | Error server | Retry dengan backoff |

---

## 2. Autentikasi

Token = **Laravel Sanctum personal access token** (bearer, opaque string). FE simpan
via `AuthProvider`; dikirim di header `Authorization: Bearer`.

### `POST /auth/google` — Login via Google ID token

Client (app/web) dapat **ID token** dari Google Sign-In lalu kirim ke server; server
**memverifikasi** token itu ke Google (bukan alur OAuth redirect).

**Request**
```json
{ "id_token": "<google_id_token_jwt>" }
```

**200 OK**
```json
{
  "token": "1|abcdef...",
  "user": {
    "id": "9b1f...",
    "name": "Budi Kasir",
    "email": "budi@toko.com",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "current_store_id": "store-uuid"
  },
  "stores": [
    { "id": "store-uuid", "name": "Toko Kacaw", "role": "owner" }
  ]
}
```

**422** — `id_token` kosong/invalid. **401** — token gagal diverifikasi ke Google.

Perilaku server: verifikasi `id_token` → `firstOrCreate` user by `google_id` (fallback
`email`) → jika user belum punya store, buat store default + assign role `owner` →
terbitkan Sanctum token.

### `POST /auth/login` — Email/password (dev & test)

Buat pengembangan/test otomatis. Boleh dinonaktifkan di produksi.

**Request** `{ "email": "budi@toko.com", "password": "secret" }`
**200 OK** — bentuk sama dengan `/auth/google`. **422** — kredensial salah.

### `GET /auth/me` — Profil + daftar toko

**200 OK** `{ "user": { ... }, "stores": [ ... ] }` (bentuk sama seperti di atas).

### `POST /auth/logout` — Cabut token aktif

**204 No Content**. Menghapus personal access token yang dipakai request ini.

### `GET /stores` — Daftar toko user

**200 OK** `{ "stores": [ { "id", "name", "role" } ] }`

Toko aktif ditentukan oleh header `X-Store-Id: <store-uuid>` (opsional; default =
`user.current_store_id`). Semua endpoint sync ter-scope ke toko aktif ini.

---

## 3. Sinkronisasi

### Model data transport

**ChangeEnvelope** (satu baris outbox FE):
```ts
{ id, entity, entityId, op, payload, createdAt }
```
- `id` — **UUID baris outbox** (BUKAN id entity). Dipakai server buat ack/reject.
- `entity` — nama tabel (lihat allowlist §3.3).
- `entityId` — id entity (UUID).
- `op` — `"insert" | "update" | "delete"`.
- `payload` — **objek JSON** (bukan string):
  - `insert`/`update` → **full row** (semua kolom entity + kolom sync).
  - `delete` → `{ "id": "<uuid>", "deleted_at": <epoch ms> }` saja.
- `createdAt` — epoch ms saat outbox ditulis.

### `POST /sync/push` — Kirim perubahan lokal ke server

Idempoten: aman dikirim ulang (server upsert by id + LWW).

**Request**
```json
{
  "changes": [
    {
      "id": "outbox-uuid-1",
      "entity": "products",
      "entityId": "prod-uuid",
      "op": "insert",
      "payload": {
        "id": "prod-uuid", "category_id": null, "name": "Kopi Susu",
        "sku": null, "barcode": null, "barcode_type": "EAN13", "price": 18000, "cost": 9000,
        "track_stock": 0, "stock": 0, "image_path": "media://m-uuid",
        "active": 1, "created_at": 1722762000000, "updated_at": 1722762000000,
        "deleted_at": null, "dirty": 1, "sync_version": 0, "remote_id": null
      },
      "createdAt": 1722762000000
    }
  ]
}
```

**200 OK** — `PushResult`, key = **outbox id** (`envelope.id`):
```json
{
  "acked": ["outbox-uuid-1"],
  "rejected": [{ "id": "outbox-uuid-9", "reason": "stale" }]
}
```

FE menandai baris `acked` → `status='sent'`, dan `rejected` → `status='failed'`
(`last_error = reason`).

**Reason enum (`rejected[].reason`)**

| reason | Arti |
|---|---|
| `unknown_entity` | `entity` di luar allowlist §3.3 |
| `forbidden_entity` | entity dikenal tapi tak boleh disync (mis. `settings`) |
| `invalid_payload` | payload tak lengkap / tipe salah / `id` hilang |
| `stale` | `payload.updated_at` ≤ versi tersimpan (LWW kalah) — **bukan error**, sekadar dilewati |
| `forbidden` | user tak punya permission `sync.push` untuk toko ini |

Per-envelope diproses dalam transaksi terpisah — satu envelope gagal tidak
membatalkan yang lain.

### `GET /sync/pull?entity=<name>&since=<epoch ms>` — Tarik perubahan server

**Query**: `entity` (wajib, allowlist), `since` (epoch ms, default `0`).

**200 OK** — `PullResult`:
```json
{
  "entity": "products",
  "changes": [ { "id": "prod-uuid", "name": "Kopi Susu", "price": 18000, "updated_at": 1722770000000, "deleted_at": null, "...": "..." } ],
  "cursor": 1722770000000
}
```

Aturan:
- Kembalikan semua row toko aktif dengan `updated_at > since`, **termasuk tombstone**
  (`deleted_at` terisi), diurutkan `updated_at ASC`.
- `cursor` = `updated_at` terbesar di batch (dipakai FE jadi `since` berikutnya).
  Kalau `changes` kosong, `cursor` = `since`.
- Row `media` di pull mengembalikan `remote_url` (bukan `data` base64) — lihat §4.

### 3.3 Allowlist entity (8, ter-scope toko)

`categories`, `products`, `media`, `cashier_sessions`, `sales`, `sale_items`,
`cashflow_categories`, `cashflow_entries`.

**`settings` TIDAK disync** — device-local (pin_hash, theme, qris_payload,
qris_dynamic, device_id, splash_*, store_logo). Push `entity="settings"` → `rejected:
forbidden_entity`.

### 3.4 Aturan sinkronisasi (server)

1. **Tenancy**: `store_id` diisi **server-side** dari toko aktif (dari token/header),
   **tidak pernah dari payload client**. Semua query di-scope global oleh `store_id`.
2. **Upsert by `id`** (UUID client) dalam scope toko.
3. **Last-Write-Wins by `payload.updated_at`**: apply hanya jika `payload.updated_at >
   stored.updated_at`; kalau ≤ → `rejected: stale` (row server dibiarkan).
4. **Delete** = set `deleted_at` (+ bump `updated_at`), row tetap ada (tombstone) →
   ikut terkirim di pull agar device lain ikut menghapus.
5. `sync_version` di-*increment* server tiap apply (audit/observability, **bukan**
   gerbang konflik — konflik diputus LWW `updated_at`).
6. **FK longgar**: server tidak menolak insert karena parent belum ada (urutan sync
   antar-entity tak dijamin). Relasi disimpan by-id; integritas ditegakkan FE.

---

## 4. Media

`media` disync seperti entity lain tapi byte gambar diperlakukan khusus:

- **Push** (`insert`/`update`): payload boleh menyertakan `data` (base64 tanpa prefix
  `data:`). Server menyimpan byte ke storage (disk/objek), mengisi `remote_url`, dan
  **boleh mengosongkan `data`** di DB. `hash` dipakai dedup.
- **Pull**: kembalikan row `media` dengan `remote_url` terisi dan `data` = `null`.
  FE memuat gambar dari `remote_url` bila ada, jika tidak dari `data`.
- **Limit**: payload media melebihi batas server → `413` (push) atau `rejected:
  invalid_payload`.

---

## 5. Skema payload per entity

Semua entity punya **kolom sync** (dari `SyncEntity`): `id`, `created_at`,
`updated_at`, `deleted_at`, `dirty`, `sync_version`, `remote_id`. `dirty`/`remote_id`
bersifat lokal-FE; server menerimanya tapi mengabaikan untuk logika (kecuali echo).

### categories
| field | tipe | ket |
|---|---|---|
| name | string | |
| sort_order | int | |
| color | string\|null | hex opsional |

### products
| field | tipe | ket |
|---|---|---|
| category_id | uuid\|null | |
| name | string | |
| sku | string\|null | |
| barcode | string\|null | |
| barcode_type | string | simbologi JsBarcode (`EAN13`, `CODE128`, …). Default DB `EAN13` bila klien lama tak mengirimnya |
| price | int | minor units |
| cost | int | minor units |
| track_stock | 0\|1 | |
| stock | int | |
| image_path | string\|null | ref `media://<id>` |
| active | 0\|1 | |

### media
| field | tipe | ket |
|---|---|---|
| mime | string | mis. `image/jpeg` |
| width / height | int\|null | |
| bytes | int\|null | ukuran biner perkiraan |
| hash | string\|null | SHA-256 hex base64 (dedup) |
| data | string\|null | base64 (push in; null saat remote_url terisi) |
| remote_url | string\|null | URL objek (diisi server) |

### cashier_sessions
| field | tipe | ket |
|---|---|---|
| opened_at | epoch ms | |
| closed_at | epoch ms\|null | |
| opening_cash / expected_cash | int | |
| counted_cash / difference | int\|null | |
| status | `open`\|`closed` | |
| opened_by | string\|null | |
| note | string\|null | |

### sales
| field | tipe | ket |
|---|---|---|
| session_id | uuid\|null | |
| number | string | nomor struk device-prefixed; unik per toko |
| subtotal / discount / tax / total / paid / change_due | int | minor units |
| payment_method | string | `cash`\|`qris`\|`transfer`\|… |
| status | `completed`\|`void` | |
| sold_at | epoch ms | |

### sale_items
| field | tipe | ket |
|---|---|---|
| sale_id | uuid | |
| product_id | uuid\|null | null bila produk sudah dihapus |
| name_snapshot | string | nama saat transaksi (histori aman) |
| price_snapshot | int | harga saat transaksi |
| qty | int | |
| discount / line_total | int | |

### cashflow_categories
| field | tipe | ket |
|---|---|---|
| name | string | |
| type | `income`\|`expense` | |
| is_system | 0\|1 | kategori sistem (Penjualan) tak bisa dihapus |
| sort_order | int | |

### cashflow_entries
| field | tipe | ket |
|---|---|---|
| category_id | uuid\|null | |
| session_id | uuid\|null | link sesi kasir aktif |
| direction | `debit`\|`credit` | debit=masuk, credit=keluar |
| amount | int | minor units |
| source | `manual`\|`sale` | |
| source_ref | string\|null | `sales.id` bila dari checkout |
| note | string\|null | |
| occurred_at | epoch ms | |

---

## 6. Health

### `GET /health`
**200 OK** `{ "status": "ok", "time": 1722762000000, "version": "v1" }` — tanpa auth.

---

## 7. RBAC (ringkas)

Role per-toko (spatie teams=store): `owner`, `cashier`. Permission:
`sync.push`, `sync.pull`, `catalog.manage`, `reports.view`, `cashier.session`.
`cashier` boleh `sync.*` + `cashier.session`, tapi tidak `catalog.manage`.
Route sync butuh `sync.push`/`sync.pull`; kurang izin → `403`.

---

## 8. Versioning

- Prefix `api/v1`. Perubahan **non-breaking** (tambah field opsional/endpoint) tetap di
  v1. Perubahan **breaking** → `api/v2`, v1 didukung sampai window deprecation diumumkan.
- FE mengirim `Accept: application/json`; server bebas menambah header `Deprecation`.
