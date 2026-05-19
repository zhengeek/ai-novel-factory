import type { LayoutState, NovelProject } from '../types/novel'

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
  },
  {
    id: 'novel-villain-system',
    title: '反派系统',
    globalSetting:
      '穿书反套路爽文。主角绑定反派系统，却发现系统任务的真正目的不是作恶，而是修正濒临崩坏的剧情线。',
    chapterOutline:
      '第一章：主角醒来成为注定被打脸的炮灰反派，系统发布第一个任务：必须在宴会上羞辱男主，但任务奖励过于可疑。',
    chapterDraft: '',
  },
  {
    id: 'novel-apocalypse',
    title: '末世伪骨科',
    globalSetting:
      '末世公路与复杂情感线。两名没有血缘关系的重组家庭兄妹在灾变后结伴求生，关系在依赖、猜疑和守护中拉扯。',
    chapterOutline:
      '第一章：停电后的城市陷入混乱，女主发现继兄提前囤好了物资，而他似乎早就知道末世会发生。',
    chapterDraft: '',
  },
]

export const defaultLayoutState: LayoutState = {
  activeNovelId: defaultNovels[0].id,
  sidebarCollapsed: false,
  contextPaneWidth: 25,
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
  return novels.length > 0 ? novels : defaultNovels
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
