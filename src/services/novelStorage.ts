import type { CharacterCard, InspirationMessage, LayoutState, NovelProject, TimelineEvent } from '../types/novel'

const NOVELS_KEY = 'ai-novel-factory:novels'
const LAYOUT_KEY = 'ai-novel-factory:layout'

export const defaultNovels: NovelProject[] = [
  {
    id: 'novel-livestream',
    title: '探灵直播',
    globalSetting:
      '都市灵异直播题材。主角是一名冷静克制的探灵主播，靠理性拆解传闻，却逐渐发现每场直播背后都有真实异常。',
    worldbuilding: '灵异事件以直播间弹幕、废弃建筑和城市传闻为主要入口，异常会通过观众互动提前泄露线索。',
    library: '素材：废弃医院、匿名委托、深夜直播、异常弹幕、未来私信。',
    sortOrder: 0,
    archived: false,
    chapters: [
      {
        id: 'chapter-livestream-1',
        novelId: 'novel-livestream',
        title: '第 1 章',
        outline:
          '主角接到匿名委托，前往废弃医院直播。直播间人数异常暴涨，弹幕开始提前描述他尚未看到的走廊尽头。',
        content: '',
        status: 'draft',
        sortOrder: 0,
      },
    ],
    characters: [
      {
        id: 'char-livestream-host',
        name: '林照',
        gender: '男',
        background: '探灵主播，长期靠理性拆解都市传闻积累粉丝。',
        personality: '冷静、怀疑一切，习惯用逻辑拆解恐惧。',
        goal: '证明废弃医院传闻是人为炒作。',
        secret: '他的直播账号曾经收到过来自未来的私信。',
      },
    ],
    timelineEvents: [
      {
        id: 'timeline-livestream-1',
        marker: '第 1 章 / 23:40',
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
    worldbuilding: '世界线会在关键剧情偏离时短暂回滚，系统任务表面惩罚主角，实则暴露剧情漏洞。',
    library: '素材：宴会羞辱任务、炮灰反派、任务奖励异常、世界线回滚。',
    sortOrder: 1,
    archived: false,
    chapters: [
      {
        id: 'chapter-villain-1',
        novelId: 'novel-villain-system',
        title: '第 1 章',
        outline:
          '主角醒来成为注定被打脸的炮灰反派，系统发布第一个任务：必须在宴会上羞辱男主，但任务奖励过于可疑。',
        content: '',
        status: 'draft',
        sortOrder: 0,
      },
    ],
    characters: [
      {
        id: 'char-villain-lead',
        name: '沈砚',
        gender: '男',
        background: '穿书后成为原剧情中注定被打脸的炮灰反派。',
        personality: '表面嚣张，内心谨慎，擅长把系统任务拆成漏洞。',
        goal: '活过原书前三十章，并找出系统真实目的。',
        secret: '他每次违背反派套路，世界线都会短暂回滚。',
      },
    ],
    timelineEvents: [
      {
        id: 'timeline-villain-1',
        marker: '第 1 章 / 宴会前',
        title: '系统发布羞辱任务',
        description: '沈砚发现任务奖励和惩罚逻辑不对称。',
        impact: '提示系统并不希望他按传统反派路线行动。',
      },
    ],
    inspirationMessages: [],
  },
]

export const defaultLayoutState: LayoutState = {
  activeNovelId: defaultNovels[0].id,
  activeChapterId: defaultNovels[0].chapters[0].id,
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
  const legacyNovel = novel as NovelProject & {
    chapterOutline?: string
    chapterDraft?: string
    worldbuilding?: string
    library?: string
  }
  const chapters = normalizeArray(legacyNovel.chapters)

  return {
    ...novel,
    globalSetting: novel.globalSetting ?? '',
    worldbuilding: legacyNovel.worldbuilding ?? '',
    library: legacyNovel.library ?? '',
    sortOrder: novel.sortOrder ?? 0,
    archived: novel.archived ?? false,
    chapters:
      chapters.length > 0
        ? chapters.map((chapter, index) => ({
            ...chapter,
            novelId: chapter.novelId ?? novel.id,
            title: chapter.title || `第 ${index + 1} 章`,
            outline: chapter.outline ?? '',
            content: chapter.content ?? '',
            status: chapter.status ?? 'draft',
            sortOrder: chapter.sortOrder ?? index,
          }))
        : [
            {
              id: `chapter-${novel.id}-local`,
              novelId: novel.id,
              title: '第 1 章',
              outline: legacyNovel.chapterOutline ?? '',
              content: legacyNovel.chapterDraft ?? '',
              status: 'draft',
              sortOrder: 0,
            },
          ],
    characters: normalizeArray<CharacterCard>(novel.characters).map(normalizeCharacter),
    timelineEvents: normalizeArray<TimelineEvent>(novel.timelineEvents),
    inspirationMessages: normalizeArray<InspirationMessage>(novel.inspirationMessages).map((message) => ({
      ...message,
      novelId: message.novelId ?? novel.id,
      createdAt: message.createdAt ?? new Date().toISOString(),
    })),
  }
}

function normalizeCharacter(character: CharacterCard): CharacterCard {
  const legacyCharacter = character as CharacterCard & { role?: string }

  return {
    id: character.id,
    name: character.name ?? '',
    gender: character.gender ?? '',
    background: character.background ?? legacyCharacter.role ?? '',
    personality: character.personality ?? '',
    goal: character.goal ?? '',
    secret: character.secret ?? '',
  }
}

function normalizeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}
