export const config = {
  runtime: 'edge',
}

declare const process: {
  env: {
    OPENAI_API_KEY?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

interface AcceptMemoryCandidateRequest {
  candidateId: string
  novelId?: string
  chapterId?: string
  kind?: string
  title?: string
  summary?: string
  detail?: string
  tags?: string[]
  sourceExcerpt?: string
  importance?: number
  embeddingModel: string
  embeddingDimensions: number
}

interface AcceptedMemoryDraft {
  novelId: string
  chapterId: string
  kind: string
  title: string
  summary: string
  detail: string
  tags: string[]
  sourceExcerpt: string
  importance: number
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

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405)
  }

  try {
    const payload = (await request.json()) as AcceptMemoryCandidateRequest
    const access = await getRequestAccess(request)

    if (access.kind === 'error') {
      return jsonResponse({ error: access.message }, access.status)
    }

    const candidate = await fetchPendingCandidate(
      access.supabaseUrl,
      access.serviceRoleKey,
      access.user.id,
      payload.candidateId,
    )

    if (!candidate) {
      return jsonResponse({ error: '权限失败：候选不存在、不属于当前用户，或已经被处理。' }, 409)
    }

    const draft = buildAcceptedDraft(candidate, payload)
    const embedding = await createEmbedding(draft, payload)
    const item = await insertMemoryItem(access.supabaseUrl, access.serviceRoleKey, access.user.id, draft, embedding)
    await updateCandidateStatus(access.supabaseUrl, access.serviceRoleKey, access.user.id, payload.candidateId)

    return jsonResponse({ item: mapMemoryItem(item), candidateId: payload.candidateId }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : '数据库失败：确认长期记忆失败。'
    return jsonResponse({ error: message }, 500)
  }
}

async function createEmbedding(draft: AcceptedMemoryDraft, payload: AcceptMemoryCandidateRequest): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) throw new Error('配置缺失：缺少 OPENAI_API_KEY，无法为正式记忆生成 embedding。')

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: payload.embeddingModel || 'text-embedding-3-small',
      input: [draft.title, draft.summary, draft.detail, draft.tags.join(' ')].join('\n'),
      dimensions: payload.embeddingDimensions || 1536,
    }),
  })

  if (!response.ok) throw new Error(`模型失败：${await response.text()}`)

  const result = (await response.json()) as { data?: Array<{ embedding?: number[] }> }
  return result.data?.[0]?.embedding ?? []
}

async function insertMemoryItem(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  draft: AcceptedMemoryDraft,
  embedding: number[],
): Promise<MemoryItemRow> {
  const response = await fetch(`${supabaseUrl}/rest/v1/memory_items`, {
    method: 'POST',
    headers: restHeaders(serviceRoleKey, 'return=representation'),
    body: JSON.stringify({
      user_id: userId,
      novel_id: draft.novelId,
      kind: draft.kind,
      title: draft.title,
      summary: draft.summary,
      detail: draft.detail,
      tags: draft.tags,
      source_chapter_id: draft.chapterId,
      source_excerpt: draft.sourceExcerpt,
      importance: draft.importance,
      status: 'active',
      embedding: `[${embedding.join(',')}]`,
    }),
  })

  if (!response.ok) throw new Error(`数据库失败：${await response.text()}`)

  const rows = (await response.json()) as MemoryItemRow[]
  return rows[0]
}

async function updateCandidateStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  candidateId: string,
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/memory_candidates?id=eq.${candidateId}&user_id=eq.${userId}&status=eq.pending`,
    {
    method: 'PATCH',
    headers: restHeaders(serviceRoleKey, 'return=minimal'),
    body: JSON.stringify({ status: 'accepted' }),
    },
  )

  if (!response.ok) throw new Error(`数据库失败：${await response.text()}`)
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

async function fetchPendingCandidate(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  candidateId: string,
): Promise<MemoryCandidateRow | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/memory_candidates?id=eq.${candidateId}&user_id=eq.${userId}&status=eq.pending&select=*&limit=1`,
    {
      headers: restHeaders(serviceRoleKey, 'return=minimal'),
    },
  )

  if (!response.ok) throw new Error(`数据库失败：${await response.text()}`)

  const rows = (await response.json()) as MemoryCandidateRow[]
  return rows[0] ?? null
}

function buildAcceptedDraft(candidate: MemoryCandidateRow, payload: AcceptMemoryCandidateRequest): AcceptedMemoryDraft {
  return {
    novelId: candidate.novel_id,
    chapterId: candidate.chapter_id,
    kind: payload.kind || candidate.kind,
    title: payload.title || candidate.title,
    summary: payload.summary || candidate.summary,
    detail: payload.detail || candidate.detail,
    tags: payload.tags ?? candidate.tags ?? [],
    sourceExcerpt: payload.sourceExcerpt || candidate.source_excerpt,
    importance: payload.importance ?? candidate.importance,
  }
}

function restHeaders(serviceRoleKey: string, prefer: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  }
}

function mapMemoryItem(row: MemoryItemRow) {
  return {
    id: row.id,
    novelId: row.novel_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    tags: row.tags ?? [],
    sourceChapterId: row.source_chapter_id,
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

interface MemoryItemRow {
  id: string
  novel_id: string
  kind: string
  title: string
  summary: string
  detail: string
  tags: string[]
  source_chapter_id: string | null
  source_excerpt: string
  importance: number
  status: string
  created_at: string
  updated_at: string
}

interface MemoryCandidateRow {
  id: string
  user_id: string
  novel_id: string
  chapter_id: string
  kind: string
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
