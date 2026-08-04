<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, Plus, Search, Tag, Boxes } from 'lucide-vue-next'
import { useProductsStore } from '@/stores/products'
import { useCategoriesStore } from '@/stores/categories'
import { formatRupiah } from '@/lib/money'
import { cn } from '@/lib/utils'

const router = useRouter()
const products = useProductsStore()
const categories = useCategoriesStore()
const { filtered, query, categoryFilter, count } = storeToRefs(products)

onMounted(async () => {
  await Promise.all([products.load(), categories.load()])
})

function setFilter(id: string | null) {
  categoryFilter.value = categoryFilter.value === id ? null : id
}
</script>

<template>
  <div>
    <AppHeader title="Produk" :subtitle="`${count} item`">
      <template #actions>
        <RouterLink to="/categories">
          <Button variant="ghost" size="icon" title="Kelola kategori">
            <Tag class="size-5" />
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
      <RouterLink
        v-for="p in filtered"
        :key="p.id"
        :to="`/products/${p.id}/edit`"
        class="flex items-center gap-3 px-4 py-3 transition active:bg-accent"
      >
        <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Package class="size-5" />
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
          <p class="text-sm font-semibold">{{ formatRupiah(p.price) }}</p>
          <Badge v-if="!p.active" variant="secondary" class="mt-0.5">Nonaktif</Badge>
        </div>
      </RouterLink>
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
      class="fixed bottom-20 right-1/2 z-30 flex size-14 translate-x-[min(11.5rem,45vw)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
      @click="router.push('/products/new')"
    >
      <Plus class="size-6" />
    </button>
  </div>
</template>
