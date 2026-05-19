<script setup lang="ts">
import { Bot, ChevronDown, Sparkles, Zap } from 'lucide-vue-next'
import type { NovelProject } from '../types/novel'

defineProps<{
  novel: NovelProject
  isGenerating: boolean
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Omit<NovelProject, 'id'>>]
  generate: []
}>()
</script>

<template>
  <section class="flex h-full min-w-[260px] shrink-0 flex-col border-r border-slate-800 bg-slate-900">
    <div class="flex h-14 items-center justify-between border-b border-slate-800 px-4">
      <div>
        <p class="text-sm font-semibold text-slate-100">上下文控制台</p>
        <p class="text-xs text-slate-500">{{ novel.title }}</p>
      </div>
      <Bot class="h-5 w-5 text-cyan-300" />
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <label class="flex min-h-0 flex-1 flex-col border-b border-slate-800 p-4">
        <span class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">全局设定</span>
        <textarea
          class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
          :value="novel.globalSetting"
          placeholder="世界观、主角性格、核心卖点、禁忌设定..."
          @input="emit('updateNovel', { globalSetting: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>

      <div class="flex min-h-0 flex-1 flex-col p-4">
        <label class="flex min-h-0 flex-1 flex-col">
          <span class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">本章大纲</span>
          <textarea
            class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            :value="novel.chapterOutline"
            placeholder="本章目标、冲突、转折、钩子、结尾悬念..."
            @input="emit('updateNovel', { chapterOutline: ($event.target as HTMLTextAreaElement).value })"
          />
        </label>

        <div class="mt-4 border border-slate-800 bg-slate-950/70">
          <button
            class="flex h-10 w-full items-center justify-between px-3 text-xs font-medium text-slate-400"
            type="button"
            disabled
            title="Phase 2 预留"
          >
            <span class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-slate-500" />
              Phase 2 上下文扩展
            </span>
            <ChevronDown class="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <button
          class="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/50"
          type="button"
          :disabled="isGenerating"
          @click="emit('generate')"
        >
          <Zap class="h-4 w-4" />
          <span>{{ isGenerating ? '生成中...' : '生成本章正文' }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
