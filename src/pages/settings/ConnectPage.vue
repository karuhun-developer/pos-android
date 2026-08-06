<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, LogOut, Check, AlertCircle, Plus, Pencil } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { useAccountStore } from '@/stores/account'
import { useSyncStore } from '@/stores/sync'
import { ENV_GOOGLE_CLIENT_ID } from '@/services/api/config'

const account = useAccountStore()
const sync = useSyncStore()
const { isAuthenticated, user, stores, currentStoreId, status, error } =
  storeToRefs(account)
const { status: syncStatus, pending, lastError, lastSyncedAt } = storeToRefs(sync)

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const localError = ref('')
// Google native cuma jalan di aplikasi Android (butuh SHA-1 + OAuth client Android).
// Di web, sengaja dimatiin biar gak kena redirect_uri_mismatch — pakai email/password.
const isNative = Capacitor.isNativePlatform()
const hasGoogle = computed(() => !!ENV_GOOGLE_CLIENT_ID && isNative)

onMounted(() => {
  void sync.refreshPending()
})

function switchMode(m: 'login' | 'register') {
  mode.value = m
  localError.value = ''
  account.error = null
}

async function onSubmit() {
  localError.value = ''
  let ok = false
  if (mode.value === 'register') {
    if (!name.value.trim()) {
      localError.value = 'Nama wajib diisi.'
      return
    }
    if (password.value !== password2.value) {
      localError.value = 'Konfirmasi kata sandi tidak cocok.'
      return
    }
    ok = await account.registerEmail(name.value.trim(), email.value.trim(), password.value)
  } else {
    ok = await account.loginEmail(email.value.trim(), password.value)
  }
  if (ok) {
    password.value = ''
    password2.value = ''
    await sync.start()
    await sync.syncNow()
  }
}

async function onGoogleLogin() {
  if (await account.loginGoogle()) {
    await sync.start()
    await sync.syncNow()
  }
}

async function onLogout() {
  await sync.stop()
  await account.logout()
}

// Ganti outlet = destruktif (data lokal outlet lama di-reset) → wajib konfirmasi.
const pendingSwitch = ref<{ id: string; name: string } | null>(null)
const switching = ref(false)

function askSwitch(s: { id: string | number; name: string }) {
  pendingSwitch.value = { id: String(s.id), name: s.name }
}

async function confirmSwitch() {
  const target = pendingSwitch.value
  if (!target || switching.value) return
  switching.value = true
  try {
    await sync.syncNow() // 1. push perubahan outlet lama dulu (sebelum data lokal di-reset)
    await account.setCurrentStore(target.id) // 2. pindah outlet + buang data lokal outlet lama
    await sync.syncNow() // 3. tarik ulang data outlet baru dari nol
  } finally {
    switching.value = false
    pendingSwitch.value = null
  }
}

// --- Kelola outlet ---
const showAddStore = ref(false)
const newStoreName = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')

async function onAddStore() {
  if (!newStoreName.value.trim()) return
  await sync.syncNow() // flush data outlet aktif dulu — createStore pindah outlet & reset lokal
  if (await account.createStore(newStoreName.value.trim())) {
    newStoreName.value = ''
    showAddStore.value = false
    await sync.syncNow()
  }
}

function startRename(s: { id: string | number; name: string }) {
  editingId.value = String(s.id)
  editName.value = s.name
}

async function onRename(s: { id: string | number }) {
  if (!editName.value.trim()) return
  if (await account.renameStore(s.id, editName.value.trim())) editingId.value = null
}

const syncLabel = computed(() => {
  switch (syncStatus.value) {
    case 'syncing':
      return 'Menyinkronkan…'
    case 'idle':
      return 'Tersinkron'
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Gagal sync'
    default:
      return 'Nonaktif'
  }
})
</script>

