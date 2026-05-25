<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Session } from '@supabase/supabase-js'
import AuthGate from './components/AuthGate.vue'
import Sidebar from './components/Sidebar.vue'
import MainWorkspace from './components/MainWorkspace.vue'
import { loadLayoutState, loadNovels, saveLayoutState } from './services/novelStorage'
import { isSupabaseConfigured, supabase, supabaseConfigurationError } from './services/supabaseClient'
import * as cloudStore from './services/cloudStore'
import type {
  Chapter,
  EditorTab,
  LayoutState,
  MemoryCandidate,
  MemoryItem,
  NovelProject,
  PreferenceKind,
  PreferenceNote,
  UserSettings,
} from './types/novel'

const LOCAL_IMPORT_KEY = 'ai-novel-factory:local-imported'
const LOCAL_NOVELS_KEY = 'ai-novel-factory:novels'
const GENERATION_LOSS_MESSAGE = '当前有未处理的生成预览。请先采用或丢弃；继续操作会丢失当前预览，确定继续吗？'

const session = ref<Session | null>(null)
const isAuthLoading = ref(true)
const isWorkspaceLoading = ref(false)
const isImporting = ref(false)
const workspaceError = ref('')
const workspaceNotice = ref('')
const novels = ref<NovelProject[]>([])
const userSettings = ref<UserSettings | null>(null)
const layout = ref<LayoutState>(loadLayoutState())
const localNovels = ref<NovelProject[]>(localStorage.getItem(LOCAL_NOVELS_KEY) ? loadNovels() : [])
const hasGenerationDirty = ref(false)
const acceptingMemoryCandidateIds = ref<Set<string>>(new Set())
const saveTimers = new Map<string, number>()
let workspaceLoadPromise: Promise<void> | null = null

const activeNovel = computed<NovelProject | undefined>(() =>
  novels.value.find((novel) => novel.id === layout.value.activeNovelId),
)

const activeChapter = computed<Chapter | undefined>(() => {
  const novel = activeNovel.value

  if (!novel) return undefined

  return novel.chapters.find((chapter) => chapter.id === layout.value.activeChapterId) ?? novel.chapters[0]
})

const hasLocalImportCandidate = computed(() => {
  if (localStorage.getItem(LOCAL_IMPORT_KEY) === 'true') return false
  return localNovels.value.length > 0
})

const acceptingMemoryCandidateIdList = computed(() => Array.from(acceptingMemoryCandidateIds.value))

watch(
  layout,
  (currentLayout) => {
    saveLayoutState(currentLayout)
  },
  { deep: true },
)

onMounted(async () => {
  if (!isSupabaseConfigured) {
    isAuthLoading.value = false
    workspaceError.value = supabaseConfigurationError
    return
  }

  const { data } = await supabase.auth.getSession()
  session.value = data.session
  isAuthLoading.value = false

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession

    if (nextSession) {
      void loadCloudWorkspaceOnce()
    } else {
      novels.value = []
      userSettings.value = null
    }
  })

  if (session.value) {
    await loadCloudWorkspaceOnce()
  }
})

function loadCloudWorkspaceOnce(): Promise<void> {
  workspaceLoadPromise ??= loadCloudWorkspace().finally(() => {
    workspaceLoadPromise = null
  })

  return workspaceLoadPromise
}

async function loadCloudWorkspace(): Promise<void> {
  const user = session.value?.user

  isWorkspaceLoading.value = true
  workspaceError.value = ''
  workspaceNotice.value = ''

  try {
    const workspace = await cloudStore.loadWorkspace()
    let nextNovels = workspace.novels

    if (user && hasLocalImportCandidate.value) {
      isImporting.value = true
      const importedNovels = await cloudStore.importLocalNovels(user.id, localNovels.value, nextNovels.length)
      nextNovels = [...nextNovels, ...importedNovels]
      localStorage.setItem(LOCAL_IMPORT_KEY, 'true')
    }

    novels.value = nextNovels
    userSettings.value = workspace.userSettings
    ensureActiveSelection()
  } catch (error) {
    setWorkspaceError(error, '加载云端工作区失败。')
  } finally {
    isImporting.value = false
    isWorkspaceLoading.value = false
  }
}

