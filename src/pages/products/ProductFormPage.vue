<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import MoneyInput from '@/components/common/MoneyInput.vue'
import ScannerSheet from '@/components/pos/ScannerSheet.vue'
import { Trash2, ImagePlus, ImageIcon, Loader2, ScanLine } from 'lucide-vue-next'
import { capabilities } from '@/services/capabilities/registry'
import { useProductsStore, toProductInput, type ProductInput } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'
import { useMediaStore } from '@/stores/media'
import { pickImage, downscale, toDataUrl, type ProcessedImage } from '@/lib/image'
import {
  BARCODE_TYPES,
  DEFAULT_BARCODE_TYPE,
  barcodeTypeHint,
  barcodeTypeLabel,
  effectiveBarcodeValue,
  guessBarcodeType,
  isValidBarcode,
  normalizeBarcodeType,
} from '@/lib/barcode'

const route = useRoute()
const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()
const media = useMediaStore()

// Gambar ditahan lokal dulu; row `media` baru dibuat pas save() → gak ada
// media yatim kalau user batal.
const pendingImage = ref<ProcessedImage | null>(null)
const preview = ref<string | null>(null)
const picking = ref(false)

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)
const saving = ref(false)
const loading = ref(true)

const form = reactive<ProductInput>({
  category_id: null,
  name: '',
  sku: null,
  barcode: null,
  barcode_type: DEFAULT_BARCODE_TYPE,
  price: 0,
  cost: 0,
  track_stock: 0,
  stock: 0,
  image_path: null,
  active: 1,
})

const trackStock = computed({
  get: () => form.track_stock === 1,
  set: (v: boolean) => (form.track_stock = v ? 1 : 0),
})
const isActive = computed({
  get: () => form.active === 1,
  set: (v: boolean) => (form.active = v ? 1 : 0),
})

// Tombol scan cuma muncul kalau device-nya memang bisa (browser tanpa kamera,
// izin belum tentu ada — tapi minimal API-nya tersedia).
const scannerReady = ref(false)
const scanOpen = ref(false)

async function onScanned(code: string) {
  form.barcode = code
  form.barcode_type = await guessBarcodeType(code)
}

onMounted(async () => {
  scannerReady.value = await capabilities.has('scanner')
  await categories.load()
  if (id.value) {
    const p = await products.getById(id.value)
    if (p) {
      // toProductInput() bikin pemetaan ini dicek compiler — kolom produk baru
      // yang lupa dipetakan jadi error typecheck, bukan reset diam-diam.
      Object.assign(form, toProductInput(p))
      if (p.image_path) {
        await media.ensure([p.image_path])
        preview.value = media.url(p.image_path)
      }
    }
  } else {
    // Datang dari mode scan kasir: /products/new?barcode=8991…
    const scanned = (route.query.barcode as string | undefined)?.trim()
    if (scanned) {
      form.barcode = scanned
      form.barcode_type = await guessBarcodeType(scanned)
    }
  }
  loading.value = false
})

const canSave = computed(() => form.name.trim().length > 0)

// ── Validasi barcode (peringatan, TIDAK memblokir simpan) ───────────────────
// Barcode lama yang gak sesuai simbologi tetap harus bisa disimpan; user cuma
// diberi tahu supaya sadar barcode-nya nanti gak bisa dirender/dicetak.
const barcodeValid = ref<boolean | null>(null)
/** Tipe lain yang cocok buat nilai yang sekarang — cuma SARAN, gak pernah
 *  dipasang otomatis (lihat `useSuggestedType()`). */
const suggestedType = ref<string | null>(null)

// Watcher-nya async → ketikan cepat bisa balapan dan hasil lama menimpa yang
// baru. Token ini bikin hasil usang langsung dibuang.
let validateToken = 0

