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

interface CharacterCard {
  name: string
  gender: string
  background: string
  personality: string
  goal: string
  secret: string
}

interface TimelineEvent {
  marker: string
  title: string
  description: string
  impact: string
}

interface InspirationMessage {
  author: 'user' | 'assistant'
  content: string
}

interface PreferenceNote {
  kind: 'like' | 'avoid' | 'style'
  content: string
}

interface GenerateChapterRequest {
  novelId?: string
  chapterId?: string
  title: string
  globalSetting: string
  worldbuilding: string
  library: string
  chapterOutline: string
  characters: CharacterCard[]
  preferenceNotes: PreferenceNote[]
  timelineEvents: TimelineEvent[]
  inspirationMessages: InspirationMessage[]
}

interface MemoryContextItem {
  kind: string
  title: string
  summary: string
  detail: string
  tags: string[]
  importance: number
}

type RecallMode = 'disabled' | 'vector' | 'keyword' | 'fallback'

interface ContextBundle {
  enabled: boolean
  summaries: string[]
  memories: MemoryContextItem[]
  recallMode: RecallMode
}

interface DeepSeekUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

interface RequestAccess {
  kind: 'ok'
  supabaseUrl: string
  serviceRoleKey: string
  authHeader: string
  user: { id: string }
}

interface RequestAccessError {
  kind: 'error'
  status: number
  message: string
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405)
  }

  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return jsonResponse({ error: '缺少 DEEPSEEK_API_KEY。请在 Vercel 环境变量中配置后重新部署。' }, 500)
  }

  try {
    const payload = (await request.json()) as GenerateChapterRequest
    const access = await getRequestAccess(request)

    if (access.kind === 'error') {
      return jsonResponse({ error: access.message }, access.status)
    }

    if (payload.novelId && !(await userOwnsNovel(access.supabaseUrl, access.serviceRoleKey, access.user.id, payload.novelId))) {
      return jsonResponse({ error: 'No permission to generate for this novel.' }, 403)
    }

    if (
      payload.chapterId &&
      payload.novelId &&
      !(await userOwnsChapter(access.supabaseUrl, access.serviceRoleKey, access.user.id, payload.novelId, payload.chapterId))
    ) {
      return jsonResponse({ error: 'No permission to generate for this chapter.' }, 403)
    }

    const contextBundle = await buildContextBundle(payload, access)

    const deepseekResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        stream: true,
        stream_options: {
          include_usage: true,
        },
        thinking: {
          type: 'disabled',
        },
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content:
              '你是一名擅长中文网络小说连载的正文写作助手。请根据设定、大纲、人物卡、世界观、资料库和作者偏好输出可直接使用的章节正文，保持节奏强、画面清晰、钩子明确。不要解释创作过程。',
          },
          {
            role: 'user',
            content: buildPrompt(payload, contextBundle),
          },
        ],
      }),
    })

    if (!deepseekResponse.ok || !deepseekResponse.body) {
      const errorText = await deepseekResponse.text()
      const errorMessage = errorText || `DeepSeek 请求失败，状态码 ${deepseekResponse.status}。`

      void writeGenerationRun(payload, request, {
        status: 'error',
        outputPreview: '',
        usage: null,
        errorMessage,
        contextBundle,
      })

      return jsonResponse({ error: errorMessage }, deepseekResponse.status)
    }

    return new Response(streamAndCaptureUsage(deepseekResponse.body, payload, request, contextBundle), {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    })
  } catch {
    return jsonResponse({ error: '请求格式错误或服务端生成失败。' }, 400)
  }
}

function streamAndCaptureUsage(
  body: ReadableStream<Uint8Array>,
  payload: GenerateChapterRequest,
  request: Request,
  contextBundle: ContextBundle,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let output = ''
  let usage: DeepSeekUsage | null = null

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()

      if (done) {
        buffer += decoder.decode()
        parseStreamBuffer(
          buffer,
          (content) => {
            output += content
          },
          (nextUsage) => {
            usage = nextUsage
          },
        )

        controller.close()
        void writeGenerationRun(payload, request, {
          status: 'success',
          outputPreview: output.slice(0, 500),
          usage,
          errorMessage: null,
          contextBundle,
        })
        return
      }

      controller.enqueue(value)
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        parseStreamLine(
          line,
          (content) => {
            output += content
          },
          (nextUsage) => {
            usage = nextUsage
          },
        )
      }
    },
    async cancel() {
      await reader.cancel()
    },
  })
}

function parseStreamBuffer(
  buffer: string,
  onContent: (content: string) => void,
  onUsage: (usage: DeepSeekUsage) => void,
): void {
  for (const line of buffer.split('\n')) {
    parseStreamLine(line, onContent, onUsage)
  }
}