async function signOut(): Promise<void> {
  if (!confirmGenerationLoss()) return

  hasGenerationDirty.value = false
  await supabase.auth.signOut()
}

function ensureActiveSelection(preferredNovelId?: string): void {
  if (novels.value.length === 0) {
    layout.value.activeNovelId = ''
    layout.value.activeChapterId = ''
    return
  }

  const nextNovel =
    novels.value.find((novel) => novel.id === preferredNovelId) ??
    novels.value.find((novel) => novel.id === layout.value.activeNovelId) ??
    novels.value[0]

  layout.value.activeNovelId = nextNovel.id

  if (!nextNovel.chapters.some((chapter) => chapter.id === layout.value.activeChapterId)) {
    layout.value.activeChapterId = nextNovel.chapters[0]?.id ?? ''
  }
}

function selectNovel(id: string): void {
  if (id === layout.value.activeNovelId) return
  if (!confirmGenerationLoss()) return

  layout.value.activeNovelId = id
  const nextNovel = novels.value.find((novel) => novel.id === id)
  layout.value.activeChapterId = nextNovel?.chapters[0]?.id ?? ''
}

function selectChapter(id: string): void {
  if (id === layout.value.activeChapterId) return
  if (!confirmGenerationLoss()) return

  layout.value.activeChapterId = id
}

function toggleSidebar(): void {
  layout.value.sidebarCollapsed = !layout.value.sidebarCollapsed
}

async function createNovel(): Promise<void> {
  const user = session.value?.user

  if (!user) return

  try {
    const nextNovel = await cloudStore.createNovel(user.id, `未命名小说 ${novels.value.length + 1}`, novels.value.length)
    novels.value = [...novels.value, nextNovel]
    layout.value.activeNovelId = nextNovel.id
    layout.value.activeChapterId = nextNovel.chapters[0]?.id ?? ''
  } catch (error) {
    setWorkspaceError(error, '新建小说失败。')
  }
}

function renameNovel(id: string, title: string): void {
  const nextTitle = title.trim() || '未命名小说'
  updateNovelLocal(id, { title: nextTitle })
  debounceSave(`novel:${id}`, () => cloudStore.updateNovel(id, { title: nextTitle }))
}

async function deleteNovel(id: string): Promise<void> {
  if (novels.value.length <= 1) return
  if (id === layout.value.activeNovelId && !confirmGenerationLoss()) return

  const currentNovels = novels.value
  const currentIndex = currentNovels.findIndex((novel) => novel.id === id)
  novels.value = currentNovels.filter((novel) => novel.id !== id)

  if (layout.value.activeNovelId === id) {
    const nextIndex = Math.min(Math.max(currentIndex, 0), novels.value.length - 1)
    ensureActiveSelection(novels.value[nextIndex]?.id)
  }

  try {
    await cloudStore.deleteNovel(id)
  } catch (error) {
    novels.value = currentNovels
    setWorkspaceError(error, '删除小说失败。')
  }
}

function updateActiveNovel(
  patch: Partial<Pick<NovelProject, 'globalSetting' | 'worldbuilding' | 'library'>>,
): void {
  const novel = activeNovel.value

  if (!novel) return

  updateNovelLocal(novel.id, patch)
  debounceSave(`novel:${novel.id}`, () => cloudStore.updateNovel(novel.id, patch))
}

async function createChapter(): Promise<void> {
  const user = session.value?.user
  const novel = activeNovel.value

  if (!user || !novel) return
  if (!confirmGenerationLoss()) return

  try {
    const nextChapter = await cloudStore.createChapter(user.id, novel.id, `第 ${novel.chapters.length + 1} 章`, novel.chapters.length)
    updateNovelLocal(novel.id, { chapters: [...novel.chapters, nextChapter] })
    layout.value.activeChapterId = nextChapter.id
  } catch (error) {
    setWorkspaceError(error, '新建章节失败。')
  }
}

