<script setup lang="ts">
import { Bot, GripVertical, Plus, Trash2, Zap } from 'lucide-vue-next'
import { ref } from 'vue'
import type { Chapter, NovelProject } from '../types/novel'

defineProps<{
  novel: NovelProject
  activeChapter: Chapter
  isGenerating: boolean
  generationError: string
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Pick<NovelProject, 'globalSetting'>>]
  updateChapter: [patch: Partial<Pick<Chapter, 'title' | 'outline' | 'content' | 'status'>>]
  createChapter: []
  selectChapter: [id: string]
  deleteChapter: [id: string]
  reorderChapters: [sourceId: string, targetId: string]
  generate: []
}>()

const draggedChapterId = ref('')
</script>

<template>
  <section class="flex h-full min-w-[300px] shrink-0 flex-col border-r border-slate-800 bg-slate-900">
    <div class="flex h-14 items-center justify-between border-b border-slate-800 px-4">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-100">上下文控制台</p>
        <p class="truncate text-xs text-slate-500">{{ novel.title }} / {{ activeChapter.title }}</p>
      </div>
      <Bot class="h-5 w-5 shrink-0 text-cyan-300" />
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <label class="flex min-h-0 flex-[1.1] flex-col border-b border-slate-800 p-4">
        <span class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">全局设定</span>
        <textarea
          class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
          :value="novel.globalSetting"
          placeholder="世界观、主角性格、核心卖点、禁忌设定..."
          @input="emit('updateNovel', { globalSetting: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>

      <div class="flex min-h-0 flex-[1.4] flex-col border-b border-slate-800 p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">章节管理</span>
          <button
            class="grid h-8 w-8 place-items-center border border-slate-700 text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
            type="button"
            title="新建章节"
            @click="emit('createChapter')"
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div
            v-for="chapter in novel.chapters"
            :key="chapter.id"
            class="group mb-2 flex items-center gap-2 border px-2 py-2 transition"
            :class="
              chapter.id === activeChapter.id
                ? 'border-cyan-400/40 bg-cyan-400/10'
                : 'border-slate-800 bg-slate-950 hover:border-slate-700'
            "
            draggable="true"
            @dragstart="draggedChapterId = chapter.id"
            @dragover.prevent
            @drop="emit('reorderChapters', draggedChapterId, chapter.id)"
            @click="emit('selectChapter', chapter.id)"
          >
            <GripVertical class="h-4 w-4 shrink-0 text-slate-600" />
            <input
              class="min-w-0 flex-1 bg-transparent text-sm outline-none"
              :class="chapter.id === activeChapter.id ? 'text-cyan-100' : 'text-slate-300'"
              :value="chapter.title"
              aria-label="章节标题"
              @click.stop="emit('selectChapter', chapter.id)"
              @change="
                emit('selectChapter', chapter.id);
                emit('updateChapter', { title: ($event.target as HTMLInputElement).value })
              "
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            />
            <button
              class="grid h-7 w-7 shrink-0 place-items-center border border-transparent text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-600"
              type="button"
              title="删除章节"
              :disabled="novel.chapters.length <= 1"
              @click.stop="emit('deleteChapter', chapter.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col p-4">
        <label class="flex min-h-0 flex-1 flex-col">
          <span class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">本章大纲</span>
          <textarea
            class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
            :value="activeChapter.outline"
            placeholder="本章目标、冲突、转折、钩子、结尾悬念..."
            @input="emit('updateChapter', { outline: ($event.target as HTMLTextAreaElement).value })"
          />
        </label>

        <button
          class="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/50"
          type="button"
          :disabled="isGenerating"
          @click="emit('generate')"
        >
          <Zap class="h-4 w-4" />
          <span>{{ isGenerating ? '生成中...' : '生成本章正文' }}</span>
        </button>

        <p v-if="generationError" class="mt-3 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
          {{ generationError }}
        </p>
      </div>
    </div>
  </section>
</template>
