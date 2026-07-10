<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import ContextPanel from './ContextPanel.vue'
import EditorPanel from './EditorPanel.vue'
import type {
  Chapter,
  CharacterCard,
  EditorTab,
  MemoryCandidate,
  MemoryItem,
  NovelProject,
  PreferenceKind,
  PreferenceNote,
  TimelineEvent,
  UserSettings,
} from '../types/novel'

const CONTEXT_PANE_MIN = 18
const CONTEXT_PANE_MAX = 38

const props = defineProps<{
  novel: NovelProject
  activeChapter: Chapter
  contextPaneWidth: number
  activeEditorTab: EditorTab
  userSettings: UserSettings | null
  authToken: string
  workspaceNotice: string
  acceptingMemoryCandidateIds: string[]
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Pick<NovelProject, 'globalSetting' | 'worldbuilding' | 'library'>>]
  updateChapter: [patch: Partial<Pick<Chapter, 'title' | 'outline' | 'content' | 'status'>>]
  createChapter: []
  selectChapter: [id: string]
  deleteChapter: [id: string]
  reorderChapters: [sourceId: string, targetId: string]
  addCharacter: []
  updateCharacter: [id: string, patch: Partial<Omit<CharacterCard, 'id'>>]
  deleteCharacter: [id: string]
  addPreferenceNote: [kind: PreferenceKind, content?: string]
  updatePreferenceNote: [id: string, patch: Partial<Omit<PreferenceNote, 'id' | 'novelId' | 'createdAt'>>]
  deletePreferenceNote: [id: string]
  extractMemory: [content: string]
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
  updateContextPaneWidth: [width: number]
  updateActiveEditorTab: [tab: EditorTab]
  generationDirtyChange: [isDirty: boolean]
}>()

const isGenerating = ref(false)
const generationError = ref('')
const generationPreview = ref('')
const rejectionReason = ref('')

const contextPaneSize = computed(() => clampContextPaneWidth(props.contextPaneWidth))
const isGenerationDirty = computed(() => isGenerating.value || generationPreview.value.trim().length > 0)

watch(
  isGenerationDirty,
  (isDirty) => {
    emit('generationDirtyChange', isDirty)
  },
  { immediate: true },
)

async function generateChapter(): Promise<void> {
  if (isGenerating.value) return
  if (!confirmGenerationLoss()) return

  isGenerating.value = true
  generationError.value = ''
  generationPreview.value = ''
  rejectionReason.value = ''

  let nextDraft = ''

  try {
    const response = await fetch('/api/generate-chapter', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${props.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        novelId: props.novel.id,
        chapterId: props.activeChapter.id,
        title: props.novel.title,
        globalSetting: props.novel.globalSetting,
        worldbuilding: props.novel.worldbuilding,
        library: props.novel.library,
        chapterOutline: props.activeChapter.outline,
        characters: props.novel.characters,
        preferenceNotes: props.novel.preferenceNotes,
        timelineEvents: props.novel.timelineEvents,
        inspirationMessages: props.novel.inspirationMessages,
      }),
    })

    if (!response.ok) {
      const message = await readErrorMessage(response)
      throw new Error(message)
    }

    if (!response.body) {
      throw new Error('DeepSeek 没有返回可读取的流。')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const content = parseStreamLine(line)

        if (!content) continue

        nextDraft += content
        generationPreview.value = nextDraft
      }
    }

    if (buffer) {
      const content = parseStreamLine(buffer)
      if (content) generationPreview.value = nextDraft + content
    }
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '生成失败，请稍后重试。'
  } finally {
    isGenerating.value = false
  }
}

function acceptGeneration(): void {
  const nextContent = generationPreview.value.trim()

  if (!nextContent) return

  emit('updateChapter', { content: nextContent })
  emit('extractMemory', nextContent)
  generationPreview.value = ''
  rejectionReason.value = ''
  generationError.value = ''
}

function discardGeneration(): void {
  generationPreview.value = ''
  rejectionReason.value = ''
  generationError.value = ''
}

function clearDraft(): void {
  if (!confirmGenerationLoss()) return

  discardGeneration()
  emit('updateChapter', { content: '' })
}

function updateRejectionReason(reason: string): void {
  rejectionReason.value = reason
}

function recordRejectionReason(): void {
  const reason = rejectionReason.value.trim()

  if (!reason) return

  emit('addPreferenceNote', 'avoid', reason)
  discardGeneration()
}