function parseStreamLine(
  line: string,
  onContent: (content: string) => void,
  onUsage: (usage: DeepSeekUsage) => void,
): void {
  if (!line.startsWith('data:')) return

  const data = line.replace(/^data:\s*/, '')

  if (!data || data === '[DONE]') return

  try {
    const payload = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: string
        }
      }>
      usage?: DeepSeekUsage
    }

    const content = payload.choices?.[0]?.delta?.content

    if (content) onContent(content)
    if (payload.usage) onUsage(payload.usage)
  } catch {
    // Malformed SSE lines are ignored for logging, while the raw stream is still passed to the client.
  }
}

async function writeGenerationRun(
  payload: GenerateChapterRequest,
  request: Request,
  run: {
    status: 'success' | 'error'
    outputPreview: string
    usage: DeepSeekUsage | null
    errorMessage: string | null
    contextBundle: ContextBundle
  },
): Promise<void> {
  try {
    if (!payload.novelId) return

    const access = await getRequestAccess(request)

    if (access.kind === 'error') return

    if (!(await userOwnsNovel(access.supabaseUrl, access.serviceRoleKey, access.user.id, payload.novelId))) return

    if (
      payload.chapterId &&
      !(await userOwnsChapter(access.supabaseUrl, access.serviceRoleKey, access.user.id, payload.novelId, payload.chapterId))
    ) {
      return
    }

    await fetch(`${access.supabaseUrl}/rest/v1/generation_runs`, {
      method: 'POST',
      headers: {
        apikey: access.serviceRoleKey,
        Authorization: `Bearer ${access.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: access.user.id,
        novel_id: payload.novelId,
        chapter_id: payload.chapterId || null,
        model: DEEPSEEK_MODEL,
        status: run.status,
        input_summary: buildInputSummary(payload, run.contextBundle),
        output_preview: run.outputPreview,
        prompt_tokens: run.usage?.prompt_tokens ?? 0,
        completion_tokens: run.usage?.completion_tokens ?? 0,
        total_tokens: run.usage?.total_tokens ?? 0,
        prompt_cache_hit_tokens: run.usage?.prompt_cache_hit_tokens ?? 0,
        prompt_cache_miss_tokens: run.usage?.prompt_cache_miss_tokens ?? 0,
        error_message: run.errorMessage,
      }),
    })
  } catch {
    // Generation logging is best-effort and must never break streaming output.
  }
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
    return { kind: 'error', status: 500, message: '缺少 Supabase 服务端配置或登录凭证。' }
  }

  const user = await fetchAuthenticatedUser(supabaseUrl, serviceRoleKey, authHeader)

  if (!user?.id) {
    return { kind: 'error', status: 401, message: '用户未登录。' }
  }

  return { kind: 'ok', supabaseUrl, serviceRoleKey, authHeader, user }
}

async function userOwnsNovel(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  novelId: string,
): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/novels?id=eq.${novelId}&user_id=eq.${userId}&select=id&limit=1`,
    { headers: restHeaders(serviceRoleKey) },
  )

  if (!response.ok) return false

  const rows = (await response.json()) as Array<{ id: string }>
  return rows.length > 0
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
    { headers: restHeaders(serviceRoleKey) },
  )

  if (!response.ok) return false

  const rows = (await response.json()) as Array<{ id: string }>
  return rows.length > 0
}

async function buildContextBundle(payload: GenerateChapterRequest, access: RequestAccess): Promise<ContextBundle> {
  const emptyBundle: ContextBundle = { enabled: false, summaries: [], memories: [], recallMode: 'disabled' }

  try {
    if (!payload.novelId) return emptyBundle

    const settings = await fetchUserSettings(access.supabaseUrl, access.serviceRoleKey, access.user.id)

    if (!settings.memory_injection_enabled) return emptyBundle

    const query = buildMemoryQuery(payload)
    const [summaries, keywordMemories, vectorMemories] = await Promise.all([
      fetchChapterSummaries(access.supabaseUrl, access.serviceRoleKey, payload.novelId),
      fetchKeywordMemories(access.supabaseUrl, access.serviceRoleKey, payload.novelId),
      fetchVectorMemories(
        access.supabaseUrl,
        access.serviceRoleKey,
        payload.novelId,
        query,
        settings.embedding_model,
        settings.embedding_dimensions,
      ),
    ])
    const memories = mergeMemories(keywordMemories, vectorMemories, query).slice(0, 12)
    const recallMode: RecallMode = vectorMemories.length > 0 ? 'vector' : memories.length > 0 ? 'keyword' : 'fallback'

    return {
      enabled: true,
      summaries: summaries.slice(0, 8),
      memories,
      recallMode,
    }
  } catch {
    return emptyBundle
  }
}

async function fetchUserSettings(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<{
  memory_injection_enabled: boolean
  embedding_model: string
  embedding_dimensions: number
}> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_settings?user_id=eq.${userId}&select=memory_injection_enabled,embedding_model,embedding_dimensions&limit=1`,
    {
      headers: restHeaders(serviceRoleKey),
    },
  )

  if (!response.ok) throw new Error(await response.text())

  const rows = (await response.json()) as Array<{
    memory_injection_enabled?: boolean
    embedding_model?: string
    embedding_dimensions?: number
  }>

  return {
    memory_injection_enabled: rows[0]?.memory_injection_enabled ?? true,
    embedding_model: rows[0]?.embedding_model ?? 'text-embedding-3-small',
    embedding_dimensions: rows[0]?.embedding_dimensions ?? 1536,
  }
}

async function fetchChapterSummaries(
  supabaseUrl: string,
  serviceRoleKey: string,
  novelId: string,
): Promise<string[]> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/chapter_summaries?novel_id=eq.${novelId}&select=summary,created_at&order=created_at.desc&limit=8`,
    {
      headers: restHeaders(serviceRoleKey),
    },
  )

  if (!response.ok) throw new Error(await response.text())

  const rows = (await response.json()) as Array<{ summary: string }>
  return rows.map((row) => row.summary).filter(Boolean)
}

async function fetchKeywordMemories(
  supabaseUrl: string,
  serviceRoleKey: string,
  novelId: string,
): Promise<MemoryContextItem[]> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/memory_items?novel_id=eq.${novelId}&status=eq.active&select=kind,title,summary,detail,tags,importance&order=importance.desc&limit=80`,
    {
      headers: restHeaders(serviceRoleKey),
    },
  )

  if (!response.ok) throw new Error(await response.text())

  return ((await response.json()) as MemoryContextItem[]).map(normalizeMemory)
}

async function fetchVectorMemories(
  supabaseUrl: string,
  serviceRoleKey: string,
  novelId: string,
  query: string,
  embeddingModel: string,
  embeddingDimensions: number,
): Promise<MemoryContextItem[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey || !query.trim()) return []

  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: embeddingModel || 'text-embedding-3-small',
      input: query,
      dimensions: embeddingDimensions || 1536,
    }),
  })

  if (!embeddingResponse.ok) return []

  const embeddingPayload = (await embeddingResponse.json()) as { data?: Array<{ embedding?: number[] }> }
  const embedding = embeddingPayload.data?.[0]?.embedding

  if (!embedding?.length) return []

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/match_memory_items`, {
    method: 'POST',
    headers: restHeaders(serviceRoleKey),
    body: JSON.stringify({
      query_embedding: `[${embedding.join(',')}]`,
      query_novel_id: novelId,
      match_count: 12,
    }),
  })

  if (!response.ok) return []

  return ((await response.json()) as MemoryContextItem[]).map(normalizeMemory)
}

