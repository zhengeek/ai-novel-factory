import { supabase } from './supabaseClient'
import type { Chapter, CharacterCard, InspirationMessage, NovelProject, TimelineEvent } from '../types/novel'
import type { ChapterRow, CharacterRow, InspirationMessageRow, NovelRow, TimelineEventRow } from '../types/supabase'

export interface CloudWorkspace {
  novels: NovelProject[]
}

export async function loadWorkspace(): Promise<CloudWorkspace> {
  const { data: novelRows, error: novelsError } = await supabase
    .from('novels')
    .select('*')
    .eq('archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (novelsError) throw novelsError

  const novels = await Promise.all((novelRows ?? []).map(loadNovelDetails))

  return { novels }
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
    const timelineEvents = await importTimelineEvents(userId, novelRow.id, novel.timelineEvents)
    const inspirationMessages = await importInspirationMessages(userId, novelRow.id, novel.inspirationMessages)

    imported.push({
      ...mapNovel(novelRow),
      chapters,
      characters,
      timelineEvents,
      inspirationMessages,
    })
  }

  return imported
}

async function loadNovelDetails(row: NovelRow): Promise<NovelProject> {
  const [chapters, characters, timelineEvents, inspirationMessages] = await Promise.all([
    loadChapters(row.id),
    loadCharacters(row.id),
    loadTimelineEvents(row.id),
    loadInspirationMessages(row.id),
  ])

  return {
    ...mapNovel(row),
    chapters,
    characters,
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

async function importTimelineEvents(
  userId: string,
  novelId: string,
  events: TimelineEvent[],
): Promise<TimelineEvent[]> {
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

function mapNovel(row: NovelRow): Omit<NovelProject, 'chapters' | 'characters' | 'timelineEvents' | 'inspirationMessages'> {
  return {
    id: row.id,
    title: row.title,
    globalSetting: row.global_setting,
    worldbuilding: row.worldbuilding,
    library: row.library,
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
    gender: row.gender,
    background: row.background,
    personality: row.personality,
    goal: row.goal,
    secret: row.secret,
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
