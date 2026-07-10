import { supabase } from './supabaseClient'
import type {
  CandidateProvider,
  Chapter,
  ChapterSummary,
  CharacterCard,
  InspirationMessage,
  MemoryCandidate,
  MemoryCandidateStatus,
  MemoryItem,
  MemoryItemStatus,
  MemoryKind,
  MemoryReviewMode,
  NovelProject,
  PreferenceKind,
  PreferenceNote,
  TimelineEvent,
  UserSettings,
} from '../types/novel'
import type {
  ChapterRow,
  ChapterSummaryRow,
  CharacterRow,
  InspirationMessageRow,
  MemoryCandidateRow,
  MemoryItemRow,
  NovelRow,
  PreferenceNoteRow,
  TimelineEventRow,
  UserSettingsRow,
} from '../types/supabase'

export interface CloudWorkspace {
  novels: NovelProject[]
  userSettings: UserSettings
}

export const defaultUserSettings: Omit<UserSettings, 'id'> = {
  memoryReviewMode: 'after_adopt',
  memoryInjectionEnabled: true,
  candidateProvider: 'deepseek',
  openaiCandidateModel: 'gpt-4.1-mini',
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
}

export async function loadWorkspace(): Promise<CloudWorkspace> {
  const user = await getCurrentUser()
  const { data: novelRows, error: novelsError } = await supabase
    .from('novels')
    .select('*')
    .eq('archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (novelsError) throw novelsError

  const [userSettings, novels] = await Promise.all([
    loadUserSettings(user.id),
    Promise.all((novelRows ?? []).map(loadNovelDetails)),
  ])

  return { novels, userSettings }
}

async function getCurrentUser(): Promise<{ id: string }> {
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) throw error ?? new Error('用户未登录。')

  return { id: data.user.id }
}

export async function loadUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()

  if (error) throw error
  if (data) return mapUserSettings(data)

  const { data: inserted, error: insertError } = await supabase
    .from('user_settings')
    .insert({
      user_id: userId,
      memory_review_mode: defaultUserSettings.memoryReviewMode,
      memory_injection_enabled: defaultUserSettings.memoryInjectionEnabled,
      candidate_provider: defaultUserSettings.candidateProvider,
      openai_candidate_model: defaultUserSettings.openaiCandidateModel,
      embedding_model: defaultUserSettings.embeddingModel,
      embedding_dimensions: defaultUserSettings.embeddingDimensions,
    })
    .select('*')
    .single()

  if (insertError) throw insertError

  return mapUserSettings(inserted)
}

