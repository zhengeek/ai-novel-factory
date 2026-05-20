export type EditorTab = 'draft' | 'worldbuilding' | 'library' | 'characters' | 'timeline' | 'inspiration'

export interface CharacterCard {
  id: string
  name: string
  gender: string
  background: string
  personality: string
  goal: string
  secret: string
}

export interface TimelineEvent {
  id: string
  marker: string
  title: string
  description: string
  impact: string
}

export interface InspirationMessage {
  id: string
  novelId: string
  author: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Chapter {
  id: string
  novelId: string
  title: string
  outline: string
  content: string
  status: 'draft' | 'done'
  sortOrder: number
}

export interface NovelProject {
  id: string
  title: string
  globalSetting: string
  worldbuilding: string
  library: string
  sortOrder: number
  archived: boolean
  chapters: Chapter[]
  characters: CharacterCard[]
  timelineEvents: TimelineEvent[]
  inspirationMessages: InspirationMessage[]
}

export interface LayoutState {
  activeNovelId: string
  activeChapterId: string
  sidebarCollapsed: boolean
  contextPaneWidth: number
  activeEditorTab: EditorTab
}
