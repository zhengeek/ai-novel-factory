<script setup lang="ts">
import {
  BookMarked,
  CalendarDays,
  Check,
  Clipboard,
  Database,
  Library,
  MessageSquareText,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  X,
} from 'lucide-vue-next'
import { ref } from 'vue'
import type {
  Chapter,
  CharacterCard,
  EditorTab,
  MemoryCandidate,
  MemoryItem,
  MemoryKind,
  NovelProject,
  UserSettings,
  PreferenceKind,
  PreferenceNote,
  TimelineEvent,
} from '../types/novel'

defineProps<{
  novel: NovelProject
  activeChapter: Chapter
  activeTab: EditorTab
  userSettings: UserSettings | null
  isGenerating: boolean
  generationError: string
  generationPreview: string
  rejectionReason: string
  acceptingMemoryCandidateIds: string[]
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Pick<NovelProject, 'worldbuilding' | 'library'>>]
  updateChapter: [patch: Partial<Pick<Chapter, 'content'>>]
  clearDraft: []
  updateActiveTab: [tab: EditorTab]
  generate: []
  acceptGeneration: []
  discardGeneration: []
  updateRejectionReason: [reason: string]
  recordRejectionReason: []
  addCharacter: []
  updateCharacter: [id: string, patch: Partial<Omit<CharacterCard, 'id'>>]
  deleteCharacter: [id: string]
  addPreferenceNote: [kind: PreferenceKind, content?: string]
  updatePreferenceNote: [id: string, patch: Partial<Omit<PreferenceNote, 'id' | 'novelId' | 'createdAt'>>]
  deletePreferenceNote: [id: string]
  updateMemoryCandidate: [id: string, patch: Partial<Pick<MemoryCandidate, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'sourceExcerpt' | 'importance'>>]
  acceptMemoryCandidate: [candidate: MemoryCandidate]
  rejectMemoryCandidate: [id: string]
  updateMemoryItem: [id: string, patch: Partial<Pick<MemoryItem, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'importance' | 'status'>>]
  updateUserSettings: [patch: Partial<Omit<UserSettings, 'id'>>]
  addTimelineEvent: []
  updateTimelineEvent: [id: string, patch: Partial<Omit<TimelineEvent, 'id'>>]
  deleteTimelineEvent: [id: string]
  addInspirationMessage: [content: string]
  deleteInspirationMessage: [id: string]
}>()

const inspirationInput = ref('')

const tabs: Array<{ id: EditorTab; label: string }> = [
  { id: 'draft', label: '正文工作台' },
  { id: 'worldbuilding', label: '世界观' },
  { id: 'library', label: '资料库' },
  { id: 'preferences', label: '偏好/避雷' },
  { id: 'memory', label: '长期记忆' },
  { id: 'settings', label: '设置' },
  { id: 'characters', label: '人物卡' },
  { id: 'timeline', label: '时间线' },
  { id: 'inspiration', label: '灵感讨论' },
]

const preferenceKindOptions: Array<{ id: PreferenceKind; label: string }> = [
  { id: 'like', label: '喜欢' },
  { id: 'avoid', label: '避雷' },
  { id: 'style', label: '风格' },
]

const preferenceKindLabels: Record<PreferenceKind, string> = {
  like: '喜欢',
  avoid: '避雷',
  style: '风格',
}

const memoryKindOptions: Array<{ id: MemoryKind; label: string }> = [
  { id: 'character', label: '人物' },
  { id: 'location', label: '地点' },
  { id: 'organization', label: '组织' },
  { id: 'item_or_ability', label: '物件/能力' },
  { id: 'foreshadowing', label: '伏笔事件' },
]

const memoryKindLabels: Record<MemoryKind, string> = {
  character: '人物',
  location: '地点',
  organization: '组织',
  item_or_ability: '物件/能力',
  foreshadowing: '伏笔事件',
}

