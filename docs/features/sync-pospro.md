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
1. **Push:** baca `outbox` pending → kirim `ChangeEnvelope[]` dengan `Bearer <jwt>`
   → server balas `acked`/`rejected` → tandai outbox `sent`, set row `dirty=0` + `sync_version`.
2. **Pull:** per entity `pull(entity, sync_state.last_pulled_at)` → upsert
   last-write-wins by `updated_at`/`sync_version`, lewati row lokal `dirty` (defer konflik),
   majukan cursor.
3. **Trigger:** online kembali (`@capacitor/network`) + timer periodik.

## Phase 6 (selesai) — kontrak + backend
- **Dokumen kontrak API v1** difinalisasi (`docs/api/pos-pro-api-v1.md`).
- **Backend POS Pro** (Laravel) dibangun penuh: auth Google/Sanctum, sync
  push/pull 8 entity, tenancy multi-toko, RBAC, media storage, OpenAPI Scramble.

## Phase 6C (selesai) — adapter FE
- **HTTP client** `src/services/api/client.ts` (map ke `/sync/push` & `/sync/pull`
  kontrak v1) + `config.ts` (baca `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`).
- **Store `account`** (token Sanctum, login email/password + register + **Google
  native** Android, toko aktif, ganti/tambah outlet) + **store `sync`** + `SyncEngine`
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