function buildMemoryQuery(payload: GenerateChapterRequest): string {
  return [
    payload.title,
    payload.chapterOutline,
    payload.characters.map((character) => character.name).join(' '),
    payload.preferenceNotes.map((note) => note.content).join(' '),
  ].join('\n')
}

function mergeMemories(
  keywordMemories: MemoryContextItem[],
  vectorMemories: MemoryContextItem[],
  query: string,
): MemoryContextItem[] {
  const queryTerms = query
    .split(/\s|，|。|、|：|；|,|\.|:|;/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2)
  const memoryMap = new Map<string, { memory: MemoryContextItem; score: number }>()

  for (const [index, memory] of vectorMemories.entries()) {
    memoryMap.set(memory.title, { memory, score: 100 - index + memory.importance * 3 })
  }

  for (const memory of keywordMemories) {
    const haystack = [memory.title, memory.summary, memory.detail, memory.tags.join(' ')].join(' ').toLowerCase()
    const keywordScore = queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
    const isRelevantFallback = keywordScore > 0 || memory.importance >= 5

    if (!isRelevantFallback) continue

    const score = keywordScore * 10 + memory.importance * 3
    const current = memoryMap.get(memory.title)

    if (!current || current.score < score) {
      memoryMap.set(memory.title, { memory, score })
    }
  }

  return Array.from(memoryMap.values())
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.memory)
}

function normalizeMemory(memory: MemoryContextItem): MemoryContextItem {
  return {
    kind: memory.kind,
    title: memory.title,
    summary: memory.summary,
    detail: memory.detail,
    tags: memory.tags ?? [],
    importance: memory.importance ?? 3,
  }
}

function restHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

function buildInputSummary(payload: GenerateChapterRequest, contextBundle: ContextBundle): string {
  return [
    `小说：${payload.title}`,
    `设定字数：${payload.globalSetting.length}`,
    `世界观字数：${payload.worldbuilding.length}`,
    `资料库字数：${payload.library.length}`,
    `大纲字数：${payload.chapterOutline.length}`,
    `人物卡：${payload.characters.length}`,
    `偏好/避雷：${payload.preferenceNotes?.length ?? 0}`,
    `时间线：${payload.timelineEvents.length}`,
    `灵感消息：${payload.inspirationMessages.length}`,
    `长期记忆注入：${contextBundle.enabled ? '开启' : '关闭'}`,
    `召回模式：${contextBundle.recallMode}`,
    `章节摘要：${contextBundle.summaries.length}`,
    `召回记忆：${contextBundle.memories.length}`,
  ].join(' | ')
}

function buildPrompt(payload: GenerateChapterRequest, contextBundle: ContextBundle): string {
  return [
    `小说标题：${payload.title}`,
    '',
    '【全局设定】',
    payload.globalSetting || '暂无',
    '',
    '【世界观】',
    payload.worldbuilding || '暂无',
    '',
    '【资料库】',
    payload.library || '暂无',
    '',
    '【本章大纲】',
    payload.chapterOutline || '暂无',
    '',
    '【人物卡】',
    formatCharacters(payload.characters),
    '',
    '【偏好/避雷】',
    formatPreferenceNotes(payload.preferenceNotes),
    '',
    '【长期记忆召回】',
    formatContextBundle(contextBundle),
    '',
    '【时间线】',
    formatTimeline(payload.timelineEvents),
    '',
    '【灵感记录】',
    formatInspirations(payload.inspirationMessages),
    '',
    '请写出本章正文。要求：',
    '1. 直接输出正文，不要写标题、提纲、解释或项目符号。',
    '2. 优先遵守本章大纲，同时参考世界观、资料库、人物卡、偏好/避雷、长期记忆和时间线保持连续性。',
    '3. 人物行为必须符合人物卡中的性格、目标、背景和秘密。',
    '4. 结尾保留适合网文连载的悬念或推进力。',
  ].join('\n')
}

function formatCharacters(characters: CharacterCard[]): string {
  if (!characters.length) return '暂无'

  return characters
    .map(
      (character) =>
        `- 姓名：${character.name || '未命名角色'}｜性别：${character.gender || '未填'}｜身份与背景：${
          character.background || '未填'
        }｜性格与行为模式：${character.personality || '未填'}｜目标与当前欲望：${
          character.goal || '未填'
        }｜秘密：${character.secret || '未填'}`,
    )
    .join('\n')
}

function formatPreferenceNotes(notes: PreferenceNote[] = []): string {
  if (!notes.length) return '暂无'

  const labels: Record<PreferenceNote['kind'], string> = {
    like: '喜欢',
    avoid: '避雷',
    style: '风格',
  }

  return notes.map((note) => `- ${labels[note.kind]}：${note.content || '未填'}`).join('\n')
}

function formatContextBundle(contextBundle: ContextBundle): string {
  if (!contextBundle.enabled) return '未启用长期记忆注入'

  const sections: string[] = []

  if (contextBundle.summaries.length) {
    sections.push('章节摘要：')
    sections.push(...contextBundle.summaries.map((summary, index) => `${index + 1}. ${summary}`))
  }

  if (contextBundle.memories.length) {
    sections.push('正式记忆：')
    sections.push(
      ...contextBundle.memories.map(
        (memory) =>
          `- [${memory.kind}][重要度${memory.importance}] ${memory.title}：${memory.summary}；细节：${memory.detail || '暂无'}；标签：${
            memory.tags.length ? memory.tags.join('、') : '暂无'
          }`,
      ),
    )
  }

  return sections.length ? sections.join('\n') : '暂无可用长期记忆'
}

function formatTimeline(events: TimelineEvent[]): string {
  if (!events.length) return '暂无'

  return events
    .map(
      (event) =>
        `- ${event.marker || '未标记'}｜${event.title || '未命名事件'}：${
          event.description || '未填'
        }｜影响：${event.impact || '未填'}`,
    )
    .join('\n')
}

function formatInspirations(messages: InspirationMessage[]): string {
  if (!messages.length) return '暂无'

  return messages.map((message) => `- ${message.author === 'assistant' ? 'AI' : '用户'}：${message.content}`).join('\n')
}

function jsonResponse(payload: { error: string }, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