watch(
  [() => form.barcode, () => form.barcode_type],
  async ([value, type]) => {
    const token = ++validateToken
    const v = (value ?? '').trim()
    suggestedType.value = null
    if (!v) {
      barcodeValid.value = null
      return
    }
    const ok = await isValidBarcode(v, type)
    if (token !== validateToken) return
    barcodeValid.value = ok
    if (ok) return
    const guess = await guessBarcodeType(v)
    if (token !== validateToken) return
    // guessBarcodeType() jatuh ke default kalau gak ada yang cocok — jangan
    // nyaranin tipe yang sama-sama invalid.
    if (guess !== type && (await isValidBarcode(v, guess))) {
      if (token !== validateToken) return
      suggestedType.value = guess
    }
  },
  { immediate: true },
)

/**
 * Pasang tipe yang disarankan — HARUS lewat tap user.
 *
 * Sengaja gak otomatis: menebak sendiri saat barcode diketik manual bakal
 * (a) menimpa tipe yang user pilih sadar-sadar, dan (b) menyembunyikan typo —
 * EAN-13 yang salah satu digitnya keliru masih lolos sebagai ITF-14, jadi
 * peringatannya malah hilang. Nebak otomatis cuma buat hasil scan & deep link
 * `?barcode=`, yang nilainya sudah pasti benar.
 */
function useSuggestedType() {
  if (suggestedType.value) form.barcode_type = suggestedType.value
}

// Angka yang bakal tergambar. EAN/UPC/ITF nambah check digit sendiri, jadi bisa
// beda dari yang diketik — ditampilkan supaya user gak kaget pas lihat sheet.
const barcodeRendered = computed(() => {
  const v = form.barcode?.trim() ?? ''
  return v ? effectiveBarcodeValue(v, form.barcode_type) : ''
})
const barcodeAutoCheckDigit = computed(
  () => barcodeValid.value === true && barcodeRendered.value !== (form.barcode ?? '').trim(),
)

async function choosePhoto() {
  const dataUrl = await pickImage()
  if (!dataUrl) return
  picking.value = true
  try {
    const img = await downscale(dataUrl)
    pendingImage.value = img
    preview.value = toDataUrl(img.mime, img.data)
  } finally {
    picking.value = false
  }
}

function removePhoto() {
  pendingImage.value = null
  preview.value = null
  form.image_path = null
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  // Baru simpan byte gambar ke tabel media di sini → dapat ref media://<id>.
  if (pendingImage.value) {
    form.image_path = await media.save(pendingImage.value)
    pendingImage.value = null
  }
  const payload: ProductInput = {
    ...form,
    name: form.name.trim(),
    sku: form.sku?.trim() || null,
    barcode: form.barcode?.trim() || null,
    barcode_type: normalizeBarcodeType(form.barcode_type),
    stock: form.track_stock ? form.stock : 0,
  }
  if (isEdit.value && id.value) {
    await products.update(id.value, payload)
  } else {
    await products.create(payload)
  }
  saving.value = false
  router.back()
}

async function remove() {
  if (!id.value) return
  if (!confirm('Hapus produk ini?')) return
  await products.remove(id.value)
  router.push('/products')
}
</script>

