# Fitur: Sync ke POS Pro (Cloud)

**Status:** ✅ Kontrak API v1 + backend POS Pro + adapter FE (Phase 6C) jalan · **Backend:** POS Pro (Laravel, Sanctum bearer)

> 📄 **Kontrak API:** [`docs/api/pos-pro-api-v1.md`](../api/pos-pro-api-v1.md) —
> sumber kebenaran endpoint, payload per entity, aturan LWW/tombstone, RBAC, media.
> Backend-nya sudah dibangun di `/var/www/html/pos-pro`
> (repo `git@github.com:karuhun-developer/pos-web.git`).

## Tujuan
Mengangkat app dari single-device offline menjadi multi-device dengan backup cloud:
login online (email/Google), lalu sinkronisasi dua arah.

## Desain (sudah tersedia di v1, inert)
- `AuthProvider` — sumber token JWT. v1 = `NullAuthProvider` (selalu null).
- `SyncAdapter` — transport REST: `push(changes)` & `pull(entity, since)`.
- `SyncEngine` — loop + status (`idle|syncing|error|offline|disabled`).
- `outbox` sudah terisi otomatis oleh semua repository sejak Phase 0.

## Flow (saat POS Pro aktif)
1. **Recovery sebelum push:** scan setiap entity syncable untuk row `dirty=1`
   yang tidak memiliki envelope `outbox` dengan `entity` dan `entity_id` yang sama.
   Recovery membangun ulang envelope `pending` (`update` untuk row aktif, `delete`
   untuk tombstone), sehingga perubahan lokal lama tidak hilang hanya karena
   envelope-nya gagal tersimpan.
2. **Push:** baca `outbox` pending → kirim `ChangeEnvelope[]` dengan `Bearer <jwt>`
   → server balas `acked`/`rejected` → tandai outbox `sent`; bila payload masih
   cocok dengan row lokal, set row `dirty=0`. Acknowledgement push tidak mengubah
   `sync_version`.
   Penolakan tetap berstatus `failed` beserta alasannya, sehingga UI sync dapat
   menampilkannya dan pengguna dapat menjalankan retry manual; retry
   mengembalikannya ke `pending` lalu menjalankan sync lagi.
3. **Pull:** per entity `pull(entity, sync_state.last_pulled_at)` → upsert
   last-write-wins by `updated_at`/`sync_version`, lewati row lokal `dirty` (defer konflik),
   majukan cursor.
4. **Trigger:** online kembali (`@capacitor/network`) + timer periodik.

Kategori cashflow bawaan adalah baseline **device-local**, bukan data bisnis yang
harus dibagikan: seed baru dibuat `dirty=0` tanpa envelope outbox. Migrasi v6
membersihkan hanya cohort legacy lengkap: tepat sembilan row total pada satu
`created_at`, seluruhnya eligible dan masing-masing cocok tepat sekali dengan
satu default. Satu row ekstra, diubah, remote, terhapus, versioned, atau outboxed
memblokir seluruh cohort; cohort parsial atau campuran tetap dirty dan tetap ikut
sync. Tidak ada provenance historis, jadi clone yang sepenuhnya tidak dapat
dibedakan dalam cohort sembilan-row yang sama juga tidak dapat dibedakan secara
data.

## Phase 6 (selesai) — kontrak + backend
- **Dokumen kontrak API v1** difinalisasi (`docs/api/pos-pro-api-v1.md`).
- **Backend POS Pro** (Laravel) dibangun penuh: auth Google/Sanctum, sync
  push/pull 8 entity, tenancy multi-toko, RBAC, media storage, OpenAPI Scramble.

## Phase 6C (selesai) — adapter FE
- **HTTP client** `src/services/api/client.ts` (map ke `/sync/push` & `/sync/pull`
  kontrak v1) + `config.ts` (baca `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`).
- **Store `account`** (token Sanctum, login email/password + register + **Google
  native** Android, toko aktif, ganti/tambah outlet) + **store `sync`** + `SyncEngine`.
  Token Android disimpan melalui Android Keystore-backed encryption; token SQLite
  lama dimigrasikan sekali lalu dihapus. Browser tetap memakai persistence yang ada.
  (push outbox → pull per-entity LWW/tombstone, auto saat online).
- **UI Sambungkan** (`/connect`, `ConnectPage.vue`): Masuk/Daftar, pilih & ganti
  outlet (dengan modal konfirmasi), "Sync sekarang" + status.
- Mapping: `acked`/`rejected` di-key **outbox id**; `pull.cursor` →
  `sync_state.last_pulled_at`; header `Authorization: Bearer`, `X-Store-Id`,
  `X-Device-Id`. Ganti outlet → `resetLocalBusinessData()` lalu re-pull.

## Kode
- `src/services/api/client.ts`, `config.ts`
- `src/services/sync/SyncEngine.ts`, `applyPull.ts`, `types.ts`
- `src/services/auth/google.ts`, `src/services/auth/types.ts`
- `src/stores/account.ts`, `src/stores/sync.ts`, `src/db/reset.ts`
- `src/pages/settings/ConnectPage.vue`
- `src/repositories/outbox.repo.ts`, `syncState.repo.ts`
