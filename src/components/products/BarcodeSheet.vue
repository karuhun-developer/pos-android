<script setup lang="ts">
import { ref, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Button } from '@/components/ui/button'
import { Share2, Loader2 } from 'lucide-vue-next'
import type { Product } from '@/db/types'
import { barcodeToPngDataUrl, barcodeTypeHint, renderBarcodeSvg } from '@/lib/barcode'
import { saveOrShare, stripDataUrl } from '@/lib/download'
import { formatRupiah } from '@/lib/money'

const props = defineProps<{ open: boolean; product: Product | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const svgEl = ref<SVGSVGElement | null>(null)
const valid = ref(true)
const sharing = ref(false)

watch(
  [() => props.open, () => props.product, svgEl],
  async () => {
    const p = props.product
    if (!props.open || !p || !svgEl.value) return
    if (!p.barcode) {
      valid.value = false
      return
    }
    valid.value = await renderBarcodeSvg(svgEl.value, p.barcode, p.barcode_type)
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
      <div class="flex justify-center rounded-2xl bg-white p-4">
        <svg v-show="valid" ref="svgEl" />
        <p v-if="!valid" class="py-6 text-center text-sm text-neutral-500">
          <template v-if="!product.barcode">Produk ini belum punya barcode.</template>
          <template v-else>
            "{{ product.barcode }}" tidak sesuai {{ product.barcode_type }} —
            butuh {{ barcodeTypeHint(product.barcode_type) }}.
          </template>
        </p>
      </div>

      <p class="text-center text-xs text-muted-foreground">
        {{ product.barcode || '—' }} · {{ product.barcode_type }}
      </p>

      <Button class="w-full gap-2" :disabled="!valid || sharing" @click="share">
        <component :is="sharing ? Loader2 : Share2" class="size-4" :class="sharing && 'animate-spin'" />
        {{ sharing ? 'Menyiapkan…' : 'Bagikan / Simpan Gambar' }}
      </Button>
    </div>
  </BottomSheet>
</template>
