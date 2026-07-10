<script setup lang="ts">
import { ref } from 'vue'
import { KeyRound, Link, LogIn, UserPlus } from 'lucide-vue-next'
import { isSupabaseConfigured, supabase, supabaseConfigurationError } from '../services/supabaseClient'

type AuthMode = 'sign-in' | 'sign-up' | 'magic-link'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const mode = ref<AuthMode>('sign-in')
const isSubmitting = ref(false)
const message = ref('')
const errorMessage = ref('')

function setMode(nextMode: AuthMode): void {
  mode.value = nextMode
  message.value = ''
  errorMessage.value = ''
}

async function submitAuth(): Promise<void> {
  if (mode.value === 'magic-link') {
    await sendMagicLink()
    return
  }

  await submitPasswordAuth()
}

async function submitPasswordAuth(): Promise<void> {
  const nextEmail = email.value.trim()
  const nextPassword = password.value

  if (!validateBaseInput(nextEmail)) return

  if (!nextPassword) {
    errorMessage.value = '请输入密码。'
    return
  }

  if (mode.value === 'sign-up' && nextPassword.length < 8) {
    errorMessage.value = '密码至少需要 8 位。'
    return
  }

  if (mode.value === 'sign-up' && nextPassword !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致。'
    return
  }

  isSubmitting.value = true
  message.value = ''
  errorMessage.value = ''

  const { data, error } =
    mode.value === 'sign-in'
      ? await supabase.auth.signInWithPassword({
          email: nextEmail,
          password: nextPassword,
        })
      : await supabase.auth.signUp({
          email: nextEmail,
          password: nextPassword,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })

  if (error) {
    errorMessage.value = error.message
  } else if (mode.value === 'sign-up' && !data.session) {
    message.value = '注册邮件已发送。请完成邮箱确认后再用密码登录。'
  } else {
    message.value = mode.value === 'sign-up' ? '注册成功，正在进入工作区。' : '登录成功，正在进入工作区。'
  }

  isSubmitting.value = false
}

async function sendMagicLink(): Promise<void> {
  const nextEmail = email.value.trim()

  if (!validateBaseInput(nextEmail)) return

  isSubmitting.value = true
  message.value = ''
  errorMessage.value = ''

  const { error } = await supabase.auth.signInWithOtp({
    email: nextEmail,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) {
    errorMessage.value = error.message
  } else {
    message.value = '登录链接已发送。旧账号没有密码时，可以先用这条链接进入工作区。'
  }

  isSubmitting.value = false
}

function validateBaseInput(nextEmail: string): boolean {
  if (!isSupabaseConfigured) {
    errorMessage.value = supabaseConfigurationError
    return false
  }

  if (!nextEmail) {
    errorMessage.value = '请输入邮箱。'
    return false
  }

  return true
}
</script>

<template>
  <main class="grid h-screen min-w-[1080px] place-items-center bg-slate-950 px-6 text-slate-200">
    <section class="w-full max-w-md border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/70">
      <div class="mb-6">
        <p class="text-sm font-semibold text-cyan-300">AI Novel Factory</p>
        <h1 class="mt-2 text-2xl font-bold text-slate-100">登录网文兵工厂</h1>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          使用邮箱和密码登录后，小说、章节、人物卡和时间线会保存到云端。
        </p>
      </div>

      <div class="mb-5 grid grid-cols-3 border border-slate-800 bg-slate-950 p-1 text-xs font-semibold">
        <button
          class="h-9 transition"
          :class="mode === 'sign-in' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'"
          type="button"
          @click="setMode('sign-in')"
        >
          密码登录
        </button>
        <button
          class="h-9 transition"
          :class="mode === 'sign-up' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'"
          type="button"
          @click="setMode('sign-up')"
        >
          注册账号
        </button>
        <button
          class="h-9 transition"
          :class="mode === 'magic-link' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'"
          type="button"
          @click="setMode('magic-link')"
        >
          链接兜底
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="submitAuth">
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">邮箱</span>
          <input
            v-model="email"
            autocomplete="email"
            class="h-11 w-full border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            type="email"
            placeholder="you@example.com"
          />
        </label>

        <label v-if="mode !== 'magic-link'" class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">密码</span>
          <input
            v-model="password"
            :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'"
            class="h-11 w-full border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            type="password"
            placeholder="至少 8 位"
          />
        </label>

        <label v-if="mode === 'sign-up'" class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">确认密码</span>
          <input
            v-model="confirmPassword"
            autocomplete="new-password"
            class="h-11 w-full border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            type="password"
            placeholder="再次输入密码"
          />
        </label>

        <p v-if="mode === 'sign-in'" class="text-xs leading-5 text-slate-500">
          旧的 Magic Link 账号如果还没有设置密码，请先用“链接兜底”登录，或重新注册一个密码账号。
        </p>
        <p v-else-if="mode === 'sign-up'" class="text-xs leading-5 text-slate-500">
          注册后如果 Supabase 要求邮箱确认，需要先完成确认邮件；确认后即可用密码登录。
        </p>
        <p v-else class="text-xs leading-5 text-slate-500">
          链接兜底只用于旧账号迁移或密码登录异常时使用。
        </p>

        <button
          class="flex h-11 w-full items-center justify-center gap-2 bg-cyan-400 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/50"
          type="submit"
          :disabled="isSubmitting"
        >
          <LogIn v-if="mode === 'sign-in'" class="h-4 w-4" />
          <UserPlus v-else-if="mode === 'sign-up'" class="h-4 w-4" />
          <Link v-else class="h-4 w-4" />
          {{
            isSubmitting
              ? '处理中...'
              : mode === 'sign-in'
                ? '登录'
                : mode === 'sign-up'
                  ? '注册'
                  : '发送登录链接'
          }}
        </button>
      </form>

      <button
        v-if="mode === 'sign-in'"
        class="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-300 transition hover:text-cyan-100"
        type="button"
        @click="setMode('magic-link')"
      >
        <KeyRound class="h-3.5 w-3.5" />
        没有密码？用邮箱链接兜底登录
      </button>

      <p v-if="message" class="mt-4 border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs leading-5 text-cyan-100">
        {{ message }}
      </p>
      <p
        v-if="errorMessage"
        class="mt-4 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100"
      >
        {{ errorMessage }}
      </p>
    </section>
  </main>
</template>
