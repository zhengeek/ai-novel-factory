<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ContextPanel from './ContextPanel.vue'
import EditorPanel from './EditorPanel.vue'
import type { Chapter, CharacterCard, EditorTab, NovelProject, TimelineEvent } from '../types/novel'

const props = defineProps<{
  novel: NovelProject
  activeChapter: Chapter
  contextPaneWidth: number
  activeEditorTab: EditorTab
  authToken: string
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
  addTimelineEvent: []
  updateTimelineEvent: [id: string, patch: Partial<Omit<TimelineEvent, 'id'>>]
  deleteTimelineEvent: [id: string]
  addInspirationMessage: [content: string]
  deleteInspirationMessage: [id: string]
  updateContextPaneWidth: [width: number]
  updateActiveEditorTab: [tab: EditorTab]
}>()

const isGenerating = ref(false)
const isDragging = ref(false)
const generationError = ref('')

const editorPaneWidth = computed(() => `${100 - props.contextPaneWidth}%`)
const contextPaneBasis = computed(() => `${props.contextPaneWidth}%`)

async function generateChapter(): Promise<void> {
  if (isGenerating.value) return

  isGenerating.value = true
  generationError.value = ''
  emit('updateChapter', { content: '' })

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
        emit('updateChapter', { content: nextDraft })
      }
    }

    if (buffer) {
      const content = parseStreamLine(buffer)
      if (content) emit('updateChapter', { content: nextDraft + content })
    }
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '生成失败，请稍后重试。'
  } finally {
    isGenerating.value = false
  }
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

function handlePointerMove(event: PointerEvent): void {
  if (!isDragging.value) return

  const availableWidth = window.innerWidth
  const sidebarWidth = document.querySelector('aside')?.getBoundingClientRect().width ?? 0
  const workspaceWidth = availableWidth - sidebarWidth
  const nextWidth = ((event.clientX - sidebarWidth) / workspaceWidth) * 100

  emit('updateContextPaneWidth', nextWidth)
}

function stopDragging(): void {
  isDragging.value = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopDragging)
}

function startDragging(): void {
  isDragging.value = true
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopDragging)
}

onBeforeUnmount(() => {
  stopDragging()
})
</script>

<template>
  <main class="flex h-full min-w-0 flex-1 bg-slate-900">
    <ContextPanel
      :novel="novel"
      :active-chapter="activeChapter"
      :is-generating="isGenerating"
      :generation-error="generationError"
      :style="{ flexBasis: contextPaneBasis }"
      @update-novel="emit('updateNovel', $event)"
      @update-chapter="emit('updateChapter', $event)"
      @create-chapter="emit('createChapter')"
      @select-chapter="emit('selectChapter', $event)"
      @delete-chapter="emit('deleteChapter', $event)"
      @reorder-chapters="(sourceId, targetId) => emit('reorderChapters', sourceId, targetId)"
      @generate="generateChapter"
    />

    <button
      class="group relative h-full w-2 shrink-0 cursor-col-resize bg-slate-950 transition hover:bg-cyan-400/20"
      type="button"
      title="拖拽调整上下文面板宽度"
      @pointerdown="startDragging"
    >
      <span
        class="absolute left-1/2 top-1/2 h-12 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-700 transition group-hover:bg-cyan-300"
      />
    </button>

    <EditorPanel
      :novel="novel"
      :active-chapter="activeChapter"
      :active-tab="activeEditorTab"
      :style="{ flexBasis: editorPaneWidth }"
      @update-novel="emit('updateNovel', $event)"
      @update-chapter="emit('updateChapter', $event)"
      @update-active-tab="emit('updateActiveEditorTab', $event)"
      @add-character="emit('addCharacter')"
      @update-character="(id, patch) => emit('updateCharacter', id, patch)"
      @delete-character="emit('deleteCharacter', $event)"
      @add-timeline-event="emit('addTimelineEvent')"
      @update-timeline-event="(id, patch) => emit('updateTimelineEvent', id, patch)"
      @delete-timeline-event="emit('deleteTimelineEvent', $event)"
      @add-inspiration-message="emit('addInspirationMessage', $event)"
      @delete-inspiration-message="emit('deleteInspirationMessage', $event)"
    />
  </main>
</template>