export async function updateUserSettings(id: string, patch: Partial<Omit<UserSettings, 'id'>>): Promise<void> {
  const nextPatch: Partial<UserSettingsRow> = {}

  if (patch.memoryReviewMode !== undefined) nextPatch.memory_review_mode = patch.memoryReviewMode
  if (patch.memoryInjectionEnabled !== undefined) nextPatch.memory_injection_enabled = patch.memoryInjectionEnabled
  if (patch.candidateProvider !== undefined) nextPatch.candidate_provider = patch.candidateProvider
  if (patch.openaiCandidateModel !== undefined) nextPatch.openai_candidate_model = patch.openaiCandidateModel
  if (patch.embeddingModel !== undefined) nextPatch.embedding_model = patch.embeddingModel
  if (patch.embeddingDimensions !== undefined) nextPatch.embedding_dimensions = patch.embeddingDimensions

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('user_settings').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function createNovel(userId: string, title: string, sortOrder: number): Promise<NovelProject> {
  const { data, error } = await supabase
    .from('novels')
    .insert({
      user_id: userId,
      title,
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (error) throw error

  const chapter = await createChapter(userId, data.id, '第 1 章', 0)

  return {
    ...mapNovel(data),
    chapters: [chapter],
    characters: [],
    preferenceNotes: [],
    chapterSummaries: [],
    memoryCandidates: [],
    memoryItems: [],
    timelineEvents: [],
    inspirationMessages: [],
  }
}

export async function updateNovel(
  id: string,
  patch: Partial<Pick<NovelProject, 'title' | 'globalSetting' | 'worldbuilding' | 'library'>>,
): Promise<void> {
  const nextPatch: Partial<NovelRow> = {}

  if (patch.title !== undefined) nextPatch.title = patch.title
  if (patch.globalSetting !== undefined) nextPatch.global_setting = patch.globalSetting
  if (patch.worldbuilding !== undefined) nextPatch.worldbuilding = patch.worldbuilding
  if (patch.library !== undefined) nextPatch.library = patch.library

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('novels').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function deleteNovel(id: string): Promise<void> {
  const { error } = await supabase.from('novels').delete().eq('id', id)

  if (error) throw error
}

export async function createChapter(
  userId: string,
  novelId: string,
  title: string,
  sortOrder: number,
  outline = '',
  content = '',
): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      user_id: userId,
      novel_id: novelId,
      title,
      sort_order: sortOrder,
      outline,
      content,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapChapter(data)
}

export async function updateChapter(
  id: string,
  patch: Partial<Pick<Chapter, 'title' | 'outline' | 'content' | 'status' | 'sortOrder'>>,
): Promise<void> {
  const nextPatch: Partial<ChapterRow> = {}

  if (patch.title !== undefined) nextPatch.title = patch.title
  if (patch.outline !== undefined) nextPatch.outline = patch.outline
  if (patch.content !== undefined) nextPatch.content = patch.content
  if (patch.status !== undefined) nextPatch.status = patch.status
  if (patch.sortOrder !== undefined) nextPatch.sort_order = patch.sortOrder

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('chapters').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function deleteChapter(id: string): Promise<void> {
  const { error } = await supabase.from('chapters').delete().eq('id', id)

  if (error) throw error
}

export async function createCharacter(userId: string, novelId: string, sortOrder: number): Promise<CharacterCard> {
  const { data, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      novel_id: novelId,
      name: '未命名角色',
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapCharacter(data)
}

export async function updateCharacter(id: string, patch: Partial<Omit<CharacterCard, 'id'>>): Promise<void> {
  const nextPatch: Partial<CharacterRow> = {}

  if (patch.name !== undefined) nextPatch.name = patch.name
  if (patch.gender !== undefined) nextPatch.gender = patch.gender
  if (patch.background !== undefined) nextPatch.background = patch.background
  if (patch.personality !== undefined) nextPatch.personality = patch.personality
  if (patch.goal !== undefined) nextPatch.goal = patch.goal
  if (patch.secret !== undefined) nextPatch.secret = patch.secret

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('characters').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', id)

  if (error) throw error
}

export async function createPreferenceNote(
  userId: string,
  novelId: string,
  kind: PreferenceKind,
  content: string,
  sortOrder: number,
): Promise<PreferenceNote> {
  const { data, error } = await supabase
    .from('preference_notes')
    .insert({
      user_id: userId,
      novel_id: novelId,
      kind,
      content,
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapPreferenceNote(data)
}

export async function updatePreferenceNote(
  id: string,
  patch: Partial<Pick<PreferenceNote, 'kind' | 'content' | 'sortOrder'>>,
): Promise<void> {
  const nextPatch: Partial<PreferenceNoteRow> = {}

  if (patch.kind !== undefined) nextPatch.kind = patch.kind
  if (patch.content !== undefined) nextPatch.content = patch.content
  if (patch.sortOrder !== undefined) nextPatch.sort_order = patch.sortOrder

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('preference_notes').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function deletePreferenceNote(id: string): Promise<void> {
  const { error } = await supabase.from('preference_notes').delete().eq('id', id)

  if (error) throw error
}

export async function updateMemoryCandidate(
  id: string,
  patch: Partial<
    Pick<MemoryCandidate, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'sourceExcerpt' | 'importance' | 'status'>
  >,
): Promise<void> {
  const nextPatch: Partial<MemoryCandidateRow> = {}

  if (patch.kind !== undefined) nextPatch.kind = patch.kind
  if (patch.title !== undefined) nextPatch.title = patch.title
  if (patch.summary !== undefined) nextPatch.summary = patch.summary
  if (patch.detail !== undefined) nextPatch.detail = patch.detail
  if (patch.tags !== undefined) nextPatch.tags = patch.tags
  if (patch.sourceExcerpt !== undefined) nextPatch.source_excerpt = patch.sourceExcerpt
  if (patch.importance !== undefined) nextPatch.importance = patch.importance
  if (patch.status !== undefined) nextPatch.status = patch.status

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('memory_candidates').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function updateMemoryItem(
  id: string,
  patch: Partial<Pick<MemoryItem, 'kind' | 'title' | 'summary' | 'detail' | 'tags' | 'importance' | 'status'>>,
): Promise<void> {
  const nextPatch: Partial<MemoryItemRow> = {}

  if (patch.kind !== undefined) nextPatch.kind = patch.kind
  if (patch.title !== undefined) nextPatch.title = patch.title
  if (patch.summary !== undefined) nextPatch.summary = patch.summary
  if (patch.detail !== undefined) nextPatch.detail = patch.detail
  if (patch.tags !== undefined) nextPatch.tags = patch.tags
  if (patch.importance !== undefined) nextPatch.importance = patch.importance
  if (patch.status !== undefined) nextPatch.status = patch.status

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('memory_items').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function createTimelineEvent(userId: string, novelId: string, sortOrder: number): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from('timeline_events')
    .insert({
      user_id: userId,
      novel_id: novelId,
      marker: '新章节',
      title: '未命名事件',
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapTimelineEvent(data)
}

export async function updateTimelineEvent(id: string, patch: Partial<Omit<TimelineEvent, 'id'>>): Promise<void> {
  const nextPatch: Partial<TimelineEventRow> = {}

  if (patch.marker !== undefined) nextPatch.marker = patch.marker
  if (patch.title !== undefined) nextPatch.title = patch.title
  if (patch.description !== undefined) nextPatch.description = patch.description
  if (patch.impact !== undefined) nextPatch.impact = patch.impact

  if (Object.keys(nextPatch).length === 0) return

  const { error } = await supabase.from('timeline_events').update(nextPatch).eq('id', id)

  if (error) throw error
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await supabase.from('timeline_events').delete().eq('id', id)

  if (error) throw error
}

export async function createInspirationMessage(
  userId: string,
  novelId: string,
  content: string,
): Promise<InspirationMessage> {
  const { data, error } = await supabase
    .from('inspiration_messages')
    .insert({
      user_id: userId,
      novel_id: novelId,
      author: 'user',
      content,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapInspirationMessage(data)
}

export async function deleteInspirationMessage(id: string): Promise<void> {
  const { error } = await supabase.from('inspiration_messages').delete().eq('id', id)

  if (error) throw error
}

export async function importLocalNovels(
  userId: string,
  novels: NovelProject[],
  startSortOrder = 0,
): Promise<NovelProject[]> {
  const imported: NovelProject[] = []

  for (const [index, novel] of novels.entries()) {
    const { data: novelRow, error: novelError } = await supabase
      .from('novels')
      .insert({
        user_id: userId,
        title: novel.title,
        global_setting: novel.globalSetting,
        worldbuilding: novel.worldbuilding,
        library: novel.library,
        sort_order: startSortOrder + index,
      })
      .select('*')
      .single()

    if (novelError) throw novelError

    const sourceChapters = novel.chapters.length
      ? novel.chapters
      : [
          {
            id: '',
            novelId: novel.id,
            title: '第 1 章',
            outline: '',
            content: '',
            status: 'draft' as const,
            sortOrder: 0,
          },
        ]

    const chapters = await Promise.all(
      sourceChapters.map((chapter, chapterIndex) =>
        createChapter(userId, novelRow.id, chapter.title, chapterIndex, chapter.outline, chapter.content),
      ),
    )

    const characters = await importCharacters(userId, novelRow.id, novel.characters)
    const preferenceNotes = await importPreferenceNotes(userId, novelRow.id, novel.preferenceNotes)
    const timelineEvents = await importTimelineEvents(userId, novelRow.id, novel.timelineEvents)
    const inspirationMessages = await importInspirationMessages(userId, novelRow.id, novel.inspirationMessages)

    imported.push({
      ...mapNovel(novelRow),
      chapters,
      characters,
      preferenceNotes,
      chapterSummaries: [],
      memoryCandidates: [],
      memoryItems: [],
      timelineEvents,
      inspirationMessages,
    })
  }

  return imported
}

async function loadNovelDetails(row: NovelRow): Promise<NovelProject> {
  const [
    chapters,
    characters,
    preferenceNotes,
    chapterSummaries,
    memoryCandidates,
    memoryItems,
    timelineEvents,
    inspirationMessages,
  ] = await Promise.all([
    loadChapters(row.id),
    loadCharacters(row.id),
    loadPreferenceNotes(row.id),
    loadChapterSummaries(row.id),
    loadMemoryCandidates(row.id),
    loadMemoryItems(row.id),
    loadTimelineEvents(row.id),
    loadInspirationMessages(row.id),
  ])

  return {
    ...mapNovel(row),
    chapters,
    characters,
    preferenceNotes,
    chapterSummaries,
    memoryCandidates,
    memoryItems,
    timelineEvents,
    inspirationMessages,
  }
}

async function loadChapters(novelId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('novel_id', novelId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapChapter)
}

async function loadCharacters(novelId: string): Promise<CharacterCard[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('novel_id', novelId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapCharacter)
}

async function loadPreferenceNotes(novelId: string): Promise<PreferenceNote[]> {
  const { data, error } = await supabase
    .from('preference_notes')
    .select('*')
    .eq('novel_id', novelId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapPreferenceNote)
}

async function loadChapterSummaries(novelId: string): Promise<ChapterSummary[]> {
  const { data, error } = await supabase
    .from('chapter_summaries')
    .select('*')
    .eq('novel_id', novelId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapChapterSummary)
}

async function loadMemoryCandidates(novelId: string): Promise<MemoryCandidate[]> {
  const { data, error } = await supabase
    .from('memory_candidates')
    .select('*')
    .eq('novel_id', novelId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapMemoryCandidate)
}

async function loadMemoryItems(novelId: string): Promise<MemoryItem[]> {
  const { data, error } = await supabase
    .from('memory_items')
    .select('id,user_id,novel_id,kind,title,summary,detail,tags,source_chapter_id,source_excerpt,importance,status,created_at,updated_at')
    .eq('novel_id', novelId)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapMemoryItem)
}

async function loadTimelineEvents(novelId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('novel_id', novelId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapTimelineEvent)
}

async function loadInspirationMessages(novelId: string): Promise<InspirationMessage[]> {
  const { data, error } = await supabase
    .from('inspiration_messages')
    .select('*')
    .eq('novel_id', novelId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapInspirationMessage)
}

async function importCharacters(userId: string, novelId: string, characters: CharacterCard[]): Promise<CharacterCard[]> {
  if (!characters.length) return []

  const { data, error } = await supabase
    .from('characters')
    .insert(
      characters.map((character, index) => ({
        user_id: userId,
        novel_id: novelId,
        name: character.name,
        gender: character.gender,
        background: character.background,
        personality: character.personality,
        goal: character.goal,
        secret: character.secret,
        sort_order: index,
      })),
    )
    .select('*')

  if (error) throw error

  return (data ?? []).map(mapCharacter)
}

async function importPreferenceNotes(
  userId: string,
  novelId: string,
  notes: PreferenceNote[],
): Promise<PreferenceNote[]> {
  if (!notes.length) return []

  const { data, error } = await supabase
    .from('preference_notes')
    .insert(
      notes.map((note, index) => ({
        user_id: userId,
        novel_id: novelId,
        kind: note.kind,
        content: note.content,
        sort_order: note.sortOrder ?? index,
        created_at: note.createdAt,
      })),
    )
    .select('*')

  if (error) throw error

  return (data ?? []).map(mapPreferenceNote)
}

async function importTimelineEvents(userId: string, novelId: string, events: TimelineEvent[]): Promise<TimelineEvent[]> {
  if (!events.length) return []

  const { data, error } = await supabase
    .from('timeline_events')
    .insert(
      events.map((event, index) => ({
        user_id: userId,
        novel_id: novelId,
        marker: event.marker,
        title: event.title,
        description: event.description,
        impact: event.impact,
        sort_order: index,
      })),
    )
    .select('*')

  if (error) throw error

  return (data ?? []).map(mapTimelineEvent)
}

async function importInspirationMessages(
  userId: string,
  novelId: string,
  messages: InspirationMessage[],
): Promise<InspirationMessage[]> {
  if (!messages.length) return []

  const { data, error } = await supabase
    .from('inspiration_messages')
    .insert(
      messages.map((message) => ({
        user_id: userId,
        novel_id: novelId,
        author: message.author,
        content: message.content,
        created_at: message.createdAt,
      })),
    )
    .select('*')

  if (error) throw error

  return (data ?? []).map(mapInspirationMessage)
}

function mapUserSettings(row: UserSettingsRow): UserSettings {
  return {
    id: row.id,
    memoryReviewMode: row.memory_review_mode as MemoryReviewMode,
    memoryInjectionEnabled: row.memory_injection_enabled,
    candidateProvider: row.candidate_provider as CandidateProvider,
    openaiCandidateModel: row.openai_candidate_model,
    embeddingModel: row.embedding_model,
    embeddingDimensions: row.embedding_dimensions,
  }
}

function mapNovel(
  row: NovelRow,
): Omit<
  NovelProject,
  'chapters' | 'characters' | 'preferenceNotes' | 'chapterSummaries' | 'memoryCandidates' | 'memoryItems' | 'timelineEvents' | 'inspirationMessages'
> {
  return {
    id: row.id,
    title: row.title,
    globalSetting: row.global_setting ?? '',
    worldbuilding: row.worldbuilding ?? '',
    library: row.library ?? '',
    sortOrder: row.sort_order,
    archived: row.archived,
  }
}

function mapChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    novelId: row.novel_id,
    title: row.title,
    outline: row.outline,
    content: row.content,
    status: row.status,
    sortOrder: row.sort_order,
  }
}

function mapCharacter(row: CharacterRow): CharacterCard {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender ?? '',
    background: row.background ?? '',
    personality: row.personality ?? '',
    goal: row.goal ?? '',
    secret: row.secret ?? '',
  }
}

function mapPreferenceNote(row: PreferenceNoteRow): PreferenceNote {
  return {
    id: row.id,
    novelId: row.novel_id,
    kind: row.kind,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export function mapChapterSummary(row: ChapterSummaryRow): ChapterSummary {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterId: row.chapter_id,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMemoryCandidate(row: MemoryCandidateRow): MemoryCandidate {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterId: row.chapter_id,
    kind: row.kind as MemoryKind,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    tags: row.tags ?? [],
    sourceExcerpt: row.source_excerpt,
    importance: row.importance,
    status: row.status as MemoryCandidateStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMemoryItem(row: MemoryItemRow): MemoryItem {
  return {
    id: row.id,
    novelId: row.novel_id,
    kind: row.kind as MemoryKind,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    tags: row.tags ?? [],
    sourceChapterId: row.source_chapter_id,
    sourceExcerpt: row.source_excerpt,
    importance: row.importance,
    status: row.status as MemoryItemStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTimelineEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    marker: row.marker,
    title: row.title,
    description: row.description,
    impact: row.impact,
  }
}

function mapInspirationMessage(row: InspirationMessageRow): InspirationMessage {
  return {
    id: row.id,
    novelId: row.novel_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
  }
}