function updateActiveChapter(patch: Partial<Pick<Chapter, 'title' | 'outline' | 'content' | 'status'>>): void {
  const chapter = activeChapter.value

  if (!chapter) return

  updateChapterLocal(chapter.id, patch)
  debounceSave(`chapter:${chapter.id}`, () => cloudStore.updateChapter(chapter.id, patch))
}

async function extractMemoryForAcceptedChapter(content: string): Promise<void> {
  const novel = activeNovel.value
  const chapter = activeChapter.value
  const settings = userSettings.value

  if (!novel || !chapter || !settings || !content.trim()) return

  try {
    workspaceNotice.value = ''

    const response = await fetch('/api/extract-memory', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.value?.access_token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        novelId: novel.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterOutline: chapter.outline,
        chapterContent: content,
        provider: settings.candidateProvider,
        openaiCandidateModel: settings.openaiCandidateModel,
      }),
    })

    const payload = (await response.json()) as {
      summary?: NovelProject['chapterSummaries'][number]
      candidates?: MemoryCandidate[]
      error?: string
    }

    if (!response.ok) throw new Error(payload.error ?? '长期记忆抽取失败。')

    const latestNovel = novels.value.find((item) => item.id === novel.id)

    if (!latestNovel) return

    updateNovelLocal(novel.id, {
      chapterSummaries: payload.summary
        ? [
            ...latestNovel.chapterSummaries.filter((summary) => summary.chapterId !== payload.summary?.chapterId),
            payload.summary,
          ]
        : latestNovel.chapterSummaries,
      memoryCandidates: [...(payload.candidates ?? []), ...latestNovel.memoryCandidates],
    })

    if (settings.memoryReviewMode === 'after_adopt' && payload.candidates?.length) {
      layout.value.activeEditorTab = 'memory'
    }
  } catch (error) {
    workspaceNotice.value =
      error instanceof Error ? `${error.message} 正文已经采用，不会回滚。` : '长期记忆抽取失败，但正文已经采用，不会回滚。'
  }
}

async function deleteChapter(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel || novel.chapters.length <= 1) return
  if (id === layout.value.activeChapterId && !confirmGenerationLoss()) return

  const currentChapters = novel.chapters
  const currentIndex = currentChapters.findIndex((chapter) => chapter.id === id)
  const nextChapters = currentChapters.filter((chapter) => chapter.id !== id)
  updateNovelLocal(novel.id, { chapters: nextChapters })

  if (layout.value.activeChapterId === id) {
    const nextIndex = Math.min(Math.max(currentIndex, 0), nextChapters.length - 1)
    layout.value.activeChapterId = nextChapters[nextIndex].id
  }

  try {
    await cloudStore.deleteChapter(id)
  } catch (error) {
    updateNovelLocal(novel.id, { chapters: currentChapters })
    setWorkspaceError(error, '删除章节失败。')
  }
}

async function reorderChapters(sourceId: string, targetId: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel || sourceId === targetId) return

  const sourceIndex = novel.chapters.findIndex((chapter) => chapter.id === sourceId)
  const targetIndex = novel.chapters.findIndex((chapter) => chapter.id === targetId)

  if (sourceIndex < 0 || targetIndex < 0) return

  const nextChapters = [...novel.chapters]
  const [movedChapter] = nextChapters.splice(sourceIndex, 1)
  nextChapters.splice(targetIndex, 0, movedChapter)

  const sortedChapters = nextChapters.map((chapter, index) => ({ ...chapter, sortOrder: index }))
  updateNovelLocal(novel.id, { chapters: sortedChapters })

  try {
    await Promise.all(sortedChapters.map((chapter) => cloudStore.updateChapter(chapter.id, { sortOrder: chapter.sortOrder })))
  } catch (error) {
    setWorkspaceError(error, '保存章节排序失败。')
  }
}

