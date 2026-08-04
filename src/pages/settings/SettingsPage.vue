<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import BottomSheet from '@/components/common/BottomSheet.vue'
import PinPad from '@/components/common/PinPad.vue'
import {
  Store, Lock, Moon, Cloud, Smartphone, Save, ImagePlus, Sparkles, Check,
  QrCode, Loader2, KeyRound, LockKeyhole,
} from 'lucide-vue-next'
import { useSettingsStore, type SplashBg } from '@/stores/settings'
import { useMediaStore } from '@/stores/media'
import { useAuthStore } from '@/stores/auth'
import { useAccountStore } from '@/stores/account'
import { pickImage, downscale } from '@/lib/image'
import { decodeQrFromDataUrl, encodeQrToDataUrl, isValidQris } from '@/lib/qris'

const settings = useSettingsStore()
const media = useMediaStore()
const auth = useAuthStore()
const account = useAccountStore()
const router = useRouter()
const { storeName, storeOwner, storeLogo, loginEnabled, hasPin, theme, devicePrefix,
  splashEnabled, splashBg, qrisPayload, qrisDynamic } = storeToRefs(settings)

const name = ref('')
const owner = ref('')
const savingProfile = ref(false)
const savedFlash = ref(false)
const logoBusy = ref(false)
const qrisBusy = ref(false)
const qrisError = ref('')
const qrisPreview = ref<string | null>(null)

const SPLASH_BGS: Array<{ id: SplashBg; label: string; swatch: string }> = [
  { id: 'brand', label: 'Brand', swatch: 'bg-gradient-to-b from-primary to-primary/70' },
  { id: 'light', label: 'Terang', swatch: 'bg-background border border-border' },
  { id: 'dark', label: 'Gelap', swatch: 'bg-slate-900' },
]

onMounted(async () => {
  name.value = storeName.value
  owner.value = storeOwner.value
  if (storeLogo.value) media.ensure([storeLogo.value])
  await renderQrisPreview()
})

async function renderQrisPreview() {
  qrisPreview.value = qrisPayload.value ? await encodeQrToDataUrl(qrisPayload.value) : null
}

async function chooseQris() {
  const dataUrl = await pickImage()
  if (!dataUrl) return
  qrisBusy.value = true
  qrisError.value = ''
  try {
    const payload = await decodeQrFromDataUrl(dataUrl)
    if (!payload) {
      qrisError.value = 'QR tidak terbaca. Coba gambar QRIS yang lebih jelas/besar.'
      return
    }
    if (!isValidQris(payload)) {
      qrisError.value = 'Gambar ini sepertinya bukan QRIS statis yang valid.'
      return
    }
    await settings.setQris(payload)
    await renderQrisPreview()
  } finally {
    qrisBusy.value = false
  }
}

async function removeQris() {
  await settings.setQris(null)
  qrisPreview.value = null
  qrisError.value = ''
}

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

// --- Kunci PIN (Phase 5) ---
const pinSheetOpen = ref(false)
const pinMode = ref<'set' | 'change'>('set') // 'set' = sekalian aktifkan login
const pinStep = ref<'enter' | 'confirm'>('enter')
const pinValue = ref('')
const pinFirst = ref('')
const pinError = ref(false)

const PIN_LEN = 6

function openPinSheet(mode: 'set' | 'change') {
  pinMode.value = mode
  pinStep.value = 'enter'
  pinValue.value = ''
  pinFirst.value = ''
  pinError.value = false
  pinSheetOpen.value = true
}

async function onToggleLogin(v: boolean) {
  if (v) {
    // Nyalakan login butuh PIN dulu — login baru aktif setelah PIN dibuat.
    if (hasPin.value) await settings.setLoginEnabled(true)
    else openPinSheet('set')
  } else {
    await auth.disableLogin() // matikan + bersihkan PIN
  }
}

async function onPinComplete(value: string) {
  if (pinStep.value === 'enter') {
    pinFirst.value = value
    pinValue.value = ''
    pinStep.value = 'confirm'
    return
  }
  // Tahap konfirmasi.
  if (value !== pinFirst.value) {
    pinError.value = true
    setTimeout(() => {
      pinValue.value = ''
      pinFirst.value = ''
      pinStep.value = 'enter'
      pinError.value = false
    }, 600)
    return
  }
  await auth.setPin(value)
  if (pinMode.value === 'set') await auth.enableLogin()
  pinSheetOpen.value = false
}

function lockNow() {
  auth.lock()
  router.push('/lock')
}
</script>