<template>
  <div>
    <AppHeader :title="isEdit ? 'Edit Produk' : 'Produk Baru'" back>
      <template #actions>
        <Button v-if="isEdit" variant="ghost" size="icon" @click="remove">
          <Trash2 class="size-5 text-destructive" />
        </Button>
      </template>
    </AppHeader>

    <div v-if="!loading" class="space-y-5 p-4 pb-28">
      <!-- Foto produk -->
      <div class="flex items-center gap-4">
        <div class="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          <img v-if="preview" :src="preview" alt="Foto produk" class="size-full object-cover" />
          <ImageIcon v-else class="size-8 text-muted-foreground" />
          <div v-if="picking" class="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
          </div>
        </div>
        <div class="space-y-2">
          <Button type="button" variant="outline" size="sm" class="gap-2" :disabled="picking" @click="choosePhoto">
            <ImagePlus class="size-4" />
            {{ preview ? 'Ganti Foto' : 'Tambah Foto' }}
          </Button>
          <button
            v-if="preview"
            type="button"
            class="block text-xs text-destructive"
            @click="removePhoto"
          >
            Hapus foto
          </button>
          <p v-else class="text-xs text-muted-foreground">JPG/PNG — otomatis dikecilkan.</p>
        </div>
      </div>

      <div class="space-y-1.5">
        <Label for="name">Nama Produk <span class="text-destructive">*</span></Label>
        <Input id="name" v-model="form.name" placeholder="mis. Bolu Coklat" />
      </div>

      <div class="space-y-1.5">
        <Label for="category">Kategori</Label>
        <select
          id="category"
          v-model="form.category_id"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option :value="null">Tanpa kategori</option>
          <option v-for="c in categories.items" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label>Harga Jual</Label>
          <MoneyInput v-model="form.price" />
        </div>
        <div class="space-y-1.5">
          <Label>Harga Modal</Label>
          <MoneyInput v-model="form.cost" />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label for="sku">SKU</Label>
        <Input id="sku" v-model="form.sku as string" placeholder="opsional" />
      </div>

      <div class="space-y-1.5">
        <Label for="barcode">Barcode</Label>
        <div class="flex gap-2">
          <Input
            id="barcode"
            v-model="form.barcode as string"
            class="flex-1"
            inputmode="numeric"
            placeholder="opsional"
          />
          <Button
            v-if="scannerReady"
            type="button"
            variant="outline"
            size="icon"
            title="Scan barcode"
            @click="scanOpen = true"
          >
            <ScanLine class="size-5" />
          </Button>
        </div>
        <select
          id="barcode_type"
          v-model="form.barcode_type"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option v-for="t in BARCODE_TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
        <p v-if="barcodeValid === true" class="text-xs text-success">
          ✓ Barcode valid untuk {{ form.barcode_type }}
        </p>
        <p v-else-if="barcodeValid === false" class="text-xs text-destructive">
          Tidak sesuai {{ form.barcode_type }} — butuh {{ barcodeTypeHint(form.barcode_type) }}.
          Tetap bisa disimpan, tapi barcode-nya <strong>gak bisa digambar sama sekali</strong>:
          sheet "Lihat barcode" bakal kosong dan tombol bagikan mati.
        </p>
        <!-- Saran, bukan koreksi otomatis — lihat useSuggestedType(). -->
        <button
          v-if="suggestedType"
          type="button"
          class="text-xs font-medium text-info underline underline-offset-2"
          @click="useSuggestedType"
        >
          Kode ini cocoknya {{ barcodeTypeLabel(suggestedType) }} — pakai itu?
        </button>
        <p v-else class="text-xs text-muted-foreground">
          Kosongkan kalau produk ini gak punya barcode.
        </p>
        <!-- Check digit ditambah otomatis → angka di gambar beda dari yang diketik. -->
        <p v-if="barcodeAutoCheckDigit" class="text-xs text-warning">
          Tergambar sebagai <strong>{{ barcodeRendered }}</strong> — check digit ditambah
          otomatis.
        </p>
      </div>

      <div class="space-y-3 rounded-xl border border-border p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Lacak Stok</p>
            <p class="text-xs text-muted-foreground">Kurangi stok tiap penjualan</p>
          </div>
          <Switch v-model="trackStock" />
        </div>
        <div v-if="trackStock" class="space-y-1.5">
          <Label for="stock">Jumlah Stok</Label>
          <Input id="stock" v-model.number="form.stock" type="number" inputmode="numeric" />
        </div>
      </div>

      <div class="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <p class="text-sm font-medium">Produk Aktif</p>
          <p class="text-xs text-muted-foreground">Tampil di layar kasir</p>
        </div>
        <Switch v-model="isActive" />
      </div>
    </div>

    <ScannerSheet v-model:open="scanOpen" title="Scan Barcode Produk" @scan="onScanned" />

    <!-- Save bar -->
    <div class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-64 md:right-0 md:mx-0 md:max-w-none">
      <Button class="w-full" size="lg" :disabled="!canSave || saving" @click="save">
        {{ saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Produk' }}
      </Button>
    </div>
  </div>
</template>
