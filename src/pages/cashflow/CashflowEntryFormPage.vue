<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import MoneyInput from '@/components/common/MoneyInput.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-vue-next'
import { useCashflowStore } from '@/stores/cashflow'
import { useCashierStore } from '@/stores/cashier'
import { cn } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const cashflow = useCashflowStore()
const cashier = useCashierStore()

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)

const type = ref<'income' | 'expense'>('expense')
const categoryId = ref<string>('')
const amount = ref(0)
const note = ref('')
const saving = ref(false)

const cats = computed(() => cashflow.categoriesOfType(type.value))
const canSave = computed(() => !!categoryId.value && amount.value > 0 && !saving.value)

onMounted(async () => {
  await Promise.all([cashflow.load(), cashier.load()])
  if (isEdit.value) {
    const e = cashflow.entries.find((x) => x.id === id.value)
    if (!e || e.source !== 'manual') {
      router.replace('/cashflow') // entri penjualan tidak bisa diedit
      return
    }
    type.value = e.direction === 'debit' ? 'income' : 'expense'
    categoryId.value = e.category_id ?? ''
    amount.value = e.amount
    note.value = e.note ?? ''
  } else {
    // Default kategori pertama sesuai tipe.
    categoryId.value = cats.value[0]?.id ?? ''
  }
})

function setType(t: 'income' | 'expense') {
  if (type.value === t) return
  type.value = t
  // Reset kategori ke pilihan pertama tipe baru.
  categoryId.value = cats.value[0]?.id ?? ''
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    if (isEdit.value && id.value) {
      await cashflow.updateEntry(id.value, {
        categoryId: categoryId.value,
        amount: amount.value,
        note: note.value,
      })
    } else {
      await cashflow.createEntry({
        categoryId: categoryId.value,
        amount: amount.value,
        note: note.value,
        sessionId: cashier.current?.id ?? null,
      })
    }
    router.back()
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!id.value) return
  if (!confirm('Hapus catatan kas ini?')) return
  await cashflow.deleteEntry(id.value)
  router.back()
}
</script>

<template>
  <div>
    <AppHeader :title="isEdit ? 'Edit Kas' : 'Tambah Kas'" back />

    <div class="space-y-5 p-4">
      <!-- Jenis -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition"
          :class="cn(type === 'income' ? 'border-success bg-success/5 text-success' : 'border-border text-muted-foreground')"
          @click="setType('income')"
        >
          <ArrowDownLeft class="size-4" /> Pemasukan
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition"
          :class="cn(type === 'expense' ? 'border-destructive bg-destructive/5 text-destructive' : 'border-border text-muted-foreground')"
          @click="setType('expense')"
        >
          <ArrowUpRight class="size-4" /> Pengeluaran
        </button>
      </div>

      <!-- Kategori -->
      <div class="space-y-1.5">
        <Label>Kategori</Label>
        <div v-if="cats.length" class="flex flex-wrap gap-2">
          <button
            v-for="c in cats"
            :key="c.id"
            type="button"
            class="rounded-full border px-3 py-1.5 text-sm transition"
            :class="cn(categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground')"
            @click="categoryId = c.id"
          >
            {{ c.name }}
          </button>
        </div>
        <p v-else class="text-xs text-muted-foreground">
          Belum ada kategori {{ type === 'income' ? 'pemasukan' : 'pengeluaran' }}.
          <RouterLink to="/cashflow/categories" class="text-primary underline">Tambah dulu</RouterLink>.
        </p>
      </div>

      <!-- Nominal -->
      <div class="space-y-1.5">
        <Label for="amount">Nominal</Label>
        <MoneyInput id="amount" v-model="amount" class="h-12 text-lg font-semibold" />
      </div>

      <!-- Catatan -->
      <div class="space-y-1.5">
        <Label for="note">Catatan (opsional)</Label>
        <Input id="note" v-model="note" placeholder="mis. beli gas, bayar listrik" />
      </div>

      <Button class="h-12 w-full text-base" :disabled="!canSave" @click="save">
        {{ saving ? 'Menyimpan…' : 'Simpan' }}
      </Button>

      <Button
        v-if="isEdit"
        variant="ghost"
        class="w-full gap-2 text-destructive"
        @click="remove"
      >
        <Trash2 class="size-4" /> Hapus Catatan
      </Button>
    </div>
  </div>
</template>
