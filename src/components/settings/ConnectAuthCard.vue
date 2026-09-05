<script setup lang="ts">
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuthMode = 'login' | 'register'

defineProps<{
  readonly mode: AuthMode
  readonly name: string
  readonly email: string
  readonly password: string
  readonly password2: string
  readonly loading: boolean
  readonly status: 'idle' | 'loading'
  readonly localError: string
  readonly accountError: string | null
  readonly hasGoogle: boolean
}>()

const emit = defineEmits<{
  'update:mode': [value: AuthMode]
  'update:name': [value: string]
  'update:email': [value: string]
  'update:password': [value: string]
  'update:password2': [value: string]
  submit: []
  'google-login': []
}>()
</script>

<template>
  <Card>
    <CardContent class="space-y-3 p-4">
      <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button type="button" class="rounded-md py-1.5 text-sm font-medium transition" :class="mode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'" @click="emit('update:mode', 'login')">Masuk</button>
        <button type="button" class="rounded-md py-1.5 text-sm font-medium transition" :class="mode === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'" @click="emit('update:mode', 'register')">Daftar</button>
      </div>

      <div v-if="mode === 'register'" class="space-y-2">
        <Label for="name">Nama</Label>
        <Input id="name" :model-value="name" placeholder="Nama kamu / toko" @update:model-value="emit('update:name', String($event))" />
      </div>
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input id="email" :model-value="email" type="email" placeholder="email@toko.com" @update:model-value="emit('update:email', String($event))" />
      </div>
      <div class="space-y-2">
        <Label for="password">Kata sandi</Label>
        <Input id="password" :model-value="password" type="password" placeholder="••••••" @update:model-value="emit('update:password', String($event))" />
      </div>
      <div v-if="mode === 'register'" class="space-y-2">
        <Label for="password2">Ulangi kata sandi</Label>
        <Input id="password2" :model-value="password2" type="password" placeholder="••••••" @update:model-value="emit('update:password2', String($event))" />
      </div>

      <p v-if="localError || accountError" class="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle class="size-3.5" /> {{ localError || accountError }}</p>
      <Button class="w-full" :disabled="loading" @click="emit('submit')">
        <Loader2 v-if="status === 'loading'" class="size-4 animate-spin" />
        {{ mode === 'register' ? 'Daftar & Masuk' : 'Masuk dengan Email' }}
      </Button>
      <div class="relative py-1 text-center"><span class="bg-background px-2 text-xs text-muted-foreground">atau</span></div>
      <button type="button" class="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white font-medium text-[#3c4043] shadow-sm transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60" :disabled="loading || !hasGoogle" @click="emit('google-login')">
        <Loader2 v-if="status === 'loading'" class="size-4 animate-spin" />
        <svg v-else class="size-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
          <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
          <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
          <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
        </svg>
        Masuk dengan Google
      </button>
      <p v-if="!hasGoogle" class="text-center text-xs text-muted-foreground">Masuk dengan Google hanya tersedia di <span class="whitespace-nowrap">aplikasi Android.</span></p>
    </CardContent>
  </Card>
</template>
