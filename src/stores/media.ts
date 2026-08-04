import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDb } from '@/db/sqlite'
import { MediaRepository } from '@/repositories/media.repo'
import { sha256Hex, toDataUrl, type ProcessedImage } from '@/lib/image'

const REF_PREFIX = 'media://'

/** `media://<id>` → `<id>`; kalau bukan ref media, balikin null. */
export function mediaRefId(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith(REF_PREFIX)) return null
  return ref.slice(REF_PREFIX.length) || null
}

interface CachedMedia {
  mime: string
  data: string | null
  remote_url: string | null
}

export const useMediaStore = defineStore('media', () => {
  // Cache in-memory biar list produk gak query per-baris.
  const cache = ref<Map<string, CachedMedia>>(new Map())
  // Reactive tick supaya `url()` yang dipakai di template ikut re-render
  // setelah `ensure()` mengisi cache.
  const version = ref(0)

  function repo() {
    return new MediaRepository(getDb())
  }

  /** Pastikan media untuk ref-ref ini sudah ada di cache. */
  async function ensure(refs: Array<string | null | undefined>) {
    const ids = Array.from(
      new Set(
        refs
          .map((r) => mediaRefId(r))
          .filter((id): id is string => !!id && !cache.value.has(id)),
      ),
    )
    if (!ids.length) return
    const rows = await repo().byIds(ids)
    for (const m of rows) {
      cache.value.set(m.id, {
        mime: m.mime,
        data: m.data,
        remote_url: m.remote_url,
      })
    }
    version.value++
  }

  /** URL siap-pajang buat <img> — data URL lokal atau remote_url. Null kalau kosong. */
  function url(ref: string | null | undefined): string | null {
    void version.value // jejak reaktif
    const id = mediaRefId(ref)
    if (!id) return null
    const m = cache.value.get(id)
    if (!m) return null
    if (m.data) return toDataUrl(m.mime, m.data)
    return m.remote_url
  }

  /**
   * Simpan gambar hasil proses ke tabel `media`, dedup by hash.
   * Balikin ref `media://<id>` buat ditaruh di products.image_path.
   */
  async function save(img: ProcessedImage): Promise<string> {
    const hash = await sha256Hex(img.data)
    const existing = await repo().findByHash(hash)
    const row =
      existing ??
      (await repo().create({
        mime: img.mime,
        width: img.width,
        height: img.height,
        bytes: img.bytes,
        hash,
        data: img.data,
        remote_url: null,
      }))
    cache.value.set(row.id, {
      mime: row.mime,
      data: row.data,
      remote_url: row.remote_url,
    })
    version.value++
    return `${REF_PREFIX}${row.id}`
  }

  return { ensure, url, save }
})