function confirmGenerationLoss(): boolean {
  if (!isGenerationDirty.value) return true

  return window.confirm('当前有未处理的生成预览。请先采用或丢弃；继续操作会丢失当前预览，确定继续吗？')
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? '生成失败，请检查服务端配置。'
  } catch {
    return '生成失败，请检查服务端配置。'
  }
}

function parseStreamLine(line: string): string {
  if (!line.startsWith('data:')) return ''

  const data = line.replace(/^data:\s*/, '')

  if (!data || data === '[DONE]') return ''

  try {
    const payload = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: string
        }
      }>
    }

    return payload.choices?.[0]?.delta?.content ?? ''
  } catch {
    return ''
  }
}

function handlePaneResized(panes: Array<{ size?: number }>): void {
  const nextSize = panes[0]?.size

  if (typeof nextSize === 'number') {
    emit('updateContextPaneWidth', clampContextPaneWidth(nextSize))
  }
}

function clampContextPaneWidth(width: number): number {
  return Math.min(CONTEXT_PANE_MAX, Math.max(CONTEXT_PANE_MIN, width))
}
</script>

<template>
  <main class="relative flex h-full min-w-0 flex-1 bg-slate-900">
    <div
      v-if="workspaceNotice"
      class="pointer-events-none absolute right-5 top-5 z-20 max-w-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100 shadow-2xl shadow-slate-950/30"
    >
      {{ workspaceNotice }}
    </div>

    <Splitpanes class="factory-splitpanes h-full min-w-0 flex-1" @resized="handlePaneResized">
      <Pane :size="contextPaneSize" :min-size="CONTEXT_PANE_MIN" :max-size="CONTEXT_PANE_MAX">
        <ContextPanel
          :novel="novel"
          :active-chapter="activeChapter"
          :is-generating="isGenerating"
          :generation-error="generationError"
          @update-novel="emit('updateNovel', $event)"
          @update-chapter="emit('updateChapter', $event)"
          @create-chapter="emit('createChapter')"
          @select-chapter="emit('selectChapter', $event)"
          @delete-chapter="emit('deleteChapter', $event)"
          @reorder-chapters="(sourceId, targetId) => emit('reorderChapters', sourceId, targetId)"
          @generate="generateChapter"
        />
      </Pane>

      <Pane :size="100 - contextPaneSize">
        <EditorPanel
          :novel="novel"
          :active-chapter="activeChapter"
          :active-tab="activeEditorTab"
          :user-settings="userSettings"
          :accepting-memory-candidate-ids="acceptingMemoryCandidateIds"
          @update-novel="emit('updateNovel', $event)"
          @update-chapter="emit('updateChapter', $event)"
          @clear-draft="clearDraft"
          @update-active-tab="emit('updateActiveEditorTab', $event)"
          @add-character="emit('addCharacter')"
          @update-character="(id, patch) => emit('updateCharacter', id, patch)"
          @delete-character="emit('deleteCharacter', $event)"
          @add-preference-note="(kind, content) => emit('addPreferenceNote', kind, content)"
          @update-preference-note="(id, patch) => emit('updatePreferenceNote', id, patch)"
          @delete-preference-note="emit('deletePreferenceNote', $event)"
          @update-memory-candidate="(id, patch) => emit('updateMemoryCandidate', id, patch)"
          @accept-memory-candidate="emit('acceptMemoryCandidate', $event)"
          @reject-memory-candidate="emit('rejectMemoryCandidate', $event)"
          @update-memory-item="(id, patch) => emit('updateMemoryItem', id, patch)"
          @update-user-settings="emit('updateUserSettings', $event)"
          @add-timeline-event="emit('addTimelineEvent')"
          @update-timeline-event="(id, patch) => emit('updateTimelineEvent', id, patch)"
          @delete-timeline-event="emit('deleteTimelineEvent', $event)"
          @add-inspiration-message="emit('addInspirationMessage', $event)"
          @delete-inspiration-message="emit('deleteInspirationMessage', $event)"
          :is-generating="isGenerating"
          :generation-error="generationError"
          :generation-preview="generationPreview"
          :rejection-reason="rejectionReason"
          @generate="generateChapter"
          @accept-generation="acceptGeneration"
          @discard-generation="discardGeneration"
          @update-rejection-reason="updateRejectionReason"
          @record-rejection-reason="recordRejectionReason"
        />
      </Pane>
    </Splitpanes>
  </main>
</template>
