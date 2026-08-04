<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Plus, Trash2, Check, Pencil, ArrowDownLeft, ArrowUpRight, Lock,
} from 'lucide-vue-next'
import { useCashflowStore } from '@/stores/cashflow'
import { cn } from '@/lib/utils'
import type { CashflowCategory } from '@/db/types'

const cashflow = useCashflowStore()
const { categories } = storeToRefs(cashflow)

const newName = ref('')
const newType = ref<'income' | 'expense'>('expense')
const editingId = ref<string | null>(null)
const editName = ref('')

const income = computed(() => categories.value.filter((c) => c.type === 'income'))
const expense = computed(() => categories.value.filter((c) => c.type === 'expense'))

onMounted(() => cashflow.load())

async function add() {
  const name = newName.value.trim()
  if (!name) return
  await cashflow.createCategory(name, newType.value)
  newName.value = ''
}

function startEdit(id: string, name: string) {
  editingId.value = id
  editName.value = name
}

async function saveEdit() {
  if (editingId.value && editName.value.trim()) {
    await cashflow.renameCategory(editingId.value, editName.value.trim())
  }
  editingId.value = null
}

async function remove(c: CashflowCategory) {
  if (c.is_system) return
  if (!confirm(`Hapus kategori "${c.name}"? Catatan lama tetap tersimpan.`)) return
  await cashflow.removeCategory(c.id)
}
</script>

<template>
  <div>
    <AppHeader title="Kategori Cashflow" back />

    <!-- Form tambah -->
    <div class="space-y-3 border-b border-border p-4">
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition"
          :class="cn(newType === 'income' ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600' : 'border-border text-muted-foreground')"
          @click="newType = 'income'"
        >
          <ArrowDownLeft class="size-4" /> Pemasukan
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition"
          :class="cn(newType === 'expense' ? 'border-rose-500 bg-rose-500/5 text-rose-600' : 'border-border text-muted-foreground')"
          @click="newType = 'expense'"
        >
          <ArrowUpRight class="size-4" /> Pengeluaran
        </button>
      </div>
      <div class="flex gap-2">
        <Input v-model="newName" placeholder="Nama kategori baru" @keyup.enter="add" />
        <Button class="shrink-0 gap-1" :disabled="!newName.trim()" @click="add">
          <Plus class="size-4" /> Tambah
        </Button>
      </div>
    </div>

    <!-- Daftar per tipe -->
    <template v-for="section in [
      { key: 'income', label: 'Pemasukan', rows: income, icon: ArrowDownLeft, tint: 'bg-emerald-500/10 text-emerald-600' },
      { key: 'expense', label: 'Pengeluaran', rows: expense, icon: ArrowUpRight, tint: 'bg-rose-500/10 text-rose-600' },
    ]" :key="section.key">
      <p class="bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {{ section.label }}
      </p>
      <div class="divide-y divide-border">
        <div v-for="c in section.rows" :key="c.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="section.tint">
            <component :is="section.icon" class="size-4" />
          </div>
          <template v-if="editingId === c.id">
            <Input v-model="editName" class="flex-1" @keyup.enter="saveEdit" />
            <Button size="icon" variant="ghost" @click="saveEdit">
              <Check class="size-5 text-primary" />
            </Button>
          </template>
          <template v-else>
            <span class="flex-1 text-sm font-medium">{{ c.name }}</span>
            <Lock v-if="c.is_system" class="size-4 text-muted-foreground" />
            <template v-else>
              <Button size="icon" variant="ghost" @click="startEdit(c.id, c.name)">
                <Pencil class="size-4 text-muted-foreground" />
              </Button>
              <Button size="icon" variant="ghost" @click="remove(c)">
                <Trash2 class="size-4 text-destructive" />
              </Button>
            </template>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
