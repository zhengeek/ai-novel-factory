import type {
  CandidateProvider,
  MemoryCandidateStatus,
  MemoryItemStatus,
  MemoryKind,
  MemoryReviewMode,
  PreferenceKind,
} from './novel'

export interface UserSettingsRow {
  id: string
  user_id: string
  memory_review_mode: MemoryReviewMode
  memory_injection_enabled: boolean
  candidate_provider: CandidateProvider
  openai_candidate_model: string
  embedding_model: string
  embedding_dimensions: number
  created_at: string
  updated_at: string
}

export interface NovelRow {
  id: string
  user_id: string
  title: string
  global_setting: string
  worldbuilding: string
  library: string
  sort_order: number
  archived: boolean
  created_at: string
  updated_at: string
}

export interface ChapterRow {
  id: string
  user_id: string
  novel_id: string
  title: string
  outline: string
  content: string
  status: 'draft' | 'done'
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CharacterRow {
  id: string
  user_id: string
  novel_id: string
  name: string
  gender: string
  background: string
  personality: string
  goal: string
  secret: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PreferenceNoteRow {
  id: string
  user_id: string
  novel_id: string
  kind: PreferenceKind
  content: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TimelineEventRow {
  id: string
  user_id: string
  novel_id: string
  marker: string
  title: string
  description: string
  impact: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface InspirationMessageRow {
  id: string
  user_id: string
  novel_id: string
  author: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChapterSummaryRow {
  id: string
  user_id: string
  novel_id: string
  chapter_id: string
  summary: string
  created_at: string
  updated_at: string
}

export interface MemoryCandidateRow {
  id: string
  user_id: string
  novel_id: string
  chapter_id: string
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  source_excerpt: string
  importance: number
  status: MemoryCandidateStatus
  created_at: string
  updated_at: string
}

export interface MemoryItemRow {
  id: string
  user_id: string
  novel_id: string
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  source_chapter_id: string | null
  source_excerpt: string
  importance: number
  status: MemoryItemStatus
  created_at: string
  updated_at: string
}
