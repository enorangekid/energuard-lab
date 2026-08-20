import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { authorizeRequest, RequestAuthError } from "../_shared/authorize-request.ts"
import { consumeDailyQuota, DailyQuotaError } from "../_shared/daily-quota.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-energuard-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type ChatPart = { text?: string }
type ChatMessage = { role?: string; parts?: ChatPart[] }

function normalizeChatHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) throw new Error('대화 내용이 올바르지 않습니다.')

  const messages = value.slice(-12).map((entry) => {
    const message = entry && typeof entry === 'object' ? entry as ChatMessage : {}
    const role = message.role === 'model' ? 'model' : 'user'
    const text = Array.isArray(message.parts)
      ? message.parts.map((part) => String(part?.text || '')).join('\n').trim()
      : ''
    if (!text) throw new Error('빈 대화 내용은 전송할 수 없습니다.')
    return { role, parts: [{ text: text.slice(0, 8000) }] }
  })

  const totalLength = messages.reduce((sum, message) => sum + (message.parts?.[0]?.text?.length || 0), 0)
  if (!messages.length || totalLength > 24000) throw new Error('대화 내용이 너무 깁니다.')
  return messages
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const auth = await authorizeRequest(req)
    const { chatHistory } = await req.json()
    const normalizedHistory = normalizeChatHistory(chatHistory)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Gemini API 설정이 누락되었습니다.')

    const principal = auth.kind === 'user' ? auth.userId : 'cron'
    await consumeDailyQuota(principal, 'gemini-chat', 'generate', 1, 80)

    // 1. 현재 한국(서울) 시간 가져오기
    const now = new Date();
    const koreaTime = new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Asia/Seoul',
    }).format(now);

    // 2. Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ 
            text: `너는 '에너가드컴퍼니'의 만능 AI 비서야. 오늘 날짜와 시간은 ${koreaTime}이야.

[절대 규칙]
1. "잠시 찾아보겠습니다", "기다려주세요", "확인해 보겠습니다" 같은 지연성 멘트를 절대 사용하지 마.
2. 질문을 받으면 너의 검색 능력으로 즉시 최신 정보를 찾고, 그 결과를 바탕으로 '완성된 최종 답변'만 곧바로 출력해.
3. 항상 친절하고 똑똑한 비서의 말투를 유지해.
4. 해외 스포츠(NBA, 해외축구 등) 일정이나 결과를 안내할 때는 검색된 현지 시간을 그대로 말하지 말고, 반드시 **한국 시간(KST)을 기준으로 날짜를 변환해서** 보고해. (예: 미국 25일 저녁 경기 -> 한국 시간 26일 오전 경기)
5. 스포츠 순위, 경기 결과, 승점 등 수치가 포함된 질문은 반드시 검색 결과의 구체적인 숫자를 직접 인용해서 답변해. 학습 데이터나 추측으로 답변하지 말고, 검색으로 확인된 사실만 말해.`
          }]
        },
        contents: normalizedHistory,
        tools: [
          {
            googleSearch: {}
          }
        ],
        generationConfig: {
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    })

    const data = await response.json()
    if (!response.ok) {
      const apiMessage = data?.error?.message || `Gemini 요청에 실패했습니다. (${response.status})`
      return json({ error: apiMessage }, response.status)
    }
    return json(data)
  } catch (error) {
    const status = error instanceof RequestAuthError || error instanceof DailyQuotaError
      ? error.status
      : error instanceof SyntaxError
      ? 400
      : 500
    return json({ error: error instanceof Error ? error.message : String(error) }, status)
  }
})