async function addCharacter(): Promise<void> {
  const user = session.value?.user
  const novel = activeNovel.value

  if (!user || !novel) return

  try {
    const nextCharacter = await cloudStore.createCharacter(user.id, novel.id, novel.characters.length)
    updateNovelLocal(novel.id, { characters: [...novel.characters, nextCharacter] })
  } catch (error) {
    setWorkspaceError(error, '新增人物失败。')
  }
}

function updateCharacter(id: string, patch: Partial<Omit<NovelProject['characters'][number], 'id'>>): void {
  const novel = activeNovel.value

  if (!novel) return

  const characters = novel.characters.map((character) => (character.id === id ? { ...character, ...patch } : character))
  updateNovelLocal(novel.id, { characters })
  debounceSave(`character:${id}`, () => cloudStore.updateCharacter(id, patch))
}

async function deleteCharacter(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel) return

  const currentCharacters = novel.characters
  updateNovelLocal(novel.id, { characters: currentCharacters.filter((character) => character.id !== id) })

  try {
    await cloudStore.deleteCharacter(id)
  } catch (error) {
    updateNovelLocal(novel.id, { characters: currentCharacters })
    setWorkspaceError(error, '删除人物失败。')
  }
}

async function addPreferenceNote(kind: PreferenceKind, content = ''): Promise<void> {
  const user = session.value?.user
  const novel = activeNovel.value
  const nextContent = content.trim()

  if (!user || !novel) return

  if (kind === 'avoid' && nextContent) {
    const tempId = `temp-preference-${Date.now()}`
    const optimisticNote: PreferenceNote = {
      id: tempId,
      novelId: novel.id,
      kind,
      content: nextContent,
      sortOrder: novel.preferenceNotes.length,
      createdAt: new Date().toISOString(),
    }

    updateNovelLocal(novel.id, { preferenceNotes: [...novel.preferenceNotes, optimisticNote] })

    try {
      const savedNote = await cloudStore.createPreferenceNote(user.id, novel.id, kind, nextContent, optimisticNote.sortOrder)
      const latestNovel = novels.value.find((item) => item.id === novel.id)

      if (!latestNovel) return

      updateNovelLocal(novel.id, {
        preferenceNotes: latestNovel.preferenceNotes.map((note) => (note.id === tempId ? savedNote : note)),
      })
    } catch (error) {
      const latestNovel = novels.value.find((item) => item.id === novel.id)

      if (latestNovel) {
        updateNovelLocal(novel.id, {
          preferenceNotes: latestNovel.preferenceNotes.filter((note) => note.id !== tempId),
        })
      }

      setWorkspaceError(error, '新增偏好/避雷失败。')
    }

    return
  }

  try {
    const note = await cloudStore.createPreferenceNote(user.id, novel.id, kind, content, novel.preferenceNotes.length)
    updateNovelLocal(novel.id, { preferenceNotes: [...novel.preferenceNotes, note] })
  } catch (error) {
    setWorkspaceError(error, '新增偏好/避雷失败。')
  }
}

function updatePreferenceNote(
  id: string,
  patch: Partial<Omit<NovelProject['preferenceNotes'][number], 'id' | 'novelId' | 'createdAt'>>,
): void {
  const novel = activeNovel.value

  if (!novel) return

  const preferenceNotes = novel.preferenceNotes.map((note) => (note.id === id ? { ...note, ...patch } : note))
  updateNovelLocal(novel.id, { preferenceNotes })

  if (id.startsWith('temp-preference-')) return

  debounceSave(`preference:${id}`, () => cloudStore.updatePreferenceNote(id, patch))
}

