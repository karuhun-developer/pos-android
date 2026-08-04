# Fitur: Sync ke POS Pro (Cloud)

**Status:** 🧩 Interface siap, implementasi menyusul (Phase 6) · **Backend:** Generic REST/JWT

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

## Yang dikerjakan Phase 6
- Implementasi `HttpSyncAdapter` + `JwtAuthProvider` (login online/Google).
- UI "Sambungkan Akun" + tombol "Sync sekarang" + indikator status di store `sync`.
- Dokumen kontrak endpoint REST (`/push`, `/pull`, `/auth`).

## Kode
- `src/services/auth/types.ts`, `src/services/sync/types.ts`, `SyncEngine.ts`
- `src/repositories/outbox.repo.ts`, `syncState.repo.ts`
