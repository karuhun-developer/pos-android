<script setup lang="ts">
import BottomSheet from '@/components/common/BottomSheet.vue'
import CartLines from '@/components/pos/CartLines.vue'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart'
import { formatRupiah } from '@/lib/money'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; pay: [] }>()

const cart = useCartStore()
</script>

<template>
  <BottomSheet :open="open" title="Keranjang" @update:open="emit('update:open', $event)">
    <CartLines />

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
