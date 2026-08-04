<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { formatNumber, parseRupiah } from '@/lib/money'

const props = defineProps<{ modelValue: number; class?: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const display = computed(() =>
  props.modelValue ? formatNumber(props.modelValue) : '',
)

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  emit('update:modelValue', parseRupiah(raw))
}
</script>

<template>
  <div class="relative">
    <span
      class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
    >
      Rp
    </span>
    <input
      inputmode="numeric"
      :value="display"
      :placeholder="placeholder ?? '0'"
      @input="onInput"
      :class="
        cn(
          'flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          props.class,
        )
      "
    />
  </div>
</template>
