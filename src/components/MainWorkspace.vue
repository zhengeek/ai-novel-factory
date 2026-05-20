<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ContextPanel from './ContextPanel.vue'
import EditorPanel from './EditorPanel.vue'
import type { EditorTab, NovelProject } from '../types/novel'

const props = defineProps<{
  novel: NovelProject
  contextPaneWidth: number
  activeEditorTab: EditorTab
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Omit<NovelProject, 'id'>>]
  updateContextPaneWidth: [width: number]
  updateActiveEditorTab: [tab: EditorTab]
}>()

const isGenerating = ref(false)
const isDragging = ref(false)
const generationError = ref('')

const editorPaneWidth = computed(() => `${100 - props.contextPaneWidth}%`)
const contextPaneBasis = computed(() => `${props.contextPaneWidth}%`)

function updateNovel(patch: Partial<Omit<NovelProject, 'id'>>): void {
  emit('updateNovel', patch)
}

async function generateChapter(): Promise<void> {
  if (isGenerating.value) return

  isGenerating.value = true
  generationError.value = ''
  emit('updateNovel', { chapterDraft: '' })

  let nextDraft = ''

  try {
    const response = await fetch('/api/generate-chapter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: props.novel.title,
        globalSetting: props.novel.globalSetting,
        chapterOutline: props.novel.chapterOutline,
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
        emit('updateNovel', { chapterDraft: nextDraft })
      }
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
      :is-generating="isGenerating"
      :generation-error="generationError"
      :style="{ flexBasis: contextPaneBasis }"
      @update-novel="updateNovel"
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
      :active-tab="activeEditorTab"
      :style="{ flexBasis: editorPaneWidth }"
      @update-novel="updateNovel"
      @update-active-tab="emit('updateActiveEditorTab', $event)"
    />
  </main>
</template>
