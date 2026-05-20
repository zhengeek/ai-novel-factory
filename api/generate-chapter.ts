export const config = {
  runtime: 'edge',
}

declare const process: {
  env: {
    DEEPSEEK_API_KEY?: string
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

interface GenerateChapterRequest {
  novelId?: string
  chapterId?: string
  title: string
  globalSetting: string
  worldbuilding: string
  library: string
  chapterOutline: string
  characters: CharacterCard[]
  timelineEvents: TimelineEvent[]
  inspirationMessages: InspirationMessage[]
}

interface DeepSeekUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
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
              '你是一名擅长中文网络小说连载的正文写作助手。请根据设定、大纲、人物卡、世界观和资料库输出可直接使用的章节正文，保持节奏强、画面清晰、钩子明确。不要解释创作过程。',
          },
          {
            role: 'user',
            content: buildPrompt(payload),
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
      })

      return jsonResponse({ error: errorMessage }, deepseekResponse.status)
    }

    return new Response(streamAndCaptureUsage(deepseekResponse.body, payload, request), {
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
  },
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const authHeader = request.headers.get('Authorization')

    if (!supabaseUrl || !serviceRoleKey || !authHeader || !payload.novelId) return

    const user = await fetchAuthenticatedUser(supabaseUrl, serviceRoleKey, authHeader)

    if (!user?.id) return

    await fetch(`${supabaseUrl}/rest/v1/generation_runs`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: user.id,
        novel_id: payload.novelId,
        chapter_id: payload.chapterId || null,
        model: DEEPSEEK_MODEL,
        status: run.status,
        input_summary: buildInputSummary(payload),
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

function buildInputSummary(payload: GenerateChapterRequest): string {
  return [
    `小说：${payload.title}`,
    `设定字数：${payload.globalSetting.length}`,
    `世界观字数：${payload.worldbuilding.length}`,
    `资料库字数：${payload.library.length}`,
    `大纲字数：${payload.chapterOutline.length}`,
    `人物卡：${payload.characters.length}`,
    `时间线：${payload.timelineEvents.length}`,
    `灵感消息：${payload.inspirationMessages.length}`,
  ].join(' | ')
}

function buildPrompt(payload: GenerateChapterRequest): string {
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
    '【时间线】',
    formatTimeline(payload.timelineEvents),
    '',
    '【灵感记录】',
    formatInspirations(payload.inspirationMessages),
    '',
    '请写出本章正文。要求：',
    '1. 直接输出正文，不要写标题、提纲、解释或项目符号。',
    '2. 优先遵守本章大纲，同时利用世界观、资料库、人物卡和时间线保持连续性。',
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
