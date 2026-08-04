<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/layout/AppHeader.vue'
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

async function onPickStore(id: string) {
  await account.setCurrentStore(id)
  await sync.syncNow()
}

// --- Kelola outlet ---
const showAddStore = ref(false)
const newStoreName = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')

async function onAddStore() {
  if (!newStoreName.value.trim()) return
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

            <Button
              variant="outline"
              class="w-full"
              :disabled="status === 'loading' || !hasGoogle"
              @click="onGoogleLogin"
            >
              Masuk dengan Google
            </Button>
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
                <button
                  class="flex flex-1 items-center gap-2 text-left"
                  @click="onPickStore(String(s.id))"
                >
                  <span class="font-medium">{{ s.name }}</span>
                  <Badge variant="secondary">{{ s.role }}</Badge>
                </button>
                <Check v-if="String(s.id) === currentStoreId" class="size-4 text-primary" />
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
