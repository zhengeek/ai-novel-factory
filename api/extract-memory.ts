export const config = {
  runtime: 'edge',
}

declare const process: {
  env: {
    DEEPSEEK_API_KEY?: string
    OPENAI_API_KEY?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

type CandidateProvider = 'deepseek' | 'openai'
type MemoryKind = 'character' | 'location' | 'organization' | 'item_or_ability' | 'foreshadowing'

interface ExtractMemoryRequest {
  novelId: string
  chapterId: string
  chapterTitle: string
  chapterOutline: string
  chapterContent: string
  provider: CandidateProvider
  openaiCandidateModel: string
}

interface MemoryCandidateDraft {
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  sourceExcerpt: string
  importance: number
}

interface ExtractionResult {
  chapterSummary: string
  candidates: MemoryCandidateDraft[]
}

interface RequestAccess {
  kind: 'ok'
  supabaseUrl: string
  serviceRoleKey: string
  user: { id: string }
}

interface RequestAccessError {
  kind: 'error'
  status: number
  message: string
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405)
  }

  try {
    const payload = (await request.json()) as ExtractMemoryRequest
    const access = await getRequestAccess(request)

    if (access.kind === 'error') {
      return jsonResponse({ error: access.message }, access.status)
    }

    const canAccessChapter = await userOwnsChapter(
      access.supabaseUrl,
      access.serviceRoleKey,
      access.user.id,
      payload.novelId,
      payload.chapterId,
    )

    if (!canAccessChapter) {
      return jsonResponse({ error: '权限失败：无权为该章节抽取长期记忆。' }, 403)
    }

    const extraction = await extractMemory(payload)
    const summaryRow = await upsertChapterSummary(
      access.supabaseUrl,
      access.serviceRoleKey,
      access.user.id,
      payload,
      extraction.chapterSummary,
    )
    const candidateRows = await insertMemoryCandidates(
      access.supabaseUrl,
      access.serviceRoleKey,
      access.user.id,
      payload,
      extraction.candidates,
    )

    return jsonResponse({ summary: mapSummary(summaryRow), candidates: candidateRows.map(mapCandidate) }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : '模型失败：记忆抽取失败。'
    return jsonResponse({ error: message }, 500)
  }
}

async function extractMemory(payload: ExtractMemoryRequest): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(payload)

  if (payload.provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) throw new Error('缺少 OPENAI_API_KEY，无法使用 OpenAI 生成记忆候选。')

    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: payload.openaiCandidateModel || 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: '你是中文长篇小说的记忆整理助手，只输出合法 JSON。' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    return parseModelExtraction(await readModelText(response))
  }

  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY，无法生成记忆候选。')

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: false,
      thinking: { type: 'disabled' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: '你是中文长篇小说的记忆整理助手，只输出合法 JSON。' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  return parseModelExtraction(await readModelText(response))
}

async function readModelText(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`模型失败：${await response.text()}`)

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  return payload.choices?.[0]?.message?.content ?? ''
}

function parseModelExtraction(text: string): ExtractionResult {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Partial<ExtractionResult>

  return {
    chapterSummary: String(parsed.chapterSummary ?? '').slice(0, 2000),
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates.map(normalizeCandidate).slice(0, 12) : [],
  }
}

function normalizeCandidate(candidate: Partial<MemoryCandidateDraft>): MemoryCandidateDraft {
  const kind = isMemoryKind(candidate.kind) ? candidate.kind : 'foreshadowing'
  const importance = Number(candidate.importance)

  return {
    kind,
    title: String(candidate.title ?? '').slice(0, 120),
    summary: String(candidate.summary ?? '').slice(0, 500),
    detail: String(candidate.detail ?? '').slice(0, 1500),
    tags: Array.isArray(candidate.tags) ? candidate.tags.map(String).slice(0, 8) : [],
    sourceExcerpt: String(candidate.sourceExcerpt ?? '').slice(0, 500),
    importance: Number.isFinite(importance) ? Math.min(5, Math.max(1, Math.round(importance))) : 3,
  }
}

function isMemoryKind(value: unknown): value is MemoryKind {
  return value === 'character' || value === 'location' || value === 'organization' || value === 'item_or_ability' || value === 'foreshadowing'
}