<template>
  <div class="min-h-screen bg-background pb-10">
    <AppHeader title="Sambungkan ke POS Pro" subtitle="Login online & sync cloud" back />

    <div class="space-y-5 p-4">
      <!-- Belum login -->
      <template v-if="!isAuthenticated">
        <Card>
          <CardContent class="space-y-3 p-4">
            <!-- Toggle Masuk / Daftar -->
            <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                class="rounded-md py-1.5 text-sm font-medium transition"
                :class="mode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'"
                @click="switchMode('login')"
              >
                Masuk
              </button>
              <button
                type="button"
                class="rounded-md py-1.5 text-sm font-medium transition"
                :class="mode === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'"
                @click="switchMode('register')"
              >
                Daftar
              </button>
            </div>

            <div v-if="mode === 'register'" class="space-y-2">
              <Label for="name">Nama</Label>
              <Input id="name" v-model="name" placeholder="Nama kamu / toko" />
            </div>
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input id="email" v-model="email" type="email" placeholder="email@toko.com" />
            </div>
            <div class="space-y-2">
              <Label for="password">Kata sandi</Label>
              <Input id="password" v-model="password" type="password" placeholder="••••••" />
            </div>
            <div v-if="mode === 'register'" class="space-y-2">
              <Label for="password2">Ulangi kata sandi</Label>
              <Input id="password2" v-model="password2" type="password" placeholder="••••••" />
            </div>

            <p v-if="localError || error" class="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle class="size-3.5" /> {{ localError || error }}
            </p>

            <Button class="w-full" :disabled="status === 'loading'" @click="onSubmit">
              <Loader2 v-if="status === 'loading'" class="size-4 animate-spin" />
              {{ mode === 'register' ? 'Daftar & Masuk' : 'Masuk dengan Email' }}
            </Button>

            <div class="relative py-1 text-center">
              <span class="bg-background px-2 text-xs text-muted-foreground">atau</span>
            </div>

            <!-- Tombol Google sesuai brand guideline: putih, border tipis, logo G 4 warna -->
            <button
              type="button"
              class="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white font-medium text-[#3c4043] shadow-sm transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="status === 'loading' || !hasGoogle"
              @click="onGoogleLogin"
            >
              <Loader2 v-if="status === 'loading'" class="size-4 animate-spin" />
              <svg v-else class="size-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
              </svg>
              Masuk dengan Google
            </button>
            <p v-if="!hasGoogle" class="text-center text-xs text-muted-foreground">
              Masuk dengan Google hanya tersedia di aplikasi Android.
            </p>
          </CardContent>
        </Card>
      </template>

      <!-- Sudah login -->
      <template v-else>
        <Card class="border-primary/30 bg-primary/5">
          <CardContent class="space-y-1 p-4">
            <div class="flex items-center gap-2">
              <Check class="size-4 text-success" />
              <p class="text-sm font-semibold">{{ user?.name }}</p>
            </div>
            <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
          </CardContent>
        </Card>

        <!-- Outlet: pilih aktif, tambah, ganti nama -->
        <section v-if="stores.length" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Outlet</Label>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 text-primary"
              @click="showAddStore = !showAddStore"
            >
              <Plus class="size-4" /> Tambah
            </Button>
          </div>

          <!-- Form tambah outlet -->
          <div v-if="showAddStore" class="flex items-center gap-2">
            <Input
              v-model="newStoreName"
              placeholder="Nama outlet baru"
              @keyup.enter="onAddStore"
            />
            <Button
              size="sm"
              :disabled="status === 'loading' || !newStoreName.trim()"
              @click="onAddStore"
            >
              Simpan
            </Button>
          </div>

          <div class="space-y-2">
            <div
              v-for="s in stores"
              :key="String(s.id)"
              class="flex items-center gap-2 rounded-lg border p-3 text-sm"
              :class="
                String(s.id) === currentStoreId ? 'border-primary bg-primary/10' : 'border-border'
              "
            >
              <!-- Mode ganti nama -->
              <template v-if="editingId === String(s.id)">
                <Input v-model="editName" class="h-8 flex-1" @keyup.enter="onRename(s)" />
                <Button size="sm" class="h-8" @click="onRename(s)">OK</Button>
                <Button size="sm" variant="ghost" class="h-8" @click="editingId = null">
                  Batal
                </Button>
              </template>

              <!-- Mode normal -->
              <template v-else>
                <div class="flex min-w-0 flex-1 items-center gap-2">
                  <span class="truncate font-medium">{{ s.name }}</span>
                  <Badge variant="secondary">{{ s.role }}</Badge>
                  <Badge
                    v-if="String(s.id) === currentStoreId"
                    class="bg-primary/15 text-primary hover:bg-primary/15"
                  >
                    Aktif
                  </Badge>
                </div>
                <Button
                  v-if="String(s.id) !== currentStoreId"
                  size="sm"
                  variant="outline"
                  class="h-8"
                  @click="askSwitch(s)"
                >
                  Ganti
                </Button>
                <button
                  v-if="s.role === 'owner'"
                  class="text-muted-foreground transition active:text-foreground"
                  aria-label="Ganti nama outlet"
                  @click="startRename(s)"
                >
                  <Pencil class="size-4" />
                </button>
              </template>
            </div>
          </div>
        </section>

        <!-- Konfirmasi ganti outlet (destruktif: reset data lokal) -->
        <BottomSheet
          :open="!!pendingSwitch"
          title="Ganti outlet?"
          @update:open="(v: boolean) => { if (!v && !switching) pendingSwitch = null }"
        >
          <div class="space-y-4 p-5">
            <p class="text-sm text-muted-foreground">
              Pindah ke
              <span class="font-semibold text-foreground">{{ pendingSwitch?.name }}</span>?
              Data outlet saat ini akan dibersihkan dari perangkat lalu diganti data
              outlet tujuan. Perubahan yang belum tersinkron dikirim dulu — data di
              server tetap aman.
            </p>
            <div class="flex gap-2">
              <Button
                variant="outline"
                class="flex-1"
                :disabled="switching"
                @click="pendingSwitch = null"
              >
                Batal
              </Button>
              <Button class="flex-1" :disabled="switching" @click="confirmSwitch">
                <Loader2 v-if="switching" class="size-4 animate-spin" />
                Ya, ganti
              </Button>
            </div>
          </div>
        </BottomSheet>

        <!-- Status sync -->
        <Card>
          <CardContent class="space-y-3 p-4">
            <div class="flex items-center justify-between text-sm">
              <span class="font-semibold">Sinkronisasi</span>
              <Badge :variant="syncStatus === 'error' ? 'destructive' : 'secondary'">
                {{ syncLabel }}
              </Badge>
            </div>
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>Antre belum terkirim</span>
              <span>{{ pending }}</span>
            </div>
            <p v-if="lastSyncedAt" class="text-xs text-muted-foreground">
              Terakhir sync: {{ new Date(lastSyncedAt).toLocaleString('id-ID') }}
            </p>
            <p v-if="lastError" class="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle class="size-3.5" /> {{ lastError }}
            </p>
            <Button
              class="w-full"
              :disabled="syncStatus === 'syncing'"
              @click="sync.syncNow()"
            >
              <RefreshCw class="size-4" :class="syncStatus === 'syncing' && 'animate-spin'" />
              Sync sekarang
            </Button>
          </CardContent>
        </Card>

        <Button variant="outline" class="w-full text-destructive" @click="onLogout">
          <LogOut class="size-4" /> Keluar
        </Button>
      </template>
    </div>
  </div>
</template>
