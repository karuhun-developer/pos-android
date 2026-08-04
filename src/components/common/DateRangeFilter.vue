<script setup lang="ts">
import { ref } from 'vue'
import {
  presetRange,
  customRange,
  PRESET_LABEL,
  type DateRange,
  type RangePreset,
} from '@/lib/dateRange'
import { dayKey } from '@/lib/datetime'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const props = defineProps<{ modelValue: DateRange }>()
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['today', 'yesterday', 'week', 'month']

const showCustom = ref(props.modelValue.preset === 'custom')
const fromDay = ref(dayKey(props.modelValue.from))
const toDay = ref(dayKey(props.modelValue.to))

function pick(key: Exclude<RangePreset, 'custom'>) {
  showCustom.value = false
  emit('update:modelValue', presetRange(key))
}

function toggleCustom() {
  showCustom.value = !showCustom.value
  if (showCustom.value) {
    fromDay.value = dayKey(props.modelValue.from)
    toDay.value = dayKey(props.modelValue.to)
  }
}

function applyCustom() {
  if (!fromDay.value || !toDay.value) return
  let f = fromDay.value
  let t = toDay.value
  if (f > t) [f, t] = [t, f] // toleran kalau kebalik
  emit('update:modelValue', customRange(f, t))
}
</script>

<template>
  <div class="border-b border-border bg-background px-3 py-2">
    <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      <button
        v-for="p in PRESETS"
        :key="p"
        type="button"
        class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
        :class="
          modelValue.preset === p
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground active:bg-accent'
        "
        @click="pick(p)"
      >
        {{ PRESET_LABEL[p] }}
      </button>
      <button
        type="button"
        class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition"
        :class="
          showCustom || modelValue.preset === 'custom'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground active:bg-accent'
        "
        @click="toggleCustom"
      >
        Kustom
      </button>
    </div>

    <div v-if="showCustom" class="mt-2 flex items-end gap-2">
      <div class="flex-1 space-y-1">
        <label class="text-[11px] text-muted-foreground">Dari</label>
        <Input v-model="fromDay" type="date" class="h-9" />
      </div>
      <div class="flex-1 space-y-1">
        <label class="text-[11px] text-muted-foreground">Sampai</label>
        <Input v-model="toDay" type="date" class="h-9" />
      </div>
      <Button size="sm" class="h-9" :disabled="!fromDay || !toDay" @click="applyCustom">
        Terapkan
      </Button>
    </div>
  </div>
</template>
