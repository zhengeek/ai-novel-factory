export type EditorTab = 'draft' | 'characters' | 'timeline' | 'inspiration'

export interface CharacterCard {
  id: string
  name: string
  role: string
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
  author: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface NovelProject {
  id: string
  title: string
  globalSetting: string
  chapterOutline: string
  chapterDraft: string
  characters: CharacterCard[]
  timelineEvents: TimelineEvent[]
  inspirationMessages: InspirationMessage[]
}

export interface LayoutState {
  activeNovelId: string
  sidebarCollapsed: boolean
  contextPaneWidth: number
  activeEditorTab: EditorTab
}
