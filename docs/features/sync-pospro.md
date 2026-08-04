# Fitur: Sync ke POS Pro (Cloud)

**Status:** 🧩 Kontrak API v1 final + backend POS Pro jalan · adapter FE menyusul (Phase 6C) · **Backend:** POS Pro (Laravel, Sanctum bearer)

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

## Phase 6C (menyusul) — adapter FE
- Implementasi `HttpSyncAdapter` (map ke `/sync/push` & `/sync/pull` kontrak v1) +
  `GoogleAuthProvider`/`JwtAuthProvider` (bearer token dari `/auth/*`).
- UI "Sambungkan Akun" + tombol "Sync sekarang" + indikator status di store `sync`.
- Catatan mapping: `acked`/`rejected` di-key **outbox id**; `pull.cursor` →
  `sync_state.last_pulled_at`; header `Authorization: Bearer`, `X-Store-Id`,
  `X-Device-Id`.

## Kode
- `src/services/auth/types.ts`, `src/services/sync/types.ts`, `SyncEngine.ts`
- `src/repositories/outbox.repo.ts`, `syncState.repo.ts`
