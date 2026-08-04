<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  length?: number
  error?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: [value: string]
}>()

const len = computed(() => props.length ?? 6)
const dots = computed(() => Array.from({ length: len.value }))
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

function press(d: string) {
  if (props.modelValue.length >= len.value) return
  const next = props.modelValue + d
  emit('update:modelValue', next)
  if (next.length === len.value) emit('complete', next)
}

function backspace() {
  if (!props.modelValue.length) return
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<template>
  <div class="flex flex-col items-center gap-8">
    <!-- Titik PIN -->
    <div class="flex gap-3" :class="{ 'pin-shake': error }">
      <span
        v-for="(_, i) in dots"
        :key="i"
        class="size-3.5 rounded-full border-2 transition-colors"
        :class="[
          error
            ? 'border-destructive bg-destructive'
            : i < modelValue.length
              ? 'border-primary bg-primary'
              : 'border-muted-foreground/40',
        ]"
      />
    </div>

    <!-- Keypad -->
    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="k in keys"
        :key="k"
        type="button"
        class="flex size-16 items-center justify-center rounded-full text-2xl font-semibold text-foreground transition active:scale-95 active:bg-accent"
        @click="press(k)"
      >
        {{ k }}
      </button>
      <span />
      <button
        type="button"
        class="flex size-16 items-center justify-center rounded-full text-2xl font-semibold text-foreground transition active:scale-95 active:bg-accent"
        @click="press('0')"
      >
        0
      </button>
      <button
        type="button"
        class="flex size-16 items-center justify-center rounded-full text-muted-foreground transition active:scale-95 active:bg-accent"
        aria-label="Hapus"
        @click="backspace"
      >
        <Delete class="size-6" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pin-shake {
  animation: shake 0.4s ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
</style>
