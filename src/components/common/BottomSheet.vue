<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  emit('update:open', false)
}

// Kunci scroll body saat sheet kebuka.
watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  },
)
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close" />
        <!-- Panel: nempel bawah, dipusatkan di layar lebar -->
        <div
          class="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-3xl border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl"
        >
          <div class="flex shrink-0 items-center justify-center pt-2.5">
            <span class="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <div v-if="title" class="shrink-0 px-5 pb-1 pt-2 text-base font-semibold">
            {{ title }}
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
