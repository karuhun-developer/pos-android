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
import {
  Store, Lock, Moon, Cloud, Smartphone, Save, ImagePlus, Sparkles, Check,
} from 'lucide-vue-next'
import { useSettingsStore, type SplashBg } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'
import { pickImage, downscale } from '@/lib/image'

const settings = useSettingsStore()
const media = useMediaStore()
const { storeName, storeOwner, storeLogo, loginEnabled, theme, deviceId,
  splashEnabled, splashBg } = storeToRefs(settings)

const name = ref('')
const owner = ref('')
const savingProfile = ref(false)
const savedFlash = ref(false)
const logoBusy = ref(false)

const SPLASH_BGS: Array<{ id: SplashBg; label: string; swatch: string }> = [
  { id: 'brand', label: 'Brand', swatch: 'bg-gradient-to-b from-primary to-primary/70' },
  { id: 'light', label: 'Terang', swatch: 'bg-background border border-border' },
  { id: 'dark', label: 'Gelap', swatch: 'bg-slate-900' },
]

onMounted(() => {
  name.value = storeName.value
  owner.value = storeOwner.value
  if (storeLogo.value) media.ensure([storeLogo.value])
})

async function chooseLogo() {
  const dataUrl = await pickImage()
  if (!dataUrl) return
  logoBusy.value = true
  try {
    // PNG biar transparansi logo kejaga; ukuran kecil (256px).
    const img = await downscale(dataUrl, { maxDim: 256, mime: 'image/png' })
    const ref_ = await media.save(img)
    await settings.setLogo(ref_) // langsung ke-update di Home & splash
  } finally {
    logoBusy.value = false
  }
}

async function removeLogo() {
  await settings.setLogo(null)
}

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
            <!-- Logo toko -->
            <div class="flex items-center gap-4">
              <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
                <img
                  v-if="media.url(storeLogo)"
                  :src="media.url(storeLogo)!"
                  alt="Logo toko"
                  class="size-full object-contain p-1"
                />
                <Store v-else class="size-6" />
              </div>
              <div class="space-y-1.5">
                <p class="text-sm font-medium">Logo Toko</p>
                <p class="text-xs text-muted-foreground">Tampil di home & splash screen.</p>
                <div class="flex items-center gap-2 pt-0.5">
                  <Button type="button" variant="outline" size="sm" class="gap-1.5" :disabled="logoBusy" @click="chooseLogo">
                    <ImagePlus class="size-3.5" />
                    {{ media.url(storeLogo) ? 'Ganti' : 'Tambah' }}
                  </Button>
                  <Button v-if="media.url(storeLogo)" type="button" variant="ghost" size="sm" class="text-destructive" @click="removeLogo">
                    Hapus
                  </Button>
                </div>
              </div>
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

      <!-- Tampilan / Splash -->
      <section class="space-y-3">
        <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Splash Screen
        </p>
        <Card>
          <CardContent class="space-y-4 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Sparkles class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Tampilkan Splash</p>
                <p class="text-xs text-muted-foreground">Layar pembuka logo saat app dibuka.</p>
              </div>
              <Switch :model-value="splashEnabled" @update:model-value="settings.setSplash({ enabled: $event })" />
            </div>

            <div v-if="splashEnabled" class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">Latar</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="bg in SPLASH_BGS"
                  :key="bg.id"
                  type="button"
                  class="relative overflow-hidden rounded-xl border p-1 transition"
                  :class="splashBg === bg.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'"
                  @click="settings.setSplash({ bg: bg.id })"
                >
                  <span class="flex h-12 items-center justify-center rounded-lg" :class="bg.swatch">
                    <Check v-if="splashBg === bg.id" class="size-4 text-white drop-shadow" />
                  </span>
                  <span class="mt-1 block text-center text-xs">{{ bg.label }}</span>
                </button>
              </div>
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
