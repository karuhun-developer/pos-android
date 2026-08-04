<script setup lang="ts">
import type { Component } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Hammer } from 'lucide-vue-next'

defineProps<{
  title: string
  icon?: Component
  phase?: string
}>()
</script>

<template>
  <div>
    <AppHeader :title="title" />
    <EmptyState
      :icon="icon ?? Hammer"
      title="Segera hadir"
      :description="phase ? `Fitur ini dikerjakan di ${phase}.` : 'Fitur ini sedang dalam pengembangan.'"
    />
  </div>
</template>
