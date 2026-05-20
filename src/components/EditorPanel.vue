<script setup lang="ts">
import {
  BookMarked,
  CalendarDays,
  Clipboard,
  Library,
  MessageSquareText,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { ref } from 'vue'
import type { Chapter, CharacterCard, EditorTab, NovelProject, TimelineEvent } from '../types/novel'

defineProps<{
  novel: NovelProject
  activeChapter: Chapter
  activeTab: EditorTab
}>()

const emit = defineEmits<{
  updateNovel: [patch: Partial<Pick<NovelProject, 'worldbuilding' | 'library'>>]
  updateChapter: [patch: Partial<Pick<Chapter, 'content'>>]
  updateActiveTab: [tab: EditorTab]
  addCharacter: []
  updateCharacter: [id: string, patch: Partial<Omit<CharacterCard, 'id'>>]
  deleteCharacter: [id: string]
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
  { id: 'characters', label: '人物卡' },
  { id: 'timeline', label: '时间线' },
  { id: 'inspiration', label: '灵感讨论' },
]

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

    <div v-if="activeTab === 'draft'" class="relative min-h-0 flex-1 p-5">
      <textarea
        class="h-full w-full resize-none border border-slate-800 bg-slate-950 px-8 py-7 text-base leading-8 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30"
        :value="activeChapter.content"
        placeholder="生成后的正文会出现在这里。你也可以直接在这里手动润色、改写、扩写。"
        @input="emit('updateChapter', { content: ($event.target as HTMLTextAreaElement).value })"
      />

      <div class="absolute bottom-8 right-8 flex items-center gap-2 border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-slate-950/60">
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
          @click="emit('updateChapter', { content: '' })"
        >
          <RotateCcw class="h-4 w-4" />
          清空重写
        </button>
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

      <div class="grid grid-cols-2 gap-4">
        <article
          v-for="character in novel.characters"
          :key="character.id"
          class="border border-slate-800 bg-slate-950 p-4"
        >
          <div class="mb-3 grid grid-cols-[1fr_120px_40px] gap-3">
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
      <div class="mb-4 flex items-center justify-between">
        <div>
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
          class="grid grid-cols-[160px_1fr_40px] gap-3 border border-slate-800 bg-slate-950 p-4"
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