function buildExtractionPrompt(payload: ExtractMemoryRequest): string {
  return [
    '请从以下已采用的章节正文中生成长期记忆。',
    '只输出 JSON，格式：{"chapterSummary":"...","candidates":[{"kind":"character|location|organization|item_or_ability|foreshadowing","title":"...","summary":"...","detail":"...","tags":["..."],"sourceExcerpt":"...","importance":1-5}]}',
    '要求：',
    '1. chapterSummary 用 300-800 字概括本章事实、人物状态变化和伏笔推进。',
    '2. candidates 只抽取后续章节可能需要记住的事实，不要记录失败样稿或写作过程。',
    '3. sourceExcerpt 必须来自正文原文的短摘录。',
    '',
    `章节标题：${payload.chapterTitle}`,
    `章节大纲：${payload.chapterOutline || '暂无'}`,
    '',
    '章节正文：',
    payload.chapterContent.slice(0, 30000),
  ].join('\n')
}

async function upsertChapterSummary(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  payload: ExtractMemoryRequest,
  summary: string,
): Promise<ChapterSummaryRow> {
  const response = await fetch(`${supabaseUrl}/rest/v1/chapter_summaries?on_conflict=chapter_id`, {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify({
      user_id: userId,
      novel_id: payload.novelId,
      chapter_id: payload.chapterId,
      summary,
    }),
  })

  if (!response.ok) throw new Error(`数据库失败：${await response.text()}`)

  const rows = (await response.json()) as ChapterSummaryRow[]
  return rows[0]
}

async function insertMemoryCandidates(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  payload: ExtractMemoryRequest,
  candidates: MemoryCandidateDraft[],
): Promise<MemoryCandidateRow[]> {
  if (!candidates.length) return []

  const response = await fetch(`${supabaseUrl}/rest/v1/memory_candidates`, {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, 'return=representation'),
    body: JSON.stringify(
      candidates.map((candidate) => ({
        user_id: userId,
        novel_id: payload.novelId,
        chapter_id: payload.chapterId,
        kind: candidate.kind,
        title: candidate.title,
        summary: candidate.summary,
        detail: candidate.detail,
        tags: candidate.tags,
        source_excerpt: candidate.sourceExcerpt,
        importance: candidate.importance,
        status: 'pending',
      })),
    ),
  })

  if (!response.ok) throw new Error(`数据库失败：${await response.text()}`)

  return (await response.json()) as MemoryCandidateRow[]
}

async function fetchAuthenticatedUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  authHeader: string,
): Promise<{ id: string } | null> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: authHeader,
    },
  })

  if (!response.ok) return null

  return (await response.json()) as { id: string }
}

async function getRequestAccess(request: Request): Promise<RequestAccess | RequestAccessError> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('Authorization')

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return { kind: 'error', status: 500, message: '配置缺失：缺少 Supabase 服务端配置或登录凭证。' }
  }

  const user = await fetchAuthenticatedUser(supabaseUrl, serviceRoleKey, authHeader)

  if (!user?.id) {
    return { kind: 'error', status: 401, message: '权限失败：用户未登录。' }
  }

  return { kind: 'ok', supabaseUrl, serviceRoleKey, user }
}

async function userOwnsChapter(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  novelId: string,
  chapterId: string,
): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/chapters?id=eq.${chapterId}&novel_id=eq.${novelId}&user_id=eq.${userId}&select=id&limit=1`,
    { headers: restHeaders(serviceRoleKey, 'return=minimal') },
  )

  if (!response.ok) return false

  const rows = (await response.json()) as Array<{ id: string }>
  return rows.length > 0
}

function restHeaders(serviceRoleKey: string, prefer: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  }
}

function mapSummary(row: ChapterSummaryRow) {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterId: row.chapter_id,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCandidate(row: MemoryCandidateRow) {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterId: row.chapter_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    tags: row.tags ?? [],
    sourceExcerpt: row.source_excerpt,
    importance: row.importance,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function jsonResponse(payload: object, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

interface ChapterSummaryRow {
  id: string
  novel_id: string
  chapter_id: string
  summary: string
  created_at: string
  updated_at: string
}

interface MemoryCandidateRow {
  id: string
  novel_id: string
  chapter_id: string
  kind: MemoryKind
  title: string
  summary: string
  detail: string
  tags: string[]
  source_excerpt: string
  importance: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
}
