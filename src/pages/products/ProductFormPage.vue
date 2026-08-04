<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import MoneyInput from '@/components/common/MoneyInput.vue'
import { Trash2 } from 'lucide-vue-next'
import { useProductsStore, type ProductInput } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'

const route = useRoute()
const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)
const saving = ref(false)
const loading = ref(true)

const form = reactive<ProductInput>({
  category_id: null,
  name: '',
  sku: null,
  barcode: null,
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

onMounted(async () => {
  await categories.load()
  if (id.value) {
    const p = await products.getById(id.value)
    if (p) {
      Object.assign(form, {
        category_id: p.category_id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        cost: p.cost,
        track_stock: p.track_stock,
        stock: p.stock,
        image_path: p.image_path,
        active: p.active,
      })
    }
  }
  loading.value = false
})

const canSave = computed(() => form.name.trim().length > 0)

async function save() {
  if (!canSave.value) return
  saving.value = true
  const payload: ProductInput = {
    ...form,
    name: form.name.trim(),
    sku: form.sku?.trim() || null,
    barcode: form.barcode?.trim() || null,
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

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for="sku">SKU</Label>
          <Input id="sku" v-model="form.sku as string" placeholder="opsional" />
        </div>
        <div class="space-y-1.5">
          <Label for="barcode">Barcode</Label>
          <Input id="barcode" v-model="form.barcode as string" placeholder="opsional" />
        </div>
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

    <!-- Save bar -->
    <div class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button class="w-full" size="lg" :disabled="!canSave || saving" @click="save">
        {{ saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Produk' }}
      </Button>
    </div>
  </div>
</template>
