<script setup lang="ts">
import { BookOpen, ChevronsLeft, ChevronsRight, Factory, Plus } from 'lucide-vue-next'
import type { NovelProject } from '../types/novel'

defineProps<{
  novels: NovelProject[]
  activeNovelId: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  selectNovel: [id: string]
  createNovel: []
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
      <button
        v-for="novel in novels"
        :key="novel.id"
        class="mb-2 flex w-full items-center gap-3 border px-3 py-3 text-left text-sm transition"
        :class="
          novel.id === activeNovelId
            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
            : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100'
        "
        type="button"
        :title="novel.title"
        @click="emit('selectNovel', novel.id)"
      >
        <BookOpen class="h-4 w-4 shrink-0" />
        <span v-if="!collapsed" class="line-clamp-2 leading-5">{{ novel.title }}</span>
      </button>
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
