<script setup lang="ts">
import { BookOpen, ChevronsLeft, ChevronsRight, Factory, Plus, Trash2 } from 'lucide-vue-next'
import type { NovelProject } from '../types/novel'

defineProps<{
  novels: NovelProject[]
  activeNovelId: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  selectNovel: [id: string]
  createNovel: []
  renameNovel: [id: string, title: string]
  deleteNovel: [id: string]
  toggleSidebar: []
}>()
</script>

<template>
  <aside
    class="flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-950/95 transition-[width] duration-200"
    :class="collapsed ? 'w-16' : 'w-[15%] min-w-[220px] max-w-[280px]'"
  >
    <div class="flex h-16 items-center justify-between border-b border-slate-800 px-4">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-9 w-9 shrink-0 place-items-center border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
          <Factory class="h-5 w-5" />
        </div>
        <div v-if="!collapsed" class="min-w-0">
          <p class="truncate text-sm font-semibold tracking-wide text-slate-100">网文兵工厂</p>
          <p class="truncate text-xs text-slate-500">AI Novel Factory</p>
        </div>
      </div>

      <button
        class="grid h-8 w-8 shrink-0 place-items-center border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
        type="button"
        title="折叠侧边栏"
        @click="emit('toggleSidebar')"
      >
        <ChevronsRight v-if="collapsed" class="h-4 w-4" />
        <ChevronsLeft v-else class="h-4 w-4" />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4">
      <div
        v-for="novel in novels"
        :key="novel.id"
        class="group mb-2 flex w-full items-center gap-2 border px-3 py-3 text-left text-sm transition"
        :class="
          novel.id === activeNovelId
            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
            : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100'
        "
        :title="novel.title"
        @click="emit('selectNovel', novel.id)"
      >
        <BookOpen class="h-4 w-4 shrink-0" />
        <input
          v-if="!collapsed"
          class="min-w-0 flex-1 bg-transparent text-sm leading-5 outline-none"
          :class="novel.id === activeNovelId ? 'text-cyan-100' : 'text-slate-400 group-hover:text-slate-100'"
          :value="novel.title"
          aria-label="小说标题"
          @click.stop="emit('selectNovel', novel.id)"
          @change="emit('renameNovel', novel.id, ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <button
          v-if="!collapsed"
          class="grid h-7 w-7 shrink-0 place-items-center border border-transparent text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-100 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-600"
          type="button"
          title="删除小说"
          :disabled="novels.length <= 1"
          @click.stop="emit('deleteNovel', novel.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>

    <div class="border-t border-slate-800 p-3">
      <button
        class="flex h-11 w-full items-center justify-center gap-2 border border-dashed border-slate-700 text-sm font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
        type="button"
        title="新建小说"
        @click="emit('createNovel')"
      >
        <Plus class="h-4 w-4" />
        <span v-if="!collapsed">新建小说</span>
      </button>
    </div>
  </aside>
</template>
