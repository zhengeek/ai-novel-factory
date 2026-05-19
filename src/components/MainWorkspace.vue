<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ContextPanel from './ContextPanel.vue'
import EditorPanel from './EditorPanel.vue'
import type { NovelProject } from '../types/novel'

const props = defineProps<{
  novel: NovelProject
  contextPaneWidth: number
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Omit<NovelProject, 'id'>>]
  updateContextPaneWidth: [width: number]
}>()

const isGenerating = ref(false)
const isDragging = ref(false)

const editorPaneWidth = computed(() => `${100 - props.contextPaneWidth}%`)
const contextPaneBasis = computed(() => `${props.contextPaneWidth}%`)

function updateNovel(patch: Partial<Omit<NovelProject, 'id'>>): void {
  emit('updateNovel', patch)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function generateChapter(): Promise<void> {
  if (isGenerating.value) return

  isGenerating.value = true
  emit('updateNovel', { chapterDraft: '' })

  const generatedText = [
    `《${props.novel.title}》`,
    '',
    '雨声像一层低频噪音，贴着窗沿缓慢滚动。',
    '他把全局设定和本章大纲重新扫了一遍，确认每一个冲突点都已经压进了这一章的开场。',
    '屏幕右下角的时间跳了一下，像某种倒计时终于开始。',
    '',
    '这里是 Phase 1 的模拟正文输出。后续接入 DeepSeek 时，将在 generateChapter 中替换为真实的流式 API 调用。',
  ].join('\n')

  let nextDraft = ''

  // TODO Phase 2: call DeepSeek through a server-side proxy or Supabase Edge Function.
  for (const char of generatedText) {
    nextDraft += char
    emit('updateNovel', { chapterDraft: nextDraft })
    await sleep(12)
  }

  isGenerating.value = false
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
      :style="{ flexBasis: editorPaneWidth }"
      @update-novel="updateNovel"
    />
  </main>
</template>