async function deletePreferenceNote(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel) return

  const currentNotes = novel.preferenceNotes
  updateNovelLocal(novel.id, { preferenceNotes: currentNotes.filter((note) => note.id !== id) })

  if (id.startsWith('temp-preference-')) return

  try {
    await cloudStore.deletePreferenceNote(id)
  } catch (error) {
    updateNovelLocal(novel.id, { preferenceNotes: currentNotes })
    setWorkspaceError(error, '删除偏好/避雷失败。')
  }
}

function updateMemoryCandidate(
  id: string,
  patch: Partial<Pick<MemoryCandidate, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'sourceExcerpt' | 'importance'>>,
): void {
  const novel = activeNovel.value

  if (!novel) return

  updateNovelLocal(novel.id, {
    memoryCandidates: novel.memoryCandidates.map((candidate) =>
      candidate.id === id ? { ...candidate, ...patch } : candidate,
    ),
  })
  debounceSave(`memory-candidate:${id}`, () => cloudStore.updateMemoryCandidate(id, patch))
}

async function rejectMemoryCandidate(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel) return

  updateNovelLocal(novel.id, {
    memoryCandidates: novel.memoryCandidates.map((candidate) =>
      candidate.id === id ? { ...candidate, status: 'rejected' } : candidate,
    ),
  })

  try {
    await cloudStore.updateMemoryCandidate(id, { status: 'rejected' })
  } catch (error) {
    setWorkspaceError(error, '拒绝记忆候选失败。')
  }
}

async function acceptMemoryCandidate(candidate: MemoryCandidate): Promise<void> {
  const novel = activeNovel.value
  const settings = userSettings.value

  if (!novel || !settings) return
  if (acceptingMemoryCandidateIds.value.has(candidate.id)) return

  setMemoryCandidateAccepting(candidate.id, true)

  try {
    const response = await fetch('/api/accept-memory-candidate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.value?.access_token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidateId: candidate.id,
        novelId: candidate.novelId,
        chapterId: candidate.chapterId,
        kind: candidate.kind,
        title: candidate.title,
        summary: candidate.summary,
        detail: candidate.detail,
        tags: candidate.tags,
        sourceExcerpt: candidate.sourceExcerpt,
        importance: candidate.importance,
        embeddingModel: settings.embeddingModel,
        embeddingDimensions: settings.embeddingDimensions,
      }),
    })

    const payload = (await response.json()) as { item?: MemoryItem; candidateId?: string; error?: string }

    if (!response.ok || !payload.item || !payload.candidateId) throw new Error(payload.error ?? '确认长期记忆失败。')

    const latestNovel = novels.value.find((item) => item.id === candidate.novelId)

    if (!latestNovel) return

    updateNovelLocal(candidate.novelId, {
      memoryCandidates: latestNovel.memoryCandidates.map((item) =>
        item.id === payload.candidateId ? { ...item, status: 'accepted' } : item,
      ),
      memoryItems: [payload.item, ...latestNovel.memoryItems],
    })
  } catch (error) {
    setWorkspaceError(error, '确认长期记忆失败。')
  } finally {
    setMemoryCandidateAccepting(candidate.id, false)
  }
}

function updateMemoryItem(
  id: string,
  patch: Partial<Pick<MemoryItem, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'importance' | 'status'>>,
): void {
  const novel = activeNovel.value

  if (!novel) return

  updateNovelLocal(novel.id, {
    memoryItems: novel.memoryItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })
  debounceSave(`memory-item:${id}`, () => cloudStore.updateMemoryItem(id, patch))
}

async function addTimelineEvent(): Promise<void> {
  const user = session.value?.user
  const novel = activeNovel.value

  if (!user || !novel) return

  try {
    const nextEvent = await cloudStore.createTimelineEvent(user.id, novel.id, novel.timelineEvents.length)
    updateNovelLocal(novel.id, { timelineEvents: [...novel.timelineEvents, nextEvent] })
  } catch (error) {
    setWorkspaceError(error, '新增时间线事件失败。')
  }
}

