<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div
      v-if="icon"
      class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
    >
      <component :is="icon" class="size-8" />
    </div>
    <h3 class="text-base font-semibold">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-xs text-sm text-muted-foreground">
      {{ description }}
    </p>
    <div class="mt-5">
      <slot />
    </div>
  </div>
</template>
