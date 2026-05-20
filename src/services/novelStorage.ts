import type { CharacterCard, InspirationMessage, LayoutState, NovelProject, TimelineEvent } from '../types/novel'

const NOVELS_KEY = 'ai-novel-factory:novels'
const LAYOUT_KEY = 'ai-novel-factory:layout'

export const defaultNovels: NovelProject[] = [
  {
    id: 'novel-livestream',
    title: '探灵直播',
    globalSetting:
      '都市灵异直播题材。主角是一名冷静克制的探灵主播，靠理性拆解传闻，却逐渐发现每场直播背后都有真实异常。',
    chapterOutline:
      '第一章：主角接到匿名委托，前往废弃医院直播。直播间人数异常暴涨，弹幕开始提前描述他尚未看到的走廊尽头。',
    chapterDraft: '',
    characters: [
      {
        id: 'char-livestream-host',
        name: '林照',
        role: '探灵主播',
        personality: '冷静、怀疑一切，习惯用逻辑拆解恐惧。',
        goal: '证明废弃医院传闻是人为炒作。',
        secret: '他的直播账号曾经收到过来自未来的私信。',
      },
    ],
    timelineEvents: [
      {
        id: 'timeline-livestream-1',
        marker: '第一章 / 23:40',
        title: '废弃医院开播',
        description: '林照进入门诊楼，直播间人数异常上涨。',
        impact: '弹幕开始提前预告走廊里的异常，为后续反转埋钩子。',
      },
    ],
    inspirationMessages: [],
  },
  {
    id: 'novel-villain-system',
    title: '反派系统',
    globalSetting:
      '穿书反套路爽文。主角绑定反派系统，却发现系统任务的真正目的不是作恶，而是修正濒临崩坏的剧情线。',
    chapterOutline:
      '第一章：主角醒来成为注定被打脸的炮灰反派，系统发布第一个任务：必须在宴会上羞辱男主，但任务奖励过于可疑。',
    chapterDraft: '',
    characters: [
      {
        id: 'char-villain-lead',
        name: '沈砚',
        role: '炮灰反派',
        personality: '表面嚣张，内心谨慎，擅长把系统任务拆成漏洞。',
        goal: '活过原书前三十章，并找出系统真实目的。',
        secret: '他每次违背反派套路，世界线都会短暂回滚。',
      },
    ],
    timelineEvents: [
      {
        id: 'timeline-villain-1',
        marker: '第一章 / 宴会前',
        title: '系统发布羞辱任务',
        description: '沈砚发现任务奖励和惩罚逻辑不对称。',
        impact: '提示系统并不希望他按传统反派路线行动。',
      },
    ],
    inspirationMessages: [],
  },
  {
    id: 'novel-apocalypse',
    title: '末世伪骨科',
    globalSetting:
      '末世公路与复杂情感线。两名没有血缘关系的重组家庭兄妹在灾变后结伴求生，关系在依赖、猜疑和守护中拉扯。',
    chapterOutline:
      '第一章：停电后的城市陷入混乱，女主发现继兄提前囤好了物资，而他似乎早就知道末世会发生。',
    chapterDraft: '',
    characters: [
      {
        id: 'char-apocalypse-lead',
        name: '许听澜',
        role: '末世幸存者',
        personality: '敏锐、嘴硬，越害怕越要保持体面。',
        goal: '弄清继兄为什么提前知道灾变。',
        secret: '她其实也梦见过城市停电后的第二天。',
      },
    ],
    timelineEvents: [
      {
        id: 'timeline-apocalypse-1',
        marker: '第一章 / 停电夜',
        title: '城市断电',
        description: '许听澜发现家中物资异常齐全。',
        impact: '继兄的提前准备成为两人信任危机的源头。',
      },
    ],
    inspirationMessages: [],
  },
]

export const defaultLayoutState: LayoutState = {
  activeNovelId: defaultNovels[0].id,
  sidebarCollapsed: false,
  contextPaneWidth: 25,
  activeEditorTab: 'draft',
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function loadNovels(): NovelProject[] {
  const novels = safeParse<NovelProject[]>(localStorage.getItem(NOVELS_KEY), defaultNovels)
  return novels.length > 0 ? novels.map(normalizeNovel) : defaultNovels
}

export function saveNovels(novels: NovelProject[]): void {
  localStorage.setItem(NOVELS_KEY, JSON.stringify(novels))
}

export function loadLayoutState(): LayoutState {
  return {
    ...defaultLayoutState,
    ...safeParse<Partial<LayoutState>>(localStorage.getItem(LAYOUT_KEY), {}),
  }
}

export function saveLayoutState(layout: LayoutState): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

function normalizeNovel(novel: NovelProject): NovelProject {
  return {
    ...novel,
    characters: normalizeArray<CharacterCard>(novel.characters),
    timelineEvents: normalizeArray<TimelineEvent>(novel.timelineEvents),
    inspirationMessages: normalizeArray<InspirationMessage>(novel.inspirationMessages),
  }
}

function normalizeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}
