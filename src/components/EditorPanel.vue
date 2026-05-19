<script setup lang="ts">
import { Clipboard, RotateCcw } from 'lucide-vue-next'
import type { NovelProject } from '../types/novel'

defineProps<{
  novel: NovelProject
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Omit<NovelProject, 'id'>>]
}>()

const tabs = [
  { label: '正文工作台', disabled: false },
  { label: '人物卡', disabled: true },
  { label: '时间轴', disabled: true },
  { label: '灵感讨论', disabled: true },
] as const

async function copyDraft(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
</script>

<template>
  <section class="relative flex h-full min-w-0 flex-1 flex-col bg-slate-900">
    <div class="flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-950/50 px-5">
      <div class="flex items-center gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.label"
          class="h-9 border px-4 text-sm font-medium transition"
          :class="
            tab.disabled
              ? 'cursor-not-allowed border-slate-800 text-slate-600'
              : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
          "
          type="button"
          :disabled="tab.disabled"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1 p-5">
      <textarea
        class="h-full w-full resize-none border border-slate-800 bg-slate-950 px-8 py-7 text-base leading-8 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
        :value="novel.chapterDraft"
        placeholder="生成后的正文会出现在这里。你也可以直接在这里手动润色、改写、扩写。"
        @input="emit('updateNovel', { chapterDraft: ($event.target as HTMLTextAreaElement).value })"
      />

      <div class="absolute bottom-8 right-8 flex items-center gap-2 border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-slate-950/60">
        <button
          class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
          type="button"
          @click="copyDraft(novel.chapterDraft)"
        >
          <Clipboard class="h-4 w-4" />
          一键复制
        </button>
        <button
          class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
          type="button"
          @click="emit('updateNovel', { chapterDraft: '' })"
        >
          <RotateCcw class="h-4 w-4" />
          清空重写
        </button>
      </div>
    </div>
  </section>
</template>
