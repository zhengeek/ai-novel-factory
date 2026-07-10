export type EditorTab =
  | 'draft'
  | 'worldbuilding'
  | 'library'
  | 'preferences'
  | 'memory'
  | 'settings'
  | 'characters'
  | 'timeline'
  | 'inspiration'

export type PreferenceKind = 'like' | 'avoid' | 'style'
export type MemoryReviewMode = 'after_adopt' | 'inbox'
export type CandidateProvider = 'deepseek' | 'openai'
export type MemoryKind = 'character' | 'location' | 'organization' | 'item_or_ability' | 'foreshadowing'
export type MemoryCandidateStatus = 'pending' | 'accepted' | 'rejected'
export type MemoryItemStatus = 'active' | 'archived'

export interface UserSettings {
  id: string
  memoryReviewMode: MemoryReviewMode
  memoryInjectionEnabled: boolean
  candidateProvider: CandidateProvider
  openaiCandidateModel: string
  embeddingModel: string
  embeddingDimensions: number
}

export interface PreferenceNote {
  id: string
  novelId: string
  kind: PreferenceKind
  content: string
  sortOrder: number
  createdAt: string
}

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

export interface ChapterSummary {
  id: string
  novelId: string
  chapterId: string
  summary: string
  createdAt: string
  updatedAt: string
}

export interface MemoryCandidate {
  id: string
  novelId: string
  chapterId: string
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  sourceExcerpt: string
  importance: number
  status: MemoryCandidateStatus
  createdAt: string
  updatedAt: string
}

export interface MemoryItem {
  id: string
  novelId: string
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  sourceChapterId: string | null
  sourceExcerpt: string
  importance: number
  status: MemoryItemStatus
  createdAt: string
  updatedAt: string
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
  preferenceNotes: PreferenceNote[]
  chapterSummaries: ChapterSummary[]
  memoryCandidates: MemoryCandidate[]
  memoryItems: MemoryItem[]
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
