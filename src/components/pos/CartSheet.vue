<script setup lang="ts">
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Button } from '@/components/ui/button'
import { Package, Minus, Plus, Trash2 } from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { useMediaStore } from '@/stores/media'
import { formatRupiah } from '@/lib/money'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; pay: [] }>()

const cart = useCartStore()
const media = useMediaStore()
</script>

<template>
  <BottomSheet :open="open" title="Keranjang" @update:open="emit('update:open', $event)">
    <div class="divide-y divide-border">
      <div v-for="l in cart.lines" :key="l.productId" class="flex items-center gap-3 px-5 py-3">
        <div class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
          <img
            v-if="media.url(l.image_path)"
            :src="media.url(l.image_path)!"
            :alt="l.name"
            class="size-full object-cover"
          />
          <Package v-else class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ l.name }}</p>
          <p class="text-xs text-muted-foreground">{{ formatRupiah(l.price) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex size-8 items-center justify-center rounded-full border border-border text-foreground active:scale-95"
            @click="cart.dec(l.productId)"
          >
            <component :is="l.qty <= 1 ? Trash2 : Minus" class="size-4" :class="l.qty <= 1 ? 'text-destructive' : ''" />
          </button>
          <span class="w-6 text-center text-sm font-semibold tabular-nums">{{ l.qty }}</span>
          <button
            class="flex size-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40 active:scale-95"
            :disabled="l.qty >= cart.maxQty(l)"
            @click="cart.inc(l.productId)"
          >
            <Plus class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Footer bayar -->
    <div class="sticky bottom-0 space-y-3 border-t border-border bg-background/95 p-4 backdrop-blur">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Total ({{ cart.count }} item)</span>
        <span class="text-lg font-bold">{{ formatRupiah(cart.total) }}</span>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" class="flex-1" @click="cart.clear()">Kosongkan</Button>
        <Button class="flex-[2]" :disabled="cart.isEmpty" @click="emit('pay')">Bayar</Button>
      </div>
    </div>
  </BottomSheet>
</template>
