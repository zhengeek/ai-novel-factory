<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import MainWorkspace from './components/MainWorkspace.vue'
import {
  defaultLayoutState,
  loadLayoutState,
  loadNovels,
  saveLayoutState,
  saveNovels,
} from './services/novelStorage'
import type { EditorTab, LayoutState, NovelProject } from './types/novel'

const novels = ref<NovelProject[]>(loadNovels())
const layout = ref<LayoutState>(loadLayoutState())

if (!novels.value.some((novel) => novel.id === layout.value.activeNovelId)) {
  layout.value.activeNovelId = novels.value[0]?.id ?? defaultLayoutState.activeNovelId
}

const activeNovel = computed<NovelProject | undefined>(() =>
  novels.value.find((novel) => novel.id === layout.value.activeNovelId),
)

watch(
  novels,
  (currentNovels) => {
    saveNovels(currentNovels)
  },
  { deep: true },
)

watch(
  layout,
  (currentLayout) => {
    saveLayoutState(currentLayout)
  },
  { deep: true },
)

function selectNovel(id: string): void {
  layout.value.activeNovelId = id
}

function toggleSidebar(): void {
  layout.value.sidebarCollapsed = !layout.value.sidebarCollapsed
}

function createNovel(): void {
  const id = `novel-${Date.now()}`
  const nextNovel: NovelProject = {
    id,
    title: `未命名小说 ${novels.value.length + 1}`,
    globalSetting: '',
    chapterOutline: '',
    chapterDraft: '',
    characters: [],
    timelineEvents: [],
    inspirationMessages: [],
  }

  novels.value = [...novels.value, nextNovel]
  layout.value.activeNovelId = id
}

function renameNovel(id: string, title: string): void {
  const nextTitle = title.trim() || '未命名小说'

  novels.value = novels.value.map((novel) => (novel.id === id ? { ...novel, title: nextTitle } : novel))
}

function deleteNovel(id: string): void {
  if (novels.value.length <= 1) return

  const currentIndex = novels.value.findIndex((novel) => novel.id === id)
  const remainingNovels = novels.value.filter((novel) => novel.id !== id)

  novels.value = remainingNovels

  if (layout.value.activeNovelId === id) {
    const nextIndex = Math.min(Math.max(currentIndex, 0), remainingNovels.length - 1)
    layout.value.activeNovelId = remainingNovels[nextIndex].id
  }
}

function updateActiveNovel(patch: Partial<Omit<NovelProject, 'id'>>): void {
  novels.value = novels.value.map((novel) =>
    novel.id === layout.value.activeNovelId ? { ...novel, ...patch } : novel,
  )
}

function updateContextPaneWidth(width: number): void {
  layout.value.contextPaneWidth = Math.min(38, Math.max(18, width))
}

function updateActiveEditorTab(tab: EditorTab): void {
  layout.value.activeEditorTab = tab
}
</script>

<template>
  <div class="h-screen min-w-[1080px] overflow-hidden bg-slate-950 text-slate-200">
    <div class="flex h-full">
      <Sidebar
        :novels="novels"
        :active-novel-id="layout.activeNovelId"
        :collapsed="layout.sidebarCollapsed"
        @select-novel="selectNovel"
        @create-novel="createNovel"
        @rename-novel="renameNovel"
        @delete-novel="deleteNovel"
        @toggle-sidebar="toggleSidebar"
      />

      <MainWorkspace
        v-if="activeNovel"
        :novel="activeNovel"
        :context-pane-width="layout.contextPaneWidth"
        :active-editor-tab="layout.activeEditorTab"
        @update-novel="updateActiveNovel"
        @update-context-pane-width="updateContextPaneWidth"
        @update-active-editor-tab="updateActiveEditorTab"
      />
    </div>
  </div>
</template>