function updateTimelineEvent(id: string, patch: Partial<Omit<NovelProject['timelineEvents'][number], 'id'>>): void {
  const novel = activeNovel.value

  if (!novel) return

  const timelineEvents = novel.timelineEvents.map((event) => (event.id === id ? { ...event, ...patch } : event))
  updateNovelLocal(novel.id, { timelineEvents })
  debounceSave(`timeline:${id}`, () => cloudStore.updateTimelineEvent(id, patch))
}

async function deleteTimelineEvent(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel) return

  const currentEvents = novel.timelineEvents
  updateNovelLocal(novel.id, { timelineEvents: currentEvents.filter((event) => event.id !== id) })

  try {
    await cloudStore.deleteTimelineEvent(id)
  } catch (error) {
    updateNovelLocal(novel.id, { timelineEvents: currentEvents })
    setWorkspaceError(error, '删除时间线事件失败。')
  }
}

async function addInspirationMessage(content: string): Promise<void> {
  const user = session.value?.user
  const novel = activeNovel.value

  if (!user || !novel) return

  try {
    const message = await cloudStore.createInspirationMessage(user.id, novel.id, content)
    updateNovelLocal(novel.id, { inspirationMessages: [...novel.inspirationMessages, message] })
  } catch (error) {
    setWorkspaceError(error, '新增灵感记录失败。')
  }
}

async function deleteInspirationMessage(id: string): Promise<void> {
  const novel = activeNovel.value

  if (!novel) return

  const currentMessages = novel.inspirationMessages
  updateNovelLocal(novel.id, {
    inspirationMessages: currentMessages.filter((message) => message.id !== id),
  })

  try {
    await cloudStore.deleteInspirationMessage(id)
  } catch (error) {
    updateNovelLocal(novel.id, { inspirationMessages: currentMessages })
    setWorkspaceError(error, '删除灵感记录失败。')
  }
}

function updateContextPaneWidth(width: number): void {
  layout.value.contextPaneWidth = Math.min(38, Math.max(18, width))
}

function updateActiveEditorTab(tab: EditorTab): void {
  layout.value.activeEditorTab = tab
}

function updateUserSettings(patch: Partial<Omit<UserSettings, 'id'>>): void {
  const settings = userSettings.value

  if (!settings) return

  userSettings.value = { ...settings, ...patch }
  debounceSave('user-settings', () => cloudStore.updateUserSettings(settings.id, patch))
}

function updateGenerationDirty(isDirty: boolean): void {
  hasGenerationDirty.value = isDirty
}

function setMemoryCandidateAccepting(id: string, isAccepting: boolean): void {
  const nextIds = new Set(acceptingMemoryCandidateIds.value)

  if (isAccepting) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }

  acceptingMemoryCandidateIds.value = nextIds
}

function confirmGenerationLoss(): boolean {
  if (!hasGenerationDirty.value) return true

  return window.confirm(GENERATION_LOSS_MESSAGE)
}

function updateNovelLocal(id: string, patch: Partial<NovelProject>): void {
  novels.value = novels.value.map((novel) => (novel.id === id ? { ...novel, ...patch } : novel))
}

function updateChapterLocal(id: string, patch: Partial<Chapter>): void {
  novels.value = novels.value.map((novel) => ({
    ...novel,
    chapters: novel.chapters.map((chapter) => (chapter.id === id ? { ...chapter, ...patch } : chapter)),
  }))
}

function debounceSave(key: string, action: () => Promise<void>): void {
  const currentTimer = saveTimers.get(key)

  if (currentTimer) {
    window.clearTimeout(currentTimer)
  }

  const nextTimer = window.setTimeout(() => {
    void action().catch((error) => {
      setWorkspaceError(error, '自动保存失败。')
    })
    saveTimers.delete(key)
  }, 900)

  saveTimers.set(key, nextTimer)
}

