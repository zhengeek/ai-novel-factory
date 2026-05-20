<script setup lang="ts">
import { ref } from 'vue'
import { LogIn } from 'lucide-vue-next'
import { isSupabaseConfigured, supabase, supabaseConfigurationError } from '../services/supabaseClient'

const email = ref('')
const isSending = ref(false)
const message = ref('')
const errorMessage = ref('')

async function sendMagicLink(): Promise<void> {
  const nextEmail = email.value.trim()

  if (!isSupabaseConfigured) {
    errorMessage.value = supabaseConfigurationError
    return
  }

  if (!nextEmail) {
    errorMessage.value = '请输入邮箱。'
    return
  }

  isSending.value = true
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
    message.value = '登录链接已发送，请打开邮箱完成登录。'
  }

  isSending.value = false
}
</script>

<template>
  <main class="grid h-screen min-w-[1080px] place-items-center bg-slate-950 px-6 text-slate-200">
    <section class="w-full max-w-md border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/70">
      <div class="mb-6">
        <p class="text-sm font-semibold text-cyan-300">AI Novel Factory</p>
        <h1 class="mt-2 text-2xl font-bold text-slate-100">登录网文兵工厂</h1>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          使用邮箱 Magic Link 登录后，小说、章节、人物卡和时间线会保存到云端。
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="sendMagicLink">
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">邮箱</span>
          <input
            v-model="email"
            class="h-11 w-full border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            type="email"
            placeholder="you@example.com"
          />
        </label>

        <button
          class="flex h-11 w-full items-center justify-center gap-2 bg-cyan-400 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/50"
          type="submit"
          :disabled="isSending"
        >
          <LogIn class="h-4 w-4" />
          {{ isSending ? '发送中...' : '发送登录链接' }}
        </button>
      </form>

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
