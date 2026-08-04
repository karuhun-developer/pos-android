<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Store, Lock, Moon, Cloud, Smartphone, Save } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { storeName, storeOwner, loginEnabled, theme, deviceId } =
  storeToRefs(settings)

const name = ref('')
const owner = ref('')
const savingProfile = ref(false)
const savedFlash = ref(false)

onMounted(() => {
  name.value = storeName.value
  owner.value = storeOwner.value
})

async function saveProfile() {
  savingProfile.value = true
  await settings.setProfile(name.value.trim() || 'POS Kacaw', owner.value.trim())
  savingProfile.value = false
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1500)
}

async function onToggleLogin(v: boolean) {
  await settings.setLoginEnabled(v)
}
</script>

<template>
  <div>
    <AppHeader title="Akun & Setelan" />
    <div class="space-y-5 p-4">
      <!-- Profil toko -->
      <section class="space-y-3">
        <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Profil Toko
        </p>
        <Card>
          <CardContent class="space-y-4 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store class="size-5" />
              </div>
              <p class="text-sm text-muted-foreground">
                Nama ini tampil di header & struk.
              </p>
            </div>
            <div class="space-y-1.5">
              <Label for="store-name">Nama Toko</Label>
              <Input id="store-name" v-model="name" placeholder="POS Kacaw" />
            </div>
            <div class="space-y-1.5">
              <Label for="store-owner">Pemilik</Label>
              <Input id="store-owner" v-model="owner" placeholder="Nama pemilik" />
            </div>
            <Button class="w-full gap-2" :disabled="savingProfile" @click="saveProfile">
              <Save class="size-4" />
              {{ savedFlash ? 'Tersimpan!' : 'Simpan Profil' }}
            </Button>
          </CardContent>
        </Card>
      </section>

      <!-- Keamanan -->
      <section class="space-y-3">
        <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Keamanan
        </p>
        <Card>
          <CardContent class="divide-y divide-border p-0">
            <div class="flex items-center gap-3 p-4">
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Lock class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Aktifkan Login</p>
                <p class="text-xs text-muted-foreground">
                  Default nonaktif. Kunci app dengan PIN (Phase 5).
                </p>
              </div>
              <Switch :model-value="loginEnabled" @update:model-value="onToggleLogin" />
            </div>
            <div class="flex items-center gap-3 p-4">
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Moon class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Mode Gelap</p>
                <p class="text-xs text-muted-foreground">Tampilan gelap</p>
              </div>
              <Switch :model-value="theme === 'dark'" @update:model-value="settings.toggleTheme()" />
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- POS Pro (future) -->
      <section class="space-y-3">
        <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cloud
        </p>
        <Card class="border-primary/30 bg-primary/5">
          <CardContent class="space-y-3 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Cloud class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold">POS Pro</p>
                <p class="text-xs text-muted-foreground">
                  Login online, backup & sync data ke cloud
                </p>
              </div>
              <Badge variant="secondary">Segera</Badge>
            </div>
            <Button variant="outline" class="w-full" disabled>
              Sambungkan Akun
            </Button>
          </CardContent>
        </Card>
      </section>

      <!-- Info perangkat -->
      <div class="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
        <Smartphone class="size-3.5" />
        Device ID: {{ deviceId }} · POS Kacaw v0.1
      </div>
    </div>
  </div>
</template>
