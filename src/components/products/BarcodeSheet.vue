<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Button } from '@/components/ui/button'
import { Share2, Loader2 } from 'lucide-vue-next'
import type { Product } from '@/db/types'
import { barcodeToPngDataUrl, barcodeTypeHint, renderBarcodeSvg } from '@/lib/barcode'
import { saveOrShare, stripDataUrl } from '@/lib/download'
import { formatRupiah } from '@/lib/money'

const props = defineProps<{ open: boolean; product: Product | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

type Status = 'idle' | 'rendering' | 'ok' | 'invalid' | 'empty'

const svgEl = ref<SVGSVGElement | null>(null)
const status = ref<Status>('idle')
/** Angka yang benar-benar tergambar — bisa beda dari `product.barcode` karena
 *  EAN/UPC/ITF menambah check digit sendiri. */
const rendered = ref('')
const sharing = ref(false)

// Watcher-nya async → dua perubahan beruntun bisa balapan dan yang lama menimpa
// yang baru. Token ini bikin hasil render usang langsung dibuang.
let renderToken = 0

const valid = computed(() => status.value === 'ok')

watch(
  // Field-nya ikut di-watch, bukan cuma identitas objek: kalau suatu saat store
  // memutasi row di tempat, watcher ini tetap kebangun.
  [
    () => props.open,
    () => props.product,
    () => props.product?.barcode,
    () => props.product?.barcode_type,
    svgEl,
  ],
  async () => {
    const token = ++renderToken
    const p = props.product
    // Reset DULU di tiap cabang — tanpa ini status produk sebelumnya kebawa
    // (tombol Bagikan tetap aktif / pesan error milik produk lain).
    rendered.value = ''
    if (!props.open || !p) {
      status.value = 'idle'
      return
    }
    if (!p.barcode) {
      status.value = 'empty'
      return
    }
    status.value = 'rendering'
    // Elemennya belum ke-mount. Aman: `svgEl` ikut di-watch, jadi watcher ini
    // jalan lagi begitu ref-nya keisi — statusnya sudah terlanjur di-reset.
    if (!svgEl.value) return
    const res = await renderBarcodeSvg(svgEl.value, p.barcode, p.barcode_type)
    if (token !== renderToken) return // sudah ada render yang lebih baru
    status.value = res.ok ? 'ok' : 'invalid'
    rendered.value = res.rendered
  },
  { flush: 'post' },
)

async function share() {
  const p = props.product
  if (!p?.barcode) return
  sharing.value = true
  try {
    const dataUrl = await barcodeToPngDataUrl(p.barcode, p.barcode_type)
    if (!dataUrl) return
    const safe = p.name.replace(/[^\w\-]+/g, '-').slice(0, 40) || 'produk'
    await saveOrShare(`barcode-${safe}-${p.barcode}.png`, stripDataUrl(dataUrl), 'image/png')
  } finally {
    sharing.value = false
  }
}
</script>

<template>
  <BottomSheet :open="open" title="Barcode" @update:open="emit('update:open', $event)">
    <div v-if="product" class="space-y-4 p-5">
      <div class="text-center">
        <p class="font-semibold">{{ product.name }}</p>
        <p class="text-sm text-info">{{ formatRupiah(product.price) }}</p>
      </div>

      <!-- Barcode wajib latar putih & garis hitam, termasuk di dark mode —
           scanner baca kontras, bukan warna tema. -->
      <div class="flex min-h-32 items-center justify-center rounded-2xl bg-white p-4">
        <!-- `:key` maksa elemen SVG BARU tiap nilai/tipe berubah → mustahil ada
             sisa gambar lama, sekalipun render berikutnya gagal total. -->
        <svg
          v-show="status === 'ok'"
          :key="`${product.barcode}|${product.barcode_type}`"
          ref="svgEl"
        />
        <Loader2 v-if="status === 'rendering'" class="size-5 animate-spin text-neutral-400" />
        <p v-else-if="status === 'empty'" class="py-6 text-center text-sm text-neutral-500">
          Produk ini belum punya barcode.
        </p>
        <p v-else-if="status === 'invalid'" class="py-6 text-center text-sm text-neutral-500">
          "{{ product.barcode }}" tidak sesuai {{ product.barcode_type }} —
          butuh {{ barcodeTypeHint(product.barcode_type) }}.
        </p>
      </div>

      <p class="text-center text-xs text-muted-foreground">
        {{ product.barcode || '—' }} · {{ product.barcode_type }}
      </p>

      <!-- Check digit EAN/UPC/ITF ditambah otomatis → angka di gambar bisa beda
           dari yang tersimpan. Bilang terus terang, daripada user ngira salah. -->
      <p v-if="rendered && rendered !== product.barcode" class="text-center text-xs text-warning">
        Tergambar sebagai {{ rendered }} — check digit ditambah otomatis.
      </p>

      <Button class="w-full gap-2" :disabled="!valid || sharing" @click="share">
        <component :is="sharing ? Loader2 : Share2" class="size-4" :class="sharing && 'animate-spin'" />
        {{ sharing ? 'Menyiapkan…' : 'Bagikan / Simpan Gambar' }}
      </Button>
    </div>
  </BottomSheet>
</template>
