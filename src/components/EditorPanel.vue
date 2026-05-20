<script setup lang="ts">
import {
  CalendarDays,
  Clipboard,
  MessageSquareText,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { ref } from 'vue'
import type { CharacterCard, EditorTab, InspirationMessage, NovelProject, TimelineEvent } from '../types/novel'

const props = defineProps<{
  novel: NovelProject
  activeTab: EditorTab
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Omit<NovelProject, 'id'>>]
  updateActiveTab: [tab: EditorTab]
}>()

const inspirationInput = ref('')

const tabs: Array<{ id: EditorTab; label: string }> = [
  { id: 'draft', label: '正文工作台' },
  { id: 'characters', label: '人物卡' },
  { id: 'timeline', label: '时间轴' },
  { id: 'inspiration', label: '灵感讨论' },
]

async function copyDraft(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function addCharacter(): void {
  const nextCharacter: CharacterCard = {
    id: createId('character'),
    name: '未命名角色',
    role: '',
    personality: '',
    goal: '',
    secret: '',
  }

  emit('updateNovel', { characters: [...props.novel.characters, nextCharacter] })
}

function updateCharacter(id: string, patch: Partial<Omit<CharacterCard, 'id'>>): void {
  emit('updateNovel', {
    characters: props.novel.characters.map((character) =>
      character.id === id ? { ...character, ...patch } : character,
    ),
  })
}

function deleteCharacter(id: string): void {
  emit('updateNovel', {
    characters: props.novel.characters.filter((character) => character.id !== id),
  })
}

function addTimelineEvent(): void {
  const nextEvent: TimelineEvent = {
    id: createId('event'),
    marker: '新章节',
    title: '未命名事件',
    description: '',
    impact: '',
  }

  emit('updateNovel', { timelineEvents: [...props.novel.timelineEvents, nextEvent] })
}

function updateTimelineEvent(id: string, patch: Partial<Omit<TimelineEvent, 'id'>>): void {
  emit('updateNovel', {
    timelineEvents: props.novel.timelineEvents.map((event) => (event.id === id ? { ...event, ...patch } : event)),
  })
}

function deleteTimelineEvent(id: string): void {
  emit('updateNovel', {
    timelineEvents: props.novel.timelineEvents.filter((event) => event.id !== id),
  })
}

function addInspirationMessage(): void {
  const content = inspirationInput.value.trim()

  if (!content) return

  const nextMessage: InspirationMessage = {
    id: createId('message'),
    author: 'user',
    content,
    createdAt: new Date().toISOString(),
  }

  emit('updateNovel', { inspirationMessages: [...props.novel.inspirationMessages, nextMessage] })
  inspirationInput.value = ''
}

function deleteInspirationMessage(id: string): void {
  emit('updateNovel', {
    inspirationMessages: props.novel.inspirationMessages.filter((message) => message.id !== id),
  })
}
</script>

<template>
  <section class="relative flex h-full min-w-0 flex-1 flex-col bg-slate-900">
    <div class="flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-950/50 px-5">
      <div class="flex items-center gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="h-9 border px-4 text-sm font-medium transition"
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

    <div v-if="activeTab === 'draft'" class="relative min-h-0 flex-1 p-5">
      <textarea
        class="h-full w-full resize-none border border-slate-800 bg-slate-950 px-8 py-7 text-base leading-8 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
        :value="novel.chapterDraft"
        placeholder="生成后的正文会出现在这里。你也可以直接在这里手动润色、改写、扩写。"
        @input="emit('updateNovel', { chapterDraft: ($event.target as HTMLTextAreaElement).value })"
      />

      <div class="absolute bottom-8 right-8 flex items-center gap-2 border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-slate-950/60">
        <button
          class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
          type="button"
          @click="copyDraft(novel.chapterDraft)"
        >
          <Clipboard class="h-4 w-4" />
          一键复制
        </button>
        <button
          class="flex h-9 items-center gap-2 border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
          type="button"
          @click="emit('updateNovel', { chapterDraft: '' })"
        >
          <RotateCcw class="h-4 w-4" />
          清空重写
        </button>
      </div>
    </div>

    <div v-else-if="activeTab === 'characters'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <UserRound class="h-4 w-4 text-cyan-300" />
            人物卡
          </p>
          <p class="mt-1 text-xs text-slate-500">记录角色身份、动机和秘密，生成正文时会自动带入上下文。</p>
        </div>
        <button
          class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          @click="addCharacter"
        >
          <Plus class="h-4 w-4" />
          新增人物
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <article
          v-for="character in novel.characters"
          :key="character.id"
          class="border border-slate-800 bg-slate-950 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <input
              class="min-w-0 flex-1 border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
              :value="character.name"
              placeholder="角色姓名"
              @input="updateCharacter(character.id, { name: ($event.target as HTMLInputElement).value })"
            />
            <button
              class="grid h-9 w-9 place-items-center border border-slate-800 text-slate-500 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
              type="button"
              title="删除人物"
              @click="deleteCharacter(character.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <input
            class="mb-3 w-full border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="character.role"
            placeholder="身份 / 阵营 / 关系"
            @input="updateCharacter(character.id, { role: ($event.target as HTMLInputElement).value })"
          />
          <textarea
            class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
            :value="character.personality"
            placeholder="性格与行为模式"
            @input="updateCharacter(character.id, { personality: ($event.target as HTMLTextAreaElement).value })"
          />
          <textarea
            class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
            :value="character.goal"
            placeholder="目标与当前欲望"
            @input="updateCharacter(character.id, { goal: ($event.target as HTMLTextAreaElement).value })"
          />
          <textarea
            class="h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
            :value="character.secret"
            placeholder="秘密 / 钩子 / 反转"
            @input="updateCharacter(character.id, { secret: ($event.target as HTMLTextAreaElement).value })"
          />
        </article>
      </div>
    </div>

    <div v-else-if="activeTab === 'timeline'" class="min-h-0 flex-1 overflow-y-auto p-5">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <CalendarDays class="h-4 w-4 text-cyan-300" />
            时间轴
          </p>
          <p class="mt-1 text-xs text-slate-500">记录章节事件和因果影响，帮助长篇连载保持连续性。</p>
        </div>
        <button
          class="flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          @click="addTimelineEvent"
        >
          <Plus class="h-4 w-4" />
          新增事件
        </button>
      </div>

      <div class="space-y-3">
        <article
          v-for="event in novel.timelineEvents"
          :key="event.id"
          class="grid grid-cols-[160px_1fr_40px] gap-3 border border-slate-800 bg-slate-950 p-4"
        >
          <input
            class="h-10 border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            :value="event.marker"
            placeholder="章节 / 时间点"
            @input="updateTimelineEvent(event.id, { marker: ($event.target as HTMLInputElement).value })"
          />
          <div class="min-w-0">
            <input
              class="mb-3 h-10 w-full border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
              :value="event.title"
              placeholder="事件标题"
              @input="updateTimelineEvent(event.id, { title: ($event.target as HTMLInputElement).value })"
            />
            <textarea
              class="mb-3 h-20 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="event.description"
              placeholder="发生了什么"
              @input="updateTimelineEvent(event.id, { description: ($event.target as HTMLTextAreaElement).value })"
            />
            <textarea
              class="h-16 w-full resize-none border border-slate-800 bg-slate-900 px-3 py-2 text-sm leading-5 text-slate-200 outline-none focus:border-cyan-400/60"
              :value="event.impact"
              placeholder="影响 / 伏笔 / 后续回收"
              @input="updateTimelineEvent(event.id, { impact: ($event.target as HTMLTextAreaElement).value })"
            />
          </div>
          <button
            class="grid h-10 w-10 place-items-center border border-slate-800 text-slate-500 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-100"
            type="button"
            title="删除事件"
            @click="deleteTimelineEvent(event.id)"
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
        <p class="mt-1 text-xs text-slate-500">先作为本地灵感池，后续可接入 AI 追问和扩写。</p>
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
              @click="deleteInspirationMessage(message.id)"
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