<template>
  <div>
    <AppHeader title="Akun & Setelan" />
    <div class="space-y-5 p-4">
      <!-- POS Pro / Cloud (paling atas) -->
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
              <Badge :variant="account.isAuthenticated ? 'success' : 'secondary'">
                {{ account.isAuthenticated ? 'Terhubung' : 'Belum' }}
              </Badge>
            </div>
            <Button variant="outline" class="w-full" @click="router.push('/connect')">
              {{ account.isAuthenticated ? 'Kelola Koneksi' : 'Sambungkan Akun' }}
            </Button>
          </CardContent>
        </Card>
      </section>

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

      <!-- Pembayaran QRIS -->
      <section class="space-y-3">
        <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pembayaran QRIS
        </p>
        <Card>
          <CardContent class="space-y-4 p-4">
            <!-- Upload QRIS statis -->
            <div class="flex items-center gap-4">
              <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white text-muted-foreground">
                <img v-if="qrisPreview" :src="qrisPreview" alt="QRIS" class="size-full object-contain p-0.5" />
                <QrCode v-else class="size-6" />
              </div>
              <div class="min-w-0 flex-1 space-y-1.5">
                <p class="text-sm font-medium">QRIS Statis Toko</p>
                <p class="text-xs text-muted-foreground">
                  Upload gambar QRIS toko sekali. Dipakai untuk menerima pembayaran.
                </p>
                <div class="flex items-center gap-2 pt-0.5">
                  <Button type="button" variant="outline" size="sm" class="gap-1.5" :disabled="qrisBusy" @click="chooseQris">
                    <Loader2 v-if="qrisBusy" class="size-3.5 animate-spin" />
                    <ImagePlus v-else class="size-3.5" />
                    {{ qrisPayload ? 'Ganti' : 'Upload QRIS' }}
                  </Button>
                  <Button v-if="qrisPayload" type="button" variant="ghost" size="sm" class="text-destructive" @click="removeQris">
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
            <p v-if="qrisError" class="text-xs text-destructive">{{ qrisError }}</p>

            <!-- Toggle dinamis -->
            <div class="flex items-start gap-3 border-t border-border pt-4">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <QrCode class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">QRIS Dinamis</p>
                <p class="text-xs text-muted-foreground">
                  Saat pembeli bayar pakai QRIS, nominal tagihan otomatis dimasukkan ke
                  kode QR — pembeli scan langsung dengan jumlah pas, tanpa ketik manual.
                </p>
              </div>
              <Switch
                :model-value="qrisDynamic"
                :disabled="!qrisPayload"
                @update:model-value="settings.setQrisDynamic($event)"
              />
            </div>
            <p v-if="!qrisPayload" class="text-xs text-muted-foreground">
              Upload QRIS statis dulu untuk mengaktifkan mode dinamis.
            </p>
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
                  Default nonaktif. Kunci app dengan PIN 6 digit.
                </p>
              </div>
              <Switch :model-value="loginEnabled" @update:model-value="onToggleLogin" />
            </div>
            <button
              v-if="loginEnabled && hasPin"
              type="button"
              class="flex w-full items-center gap-3 p-4 text-left transition active:bg-accent"
              @click="openPinSheet('change')"
            >
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <KeyRound class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Ubah PIN</p>
                <p class="text-xs text-muted-foreground">Ganti PIN 6 digit</p>
              </div>
            </button>
            <button
              v-if="loginEnabled && hasPin"
              type="button"
              class="flex w-full items-center gap-3 p-4 text-left transition active:bg-accent"
              @click="lockNow"
            >
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <LockKeyhole class="size-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Kunci Sekarang</p>
                <p class="text-xs text-muted-foreground">Kembali ke layar PIN</p>
              </div>
            </button>
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

      <!-- Info perangkat -->
      <div class="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
        <Smartphone class="size-3.5" />
        Device: {{ devicePrefix }} · POS Kacaw v0.1
      </div>
    </div>

    <!-- Sheet buat/ubah PIN -->
    <BottomSheet
      :open="pinSheetOpen"
      :title="pinMode === 'change' ? 'Ubah PIN' : 'Buat PIN'"
      @update:open="pinSheetOpen = $event"
    >
      <div class="flex flex-col items-center gap-8 px-5 pb-8 pt-4">
        <p class="text-sm text-muted-foreground">
          {{ pinError ? 'PIN tidak cocok, ulangi' : pinStep === 'enter' ? 'Masukkan PIN 6 digit baru' : 'Ulangi PIN untuk konfirmasi' }}
        </p>
        <PinPad
          v-model="pinValue"
          :length="PIN_LEN"
          :error="pinError"
          @complete="onPinComplete"
        />
      </div>
    </BottomSheet>
  </div>
</template>
