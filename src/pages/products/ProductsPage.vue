<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BarcodeSheet from '@/components/products/BarcodeSheet.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, Plus, Search, Tag, Boxes, Barcode } from 'lucide-vue-next'
import { useProductsStore } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'
import { useMediaStore } from '@/stores/media'
import type { Product } from '@/db/types'
import { formatRupiah } from '@/lib/money'
import { cn } from '@/lib/utils'

const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()
const media = useMediaStore()
const { filtered, query, categoryFilter, count } = storeToRefs(products)

const barcodeOpen = ref(false)
const barcodeProduct = shallowRef<Product | null>(null)

function showBarcode(p: Product) {
  barcodeProduct.value = p
  barcodeOpen.value = true
}

onMounted(async () => {
  await Promise.all([products.load(), categories.load()])
  await media.ensure(products.items.map((p) => p.image_path))
})

function setFilter(id: string | null) {
  categoryFilter.value = categoryFilter.value === id ? null : id
}
</script>

<template>
  <div>
    <AppHeader title="Produk" :subtitle="`${count} item`" back>
      <template #actions>
        <RouterLink to="/categories">
          <Button variant="outline" size="sm" class="gap-1.5" title="Kelola kategori">
            <Tag class="size-4" />
            <span>Kategori</span>
          </Button>
        </RouterLink>
      </template>
    </AppHeader>

    <!-- Search -->
    <div class="sticky top-[57px] z-20 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Cari produk / SKU / barcode" class="pl-9" />
      </div>
      <!-- Filter kategori -->
      <div v-if="categories.items.length" class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        <button
          class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
          :class="cn(!categoryFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')"
          @click="setFilter(null)"
        >
          Semua
        </button>
        <button
          v-for="c in categories.items"
          :key="c.id"
          class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
          :class="cn(categoryFilter === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')"
          @click="setFilter(c.id)"
        >
          {{ c.name }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-if="filtered.length" class="divide-y divide-border">
      <!-- Baris = RouterLink + tombol barcode bersebelahan (bukan tombol DI DALAM
           link), supaya tap tombol gak ikut ke-navigate ke form edit. -->
      <div v-for="p in filtered" :key="p.id" class="flex items-center">
        <RouterLink
          :to="`/products/${p.id}/edit`"
          class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 transition active:bg-accent"
        >
          <div class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
            <img
              v-if="media.url(p.image_path)"
              :src="media.url(p.image_path)!"
              :alt="p.name"
              class="size-full object-cover"
            />
            <Package v-else class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ p.name }}</p>
            <div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{{ categories.nameOf(p.category_id) }}</span>
              <span v-if="p.track_stock" class="flex items-center gap-0.5">
                <Boxes class="size-3" /> {{ p.stock }}
              </span>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-info">{{ formatRupiah(p.price) }}</p>
            <Badge v-if="!p.active" variant="secondary" class="mt-0.5">Nonaktif</Badge>
          </div>
        </RouterLink>
        <button
          v-if="p.barcode"
          type="button"
          class="mr-2 flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition active:scale-95 active:bg-accent"
          title="Lihat barcode"
          @click="showBarcode(p)"
        >
          <Barcode class="size-5" />
        </button>
        <span v-else class="w-2 shrink-0" />
      </div>
    </div>

    <EmptyState
      v-else
      :icon="Package"
      :title="query || categoryFilter ? 'Produk tidak ditemukan' : 'Belum ada produk'"
      description="Tambahkan produk pertama untuk mulai berjualan."
    >
      <Button class="gap-2" @click="router.push('/products/new')">
        <Plus class="size-4" /> Tambah Produk
      </Button>
    </EmptyState>

    <!-- FAB -->
    <button
      v-if="filtered.length"
      class="fixed bottom-20 right-5 z-30 md:bottom-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
      @click="router.push('/products/new')"
    >
      <Plus class="size-6" />
    </button>

    <BarcodeSheet v-model:open="barcodeOpen" :product="barcodeProduct" />
  </div>
</template>