function setWorkspaceError(error: unknown, fallback: string): void {
  workspaceError.value = error instanceof Error ? error.message : fallback
}
</script>

<template>
  <AuthGate v-if="!isAuthLoading && !session && isSupabaseConfigured" />

  <div v-else class="h-screen min-w-[1080px] overflow-hidden bg-slate-950 text-slate-200">
    <div v-if="!isSupabaseConfigured" class="grid h-full place-items-center bg-slate-950 p-8">
      <div class="max-w-lg border border-rose-400/30 bg-rose-400/10 p-5 text-sm leading-6 text-rose-100">
        {{ supabaseConfigurationError }}
      </div>
    </div>

    <div v-else-if="isAuthLoading || isWorkspaceLoading" class="grid h-full place-items-center text-sm text-slate-500">
      {{ isImporting ? '正在导入本地数据到云端...' : '正在加载云端工作区...' }}
    </div>

    <div v-else class="flex h-full">
      <Sidebar
        :novels="novels"
        :active-novel-id="layout.activeNovelId"
        :collapsed="layout.sidebarCollapsed"
        :user-email="session?.user.email ?? ''"
        @select-novel="selectNovel"
        @create-novel="createNovel"
        @rename-novel="renameNovel"
        @delete-novel="deleteNovel"
        @toggle-sidebar="toggleSidebar"
        @sign-out="signOut"
      />

      <div v-if="workspaceError" class="grid min-w-0 flex-1 place-items-center bg-slate-900 p-8">
        <div class="max-w-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
          {{ workspaceError }}
        </div>
      </div>

      <div v-else-if="novels.length === 0" class="grid min-w-0 flex-1 place-items-center bg-slate-900 p-8">
        <div class="max-w-md text-center">
          <p class="text-lg font-semibold text-slate-100">还没有云端小说</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            新建一本小说后，章节、正文和上下文资料会保存到 Supabase。
          </p>
          <button class="mt-5 h-10 bg-cyan-400 px-4 text-sm font-bold text-slate-950" type="button" @click="createNovel">
            新建小说
          </button>
        </div>
      </div>

      <MainWorkspace
        :key="`${activeNovel.id}:${activeChapter.id}`"
        v-else-if="activeNovel && activeChapter"
        :novel="activeNovel"
        :active-chapter="activeChapter"
        :context-pane-width="layout.contextPaneWidth"
        :active-editor-tab="layout.activeEditorTab"
        :user-settings="userSettings"
        :auth-token="session?.access_token ?? ''"
        :workspace-notice="workspaceNotice"
        :accepting-memory-candidate-ids="acceptingMemoryCandidateIdList"
        @update-novel="updateActiveNovel"
        @update-chapter="updateActiveChapter"
        @create-chapter="createChapter"
        @select-chapter="selectChapter"
        @delete-chapter="deleteChapter"
        @reorder-chapters="reorderChapters"
        @add-character="addCharacter"
        @update-character="updateCharacter"
        @delete-character="deleteCharacter"
        @add-preference-note="addPreferenceNote"
        @update-preference-note="updatePreferenceNote"
        @delete-preference-note="deletePreferenceNote"
        @extract-memory="extractMemoryForAcceptedChapter"
        @update-memory-candidate="updateMemoryCandidate"
        @accept-memory-candidate="acceptMemoryCandidate"
        @reject-memory-candidate="rejectMemoryCandidate"
        @update-memory-item="updateMemoryItem"
        @update-user-settings="updateUserSettings"
        @add-timeline-event="addTimelineEvent"
        @update-timeline-event="updateTimelineEvent"
        @delete-timeline-event="deleteTimelineEvent"
        @add-inspiration-message="addInspirationMessage"
        @delete-inspiration-message="deleteInspirationMessage"
        @update-context-pane-width="updateContextPaneWidth"
        @update-active-editor-tab="updateActiveEditorTab"
        @generation-dirty-change="updateGenerationDirty"
      />
    </div>
  </div>
</template>
