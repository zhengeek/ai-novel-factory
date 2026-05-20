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
