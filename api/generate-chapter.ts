export const config = {
  runtime: 'edge',
}

declare const process: {
  env: {
    DEEPSEEK_API_KEY?: string
  }
}

interface CharacterCard {
  name: string
  role: string
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
  title: string
  globalSetting: string
  chapterOutline: string
  characters: CharacterCard[]
  timelineEvents: TimelineEvent[]
  inspirationMessages: InspirationMessage[]
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

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
        model: 'deepseek-v4-flash',
        stream: true,
        thinking: {
          type: 'disabled',
        },
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content:
              '你是一名擅长中文网络小说连载的正文写作助手。请根据设定和大纲输出可直接使用的章节正文，保持节奏强、画面清晰、钩子明确。不要解释创作过程。',
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
      return jsonResponse(
        {
          error: errorText || `DeepSeek 请求失败，状态码 ${deepseekResponse.status}。`,
        },
        deepseekResponse.status,
      )
    }

    return new Response(deepseekResponse.body, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    })
  } catch {
    return jsonResponse({ error: '请求格式错误或服务端生成失败。' }, 400)
  }
}

function buildPrompt(payload: GenerateChapterRequest): string {
  return [
    `小说标题：${payload.title}`,
    '',
    '【全局设定】',
    payload.globalSetting || '暂无',
    '',
    '【本章大纲】',
    payload.chapterOutline || '暂无',
    '',
    '【人物卡】',
    formatCharacters(payload.characters),
    '',
    '【时间轴】',
    formatTimeline(payload.timelineEvents),
    '',
    '【灵感记录】',
    formatInspirations(payload.inspirationMessages),
    '',
    '请写出本章正文。要求：',
    '1. 直接输出正文，不要写标题、提纲、解释或项目符号。',
    '2. 优先遵守本章大纲，同时利用人物卡和时间轴保持连续性。',
    '3. 结尾保留适合网文连载的悬念或推进力。',
  ].join('\n')
}

function formatCharacters(characters: CharacterCard[]): string {
  if (!characters.length) return '暂无'

  return characters
    .map(
      (character) =>
        `- ${character.name || '未命名角色'}｜身份：${character.role || '未填'}｜性格：${
          character.personality || '未填'
        }｜目标：${character.goal || '未填'}｜秘密：${character.secret || '未填'}`,
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
