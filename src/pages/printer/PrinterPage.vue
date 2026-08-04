<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, CheckCircle2, XCircle } from 'lucide-vue-next'
import { capabilities } from '@/services/capabilities/registry'
import type { PrinterCapability } from '@/services/capabilities/registry'
import { formatDateTime, nowMs } from '@/lib/datetime'

const available = ref(false)
const printer = ref<PrinterCapability | null>(null)

onMounted(async () => {
  printer.value = capabilities.get<PrinterCapability>('printer')
  available.value = await capabilities.has('printer')
})

async function testPrint() {
  if (!printer.value) return
  await printer.value.print({
    title: 'Test Print',
    lines: [
      { text: 'POS KACAW', align: 'center', bold: true, size: 'large' },
      { text: 'Struk Percobaan', align: 'center' },
      { text: '', align: 'center' },
      { text: formatDateTime(nowMs()), align: 'center' },
      { text: '--------------------------------', align: 'center' },
      { text: 'Printer berfungsi ✔', align: 'center' },
    ],
  })
}
</script>

<template>
  <div>
    <AppHeader title="Printer" />
    <div class="space-y-4 p-4">
      <Card>
        <CardContent class="flex items-center gap-3 p-4">
          <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Printer class="size-5" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold">Preview Web Printer</p>
            <p class="text-xs text-muted-foreground">Cetak via dialog browser</p>
          </div>
          <Badge :variant="available ? 'success' : 'secondary'" class="gap-1">
            <CheckCircle2 v-if="available" class="size-3" />
            <XCircle v-else class="size-3" />
            {{ available ? 'Aktif' : 'Nonaktif' }}
          </Badge>
        </CardContent>
      </Card>

      <Button class="w-full" size="lg" :disabled="!available" @click="testPrint">
        Test Print Struk
      </Button>

      <p class="px-1 text-xs text-muted-foreground">
        Plugin printer thermal (Bluetooth/USB) bisa dipasang nanti tanpa mengubah
        aplikasi inti — cukup daftarkan di registry capability.
      </p>
    </div>
  </div>
</template>