function parseTags(value: string): string[] {
  return value
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
}

async function copyDraft(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function addInspirationMessage(): void {
  const content = inspirationInput.value.trim()

  if (!content) return

  emit('addInspirationMessage', content)
  inspirationInput.value = ''
}
</script>

<template>
  <section class="relative flex h-full min-w-0 flex-1 flex-col bg-slate-900">
    <div class="flex h-14 shrink-0 items-center overflow-x-auto border-b border-slate-800 bg-slate-950/50 px-5">
      <div class="flex items-center gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="h-9 whitespace-nowrap border px-4 text-sm font-medium transition"
          :class="
            activeTab === tab.id
              ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
              : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100'
          "
          type="button"
          @click="emit('updateActiveTab', tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'draft'" class="flex min-h-0 flex-1 flex-col p-5">
      <div class="relative min-h-0 flex-1">
        <textarea
          class="h-full w-full resize-none border border-slate-800 bg-slate-950 px-8 py-7 text-base leading-8 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
          :value="activeChapter.content"
          placeholder="生成后的正文会出现在预览区。采用后才会覆盖这里的章节正文。你也可以直接手动润色、改写、扩写。"
          @input="emit('updateChapter', { content: ($event.target as HTMLTextAreaElement).value })"
        />

        <div class="absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2 border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-slate-950/60">
          <button
            class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
            type="button"
            @click="copyDraft(activeChapter.content)"
          >
            <Clipboard class="h-4 w-4" />
            一键复制
          </button>
          <button
            class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
            type="button"
            @click="emit('clearDraft')"
          >
            <RotateCcw class="h-4 w-4" />
            清空正文
          </button>
        </div>
      </div>

      <div class="mt-4 shrink-0 border border-slate-800 bg-slate-950 p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles class="h-4 w-4 text-cyan-300" />
              生成预览
            </p>
            <p class="mt-1 text-xs text-slate-500">生成内容先停在这里，采用后才写入章节正文。</p>
          </div>
          <button
            class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:bg-cyan-400/50"
            type="button"
            :disabled="isGenerating"
            @click="emit('generate')"
          >
            <Sparkles class="h-4 w-4" />
            {{ generationPreview ? '重新生成' : '生成正文' }}
          </button>
        </div>

        <p v-if="generationError" class="mb-3 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
          {{ generationError }}
        </p>

        <textarea
          class="h-36 w-full resize-none border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600"
          :value="generationPreview"
          readonly
          :placeholder="isGenerating ? '生成中...' : '这里会显示本次生成的临时预览。'"
        />

        <div v-if="generationPreview" class="mt-3 flex flex-wrap gap-3">
          <input
            class="h-10 min-w-[220px] flex-1 border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
            :value="rejectionReason"
            placeholder="不满意的原因，例如：节奏太慢、角色说话太油、解释太多..."
            @input="emit('updateRejectionReason', ($event.target as HTMLInputElement).value)"
          />
          <div class="flex flex-wrap gap-2">
            <button
              class="flex h-10 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
              type="button"
              @click="emit('acceptGeneration')"
            >
              <ThumbsUp class="h-4 w-4" />
              采用
            </button>
            <button
              class="flex h-10 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-slate-100"
              type="button"
              @click="emit('discardGeneration')"
            >
              丢弃
            </button>
            <button
              class="flex h-10 items-center gap-2 border border-rose-400/40 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="!rejectionReason.trim()"
              @click="emit('recordRejectionReason')"
            >
              <ThumbsDown class="h-4 w-4" />
              丢弃并记录原因
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'worldbuilding'" class="flex min-h-0 flex-1 flex-col p-5">
      <div class="mb-4">
        <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <BookMarked class="h-4 w-4 text-cyan-300" />
          世界观
        </p>
        <p class="mt-1 text-xs text-slate-500">记录世界规则、势力结构、能力体系、地理与历史等长期设定。</p>
      </div>
      <textarea
        class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 px-6 py-5 text-sm leading-7 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
        :value="novel.worldbuilding"
        placeholder="例如：世界运行规则、核心冲突、势力分布、能力体系、禁忌与代价..."
        @input="emit('updateNovel', { worldbuilding: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <div v-else-if="activeTab === 'library'" class="flex min-h-0 flex-1 flex-col p-5">
      <div class="mb-4">
        <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Library class="h-4 w-4 text-cyan-300" />
          资料库
        </p>
        <p class="mt-1 text-xs text-slate-500">整理可复用素材、名词解释、地点、物件、台词、参考片段和待回收伏笔。</p>
      </div>
      <textarea
        class="min-h-0 flex-1 resize-none border border-slate-800 bg-slate-950 px-6 py-5 text-sm leading-7 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
        :value="novel.library"
        placeholder="例如：专有名词、地点档案、物件设定、伏笔清单、素材摘录、风格参考..."
        @input="emit('updateNovel', { library: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <div v-else-if="activeTab === 'preferences'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ThumbsDown class="h-4 w-4 text-cyan-300" />
            偏好/避雷
          </p>
          <p class="mt-1 text-xs text-slate-500">只保存你认可的偏好和不满意原因，不保存失败样稿全文。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in preferenceKindOptions"
            :key="option.id"
            class="h-9 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
            type="button"
            @click="emit('addPreferenceNote', option.id)"
          >
            新增{{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="novel.preferenceNotes.length === 0" class="grid h-64 place-items-center border border-dashed border-slate-800 text-sm text-slate-600">
        暂无偏好/避雷。丢弃生成结果时可以记录原因，也可以在这里手动新增。
      </div>
      <div v-else class="space-y-3">
        <article
          v-for="note in novel.preferenceNotes"
          :key="note.id"
          class="grid grid-cols-1 gap-3 border border-slate-800 bg-slate-950 p-4 xl:grid-cols-[120px_minmax(0,1fr)_40px]"
        >
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-500">类型</span>
            <select
              class="h-10 w-full border border-slate-800 bg-slate-900 px-2 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
              :value="note.kind"
              @change="emit('updatePreferenceNote', note.id, { kind: ($event.target as HTMLSelectElement).value as PreferenceKind })"
            >
              <option v-for="option in preferenceKindOptions" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-500">{{ preferenceKindLabels[note.kind] }}内容</span>
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="note.content"
              placeholder="例如：不要太文艺腔；喜欢更强的场景推进；整体风格偏冷峻克制..."
              @input="emit('updatePreferenceNote', note.id, { content: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
          <button
            class="mt-5 grid h-10 w-10 place-items-center border border-slate-800 text-slate-500 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
            type="button"
            title="删除偏好"
            @click="emit('deletePreferenceNote', note.id)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </article>
      </div>
    </div>

    <div v-else-if="activeTab === 'memory'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Database class="h-4 w-4 text-cyan-300" />
            长期记忆
          </p>
          <p class="mt-1 text-xs text-slate-500">采用正文后生成候选，确认后才进入正式长期记忆。</p>
        </div>
        <div class="text-xs text-slate-500">
          待确认 {{ novel.memoryCandidates.filter((candidate) => candidate.status === 'pending').length }} · 已入库
          {{ novel.memoryItems.filter((item) => item.status === 'active').length }}
        </div>
      </div>

      <section class="mb-6">
        <p class="mb-3 text-xs font-semibold uppercase text-slate-500">待确认</p>
        <div v-if="novel.memoryCandidates.filter((candidate) => candidate.status === 'pending').length === 0" class="grid h-32 place-items-center border border-dashed border-slate-800 text-sm text-slate-600">
          暂无待确认记忆。采用生成正文后会自动进入这里。
        </div>
        <div v-else class="space-y-3">
          <article
            v-for="candidate in novel.memoryCandidates.filter((item) => item.status === 'pending')"
            :key="candidate.id"
            class="border border-slate-800 bg-slate-950 p-4"
          >
            <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-[150px_minmax(0,1fr)_96px]">
              <select
                class="h-10 border border-slate-800 bg-slate-900 px-2 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
                :value="candidate.kind"
                @change="emit('updateMemoryCandidate', candidate.id, { kind: ($event.target as HTMLSelectElement).value as MemoryKind })"
              >
                <option v-for="option in memoryKindOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
              <input
                class="h-10 min-w-0 border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
                :value="candidate.title"
                placeholder="记忆标题"
                @input="emit('updateMemoryCandidate', candidate.id, { title: ($event.target as HTMLInputElement).value })"
              />
              <input
                class="h-10 border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
                :value="candidate.importance"
                type="number"
                min="1"
                max="5"
                @input="emit('updateMemoryCandidate', candidate.id, { importance: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <textarea
              class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="candidate.summary"
              placeholder="摘要"
              @input="emit('updateMemoryCandidate', candidate.id, { summary: ($event.target as HTMLTextAreaElement).value })"
            />
            <textarea
              class="mb-3 h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="candidate.detail"
              placeholder="详细事实"
              @input="emit('updateMemoryCandidate', candidate.id, { detail: ($event.target as HTMLTextAreaElement).value })"
            />
            <input
              class="mb-3 h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
              :value="candidate.tags.join('、')"
              placeholder="标签，用顿号、逗号或空格分隔"
              @input="emit('updateMemoryCandidate', candidate.id, { tags: parseTags(($event.target as HTMLInputElement).value) })"
            />
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="min-w-0 flex-1 text-xs leading-5 text-slate-500">原文摘录：{{ candidate.sourceExcerpt || '暂无' }}</p>
              <div class="flex gap-2">
                <button
                  class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  :disabled="acceptingMemoryCandidateIds.includes(candidate.id)"
                  @click="emit('acceptMemoryCandidate', candidate)"
                >
                  <Check class="h-4 w-4" />
                  {{ acceptingMemoryCandidateIds.includes(candidate.id) ? '入库中' : '入库' }}
                </button>
                <button
                  class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  :disabled="acceptingMemoryCandidateIds.includes(candidate.id)"
                  @click="emit('rejectMemoryCandidate', candidate.id)"
                >
                  <X class="h-4 w-4" />
                  拒绝
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section>
        <p class="mb-3 text-xs font-semibold uppercase text-slate-500">已入库</p>
        <div v-if="novel.memoryItems.filter((item) => item.status === 'active').length === 0" class="grid h-32 place-items-center border border-dashed border-slate-800 text-sm text-slate-600">
          暂无正式长期记忆。
        </div>
        <div v-else class="space-y-3">
          <article v-for="item in novel.memoryItems.filter((entry) => entry.status === 'active')" :key="item.id" class="border border-slate-800 bg-slate-950 p-4">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">{{ memoryKindLabels[item.kind] }}</span>
              <input
                class="min-w-[220px] flex-1 border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
                :value="item.title"
                @input="emit('updateMemoryItem', item.id, { title: ($event.target as HTMLInputElement).value })"
              />
              <button class="h-9 border border-slate-700 px-3 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-100" type="button" @click="emit('updateMemoryItem', item.id, { status: 'archived' })">
                归档
              </button>
            </div>
            <textarea
              class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="item.summary"
              @input="emit('updateMemoryItem', item.id, { summary: ($event.target as HTMLTextAreaElement).value })"
            />
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="item.detail"
              @input="emit('updateMemoryItem', item.id, { detail: ($event.target as HTMLTextAreaElement).value })"
            />
          </article>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'settings'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-5">
        <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Settings2 class="h-4 w-4 text-cyan-300" />
          设置
        </p>
        <p class="mt-1 text-xs text-slate-500">控制长期记忆确认方式、候选生成提供商和生成时是否注入长期记忆。</p>
      </div>

      <div v-if="!userSettings" class="border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
        设置加载中。
      </div>
      <div v-else class="space-y-4">
        <label class="flex items-center justify-between gap-4 border border-slate-800 bg-slate-950 p-4">
          <span>
            <span class="block text-sm font-semibold text-slate-100">生成时注入长期记忆</span>
            <span class="mt-1 block text-xs text-slate-500">关闭后，生成正文不会读取长期记忆库。</span>
          </span>
          <input
            class="h-5 w-5"
            type="checkbox"
            :checked="userSettings.memoryInjectionEnabled"
            @change="emit('updateUserSettings', { memoryInjectionEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </label>

        <label class="block border border-slate-800 bg-slate-950 p-4">
          <span class="mb-2 block text-sm font-semibold text-slate-100">候选确认方式</span>
          <select
            class="h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="userSettings.memoryReviewMode"
            @change="emit('updateUserSettings', { memoryReviewMode: ($event.target as HTMLSelectElement).value as UserSettings['memoryReviewMode'] })"
          >
            <option value="after_adopt">采用正文后立即确认</option>
            <option value="inbox">进入收件箱稍后处理</option>
          </select>
        </label>

        <label class="block border border-slate-800 bg-slate-950 p-4">
          <span class="mb-2 block text-sm font-semibold text-slate-100">候选生成提供商</span>
          <select
            class="h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="userSettings.candidateProvider"
            @change="emit('updateUserSettings', { candidateProvider: ($event.target as HTMLSelectElement).value as UserSettings['candidateProvider'] })"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>

        <label class="block border border-slate-800 bg-slate-950 p-4">
          <span class="mb-2 block text-sm font-semibold text-slate-100">OpenAI 候选模型</span>
          <input
            class="h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="userSettings.openaiCandidateModel"
            @input="emit('updateUserSettings', { openaiCandidateModel: ($event.target as HTMLInputElement).value })"
          />
        </label>
      </div>
    </div>

    <div v-else-if="activeTab === 'characters'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <UserRound class="h-4 w-4 text-cyan-300" />
            人物卡
          </p>
          <p class="mt-1 text-xs text-slate-500">细化角色身份、行为逻辑和隐藏信息，生成正文时会自动带入上下文。</p>
        </div>
        <button
          class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          @click="emit('addCharacter')"
        >
          <Plus class="h-4 w-4" />
          新增人物
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article
          v-for="character in novel.characters"
          :key="character.id"
          class="border border-slate-800 bg-slate-950 p-4"
        >
          <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_120px_40px]">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-500">姓名</span>
              <input
                class="h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
                :value="character.name"
                placeholder="角色姓名"
                @input="emit('updateCharacter', character.id, { name: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-500">性别</span>
              <input
                class="h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
                :value="character.gender"
                placeholder="男 / 女 / 其他"
                @input="emit('updateCharacter', character.id, { gender: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <button
              class="mt-5 grid h-10 w-10 place-items-center border border-slate-800 text-slate-500 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
              type="button"
              title="删除人物"
              @click="emit('deleteCharacter', character.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <label class="mb-3 block">
            <span class="mb-1 block text-xs font-medium text-slate-500">身份与背景</span>
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="character.background"
              placeholder="身份、阵营、关系、过去经历、与主线的绑定..."
              @input="emit('updateCharacter', character.id, { background: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
          <label class="mb-3 block">
            <span class="mb-1 block text-xs font-medium text-slate-500">性格与行为模式</span>
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="character.personality"
              placeholder="表达习惯、决策方式、弱点、关系中的反应..."
              @input="emit('updateCharacter', character.id, { personality: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
          <label class="mb-3 block">
            <span class="mb-1 block text-xs font-medium text-slate-500">目标与当前欲望</span>
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="character.goal"
              placeholder="长期目标、眼前想要什么、愿意付出的代价..."
              @input="emit('updateCharacter', character.id, { goal: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-500">秘密</span>
            <textarea
              class="h-24 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="character.secret"
              placeholder="隐瞒的信息、伏笔、反转、不能被别人知道的动机..."
              @input="emit('updateCharacter', character.id, { secret: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
        </article>
      </div>
    </div>

    <div v-else-if="activeTab === 'timeline'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <CalendarDays class="h-4 w-4 text-cyan-300" />
            时间线
          </p>
          <p class="mt-1 text-xs text-slate-500">记录章节事件和因果影响，帮助长篇连载保持连续性。</p>
        </div>
        <button
          class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          @click="emit('addTimelineEvent')"
        >
          <Plus class="h-4 w-4" />
          新增事件
        </button>
      </div>

      <div class="space-y-3">
        <article
          v-for="event in novel.timelineEvents"
          :key="event.id"
          class="grid grid-cols-1 gap-3 border border-slate-800 bg-slate-950 p-4 xl:grid-cols-[160px_minmax(0,1fr)_40px]"
        >
          <input
            class="h-10 border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="event.marker"
            placeholder="章节 / 时间点"
            @input="emit('updateTimelineEvent', event.id, { marker: ($event.target as HTMLInputElement).value })"
          />
          <div class="min-w-0">
            <input
              class="mb-3 h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
              :value="event.title"
              placeholder="事件标题"
              @input="emit('updateTimelineEvent', event.id, { title: ($event.target as HTMLInputElement).value })"
            />
            <textarea
              class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="event.description"
              placeholder="发生了什么"
              @input="emit('updateTimelineEvent', event.id, { description: ($event.target as HTMLTextAreaElement).value })"
            />
            <textarea
              class="h-16 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="event.impact"
              placeholder="影响 / 伏笔 / 后续回收"
              @input="emit('updateTimelineEvent', event.id, { impact: ($event.target as HTMLTextAreaElement).value })"
            />
          </div>
          <button
            class="grid h-10 w-10 place-items-center border border-slate-800 text-slate-500 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
            type="button"
            title="删除事件"
            @click="emit('deleteTimelineEvent', event.id)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </article>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col p-5">
      <div class="mb-4">
        <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <MessageSquareText class="h-4 w-4 text-cyan-300" />
          灵感讨论
        </p>
        <p class="mt-1 text-xs text-slate-500">完整保存作者与 AI 商量敲定过程，后续可接入 AI 追问和扩写。</p>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto border border-slate-800 bg-slate-950 p-4">
        <div v-if="novel.inspirationMessages.length === 0" class="grid h-full place-items-center text-sm text-slate-600">
          暂无灵感记录。
        </div>
        <div v-else class="space-y-3">
          <article
            v-for="message in novel.inspirationMessages"
            :key="message.id"
            class="group flex gap-3 border border-slate-800 bg-slate-900 p-3"
          >
            <div class="grid h-8 w-8 shrink-0 place-items-center border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <MessageSquareText class="h-4 w-4" />
            </div>
            <p class="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{{ message.content }}</p>
            <button
              class="grid h-8 w-8 shrink-0 place-items-center border border-slate-800 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
              type="button"
              title="删除灵感"
              @click="emit('deleteInspirationMessage', message.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </article>
        </div>
      </div>

      <div class="mt-4 flex gap-3">
        <textarea
          v-model="inspirationInput"
          class="h-20 min-w-0 flex-1 resize-none border border-slate-800 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
          placeholder="记录一个桥段、反转、爽点、台词或问题..."
          @keydown.ctrl.enter.prevent="addInspirationMessage"
        />
        <button
          class="flex h-20 w-28 shrink-0 items-center justify-center gap-2 bg-cyan-400 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          @click="addInspirationMessage"
        >
          <Plus class="h-4 w-4" />
          添加
        </button>
      </div>
    </div>
  </section>
</template>
