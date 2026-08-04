<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string; for?: string }>()
</script>
<template>
  <label
    :for="props.for"
    :class="cn('text-sm font-medium leading-none', props.class)"
  >
    <slot />
  </label>
</template>
