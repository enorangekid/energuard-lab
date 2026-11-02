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

function normalizeChatHistory(value: unknown, reportMode = false): ChatMessage[] {
  if (!Array.isArray(value)) throw new Error('대화 내용이 올바르지 않습니다.')

  if (reportMode && value.length !== 1) throw new Error('보고서 요청은 하나의 메시지로 전송해야 합니다.')
  const maxMessageLength = reportMode ? 96000 : 8000
  const messages = value.slice(-12).map((entry) => {
    const message = entry && typeof entry === 'object' ? entry as ChatMessage : {}
    const role = message.role === 'model' ? 'model' : 'user'
    const text = Array.isArray(message.parts)
      ? message.parts.map((part) => String(part?.text || '')).join('\n').trim()
      : ''
    if (!text) throw new Error('빈 대화 내용은 전송할 수 없습니다.')
    if (text.length > maxMessageLength) throw new Error(`AI 입력이 ${maxMessageLength}자 제한을 초과했습니다. 자료를 잘라서 분석하지 않습니다.`)
    return { role, parts: [{ text }] }
  })

  const totalLength = messages.reduce((sum, message) => sum + (message.parts?.[0]?.text?.length || 0), 0)
  if (!messages.length || totalLength > (reportMode ? 96000 : 24000)) throw new Error('대화 내용이 너무 깁니다.')
  return messages
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const auth = await authorizeRequest(req)
    const { chatHistory, useSearch, reportMode: requestedReportMode } = await req.json()
    const reportMode = requestedReportMode === true
    const normalizedHistory = normalizeChatHistory(chatHistory, reportMode)
    // 기존 클라이언트(useSearch를 안 보내는 "업무 질문" 탭)는 그대로 검색을 켠 채 동작해야 하니
    // 기본값은 true. 맞춤법 검사/번역처럼 실시간 정보가 전혀 필요 없는 단순 텍스트 변환 작업은
    // false를 보내 검색 그라운딩을 끈다 — 구글 검색이 불필요하게 붙으면서 응답이 오래 걸리거나
    // 멈추는 것처럼 보이던 문제(2026-09-28, 맞춤법 검사가 "검사 중"에서 안 끝남)의 원인이었다.
    const searchEnabled = !reportMode && useSearch !== false
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

    // 2026-11-02 실측: gemini-3.8-flash는 보고서 입력(약 2만 자)에서 70~130초 이상 걸리거나 끝나지 않았고,
    // 2.5 Flash(추론 끔)는 예전처럼 빠르다. 보고서·채팅 모두 2.5 Flash를 쓴다.
    // 보고서 모드는 입력을 자르지 않고(96,000자까지), 입력 길이 검증값을 함께 돌려준다.
    const attempts = [{ model: 'gemini-2.5-flash', thinking: { thinkingBudget: 0 }, label: 'off', timeoutMs: 120000 }]
    const startedAt = Date.now()
    const buildBody = (thinkingConfig: Record<string, unknown>) => JSON.stringify({
        systemInstruction: {
          parts: [{
            text: reportMode
              ? `너는 에너가드컴퍼니의 매출·광고 보고서 분석가야. 제공된 데이터만 사용해 실제 실적과 증감액, 집계 기준을 구분하고 인과관계를 단정하지 마. 요청된 JSON 형식으로만 최종 분석을 출력해. 오늘 날짜와 시간은 ${koreaTime}이야.`
              : searchEnabled
              ? `너는 '에너가드컴퍼니'의 만능 AI 비서야. 오늘 날짜와 시간은 ${koreaTime}이야.

[절대 규칙]
1. "잠시 찾아보겠습니다", "기다려주세요", "확인해 보겠습니다" 같은 지연성 멘트를 절대 사용하지 마.
2. 질문을 받으면 너의 검색 능력으로 즉시 최신 정보를 찾고, 그 결과를 바탕으로 '완성된 최종 답변'만 곧바로 출력해.
3. 항상 친절하고 똑똑한 비서의 말투를 유지해.
4. 해외 스포츠(NBA, 해외축구 등) 일정이나 결과를 안내할 때는 검색된 현지 시간을 그대로 말하지 말고, 반드시 **한국 시간(KST)을 기준으로 날짜를 변환해서** 보고해. (예: 미국 25일 저녁 경기 -> 한국 시간 26일 오전 경기)
5. 스포츠 순위, 경기 결과, 승점 등 수치가 포함된 질문은 반드시 검색 결과의 구체적인 숫자를 직접 인용해서 답변해. 학습 데이터나 추측으로 답변하지 말고, 검색으로 확인된 사실만 말해.`
              : `너는 '에너가드컴퍼니'의 업무 보조 AI야. 오늘 날짜와 시간은 ${koreaTime}이야. 실시간 검색이 필요 없는 단순 텍스트 작업(맞춤법 교정, 번역 등)이니, 검색 없이 주어진 지시를 정확히 수행해서 결과만 곧바로 출력해. "잠시 찾아보겠습니다" 같은 지연성 멘트는 쓰지 마.`
          }]
        },
        contents: normalizedHistory,
        ...(searchEnabled ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          ...(reportMode ? { responseMimeType: 'application/json', maxOutputTokens: 16384 } : {}),
          thinkingConfig
        }
      })

    const failures: string[] = []
    let failStatus = 502
    let lastModel = attempts[0].model
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]
      lastModel = attempt.model
      const attemptStart = Date.now()
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(attempt.timeoutMs),
          body: buildBody(attempt.thinking),
        })
        const data = await response.json()
        const elapsedMs = Date.now() - startedAt
        if (response.ok) {
          return json(reportMode
            ? {
                ...data,
                reportModel: attempt.model,
                reportThinking: attempt.label,
                reportElapsedMs: elapsedMs,
                ...(i > 0 ? { reportFallback: failures.join(' / ') } : {}),
                reportInput: { complete: true, characters: normalizedHistory[0].parts![0].text!.length },
              }
            : data)
        }
        const apiMessage = data?.error?.message || `Gemini 요청에 실패했습니다. (${response.status})`
        failures.push(`${attempt.model}: ${apiMessage}`)
        failStatus = response.status
        // 한도(429)·서버 오류만 다음 모델로 넘기고, 요청 자체가 잘못된 경우(4xx)는 바로 돌려준다.
        if (!(response.status === 429 || response.status >= 500)) {
          return json({ error: apiMessage, model: attempt.model, elapsedMs }, response.status)
        }
      } catch (error) {
        const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
        failures.push(timedOut
          ? `${attempt.model}: ${Math.round((Date.now() - attemptStart) / 1000)}초 안에 응답 없음`
          : `${attempt.model}: 연결 실패 ${error instanceof Error ? error.message : String(error)}`)
        failStatus = timedOut ? 504 : 502
      }
    }
    return json({ error: failures.join(' / '), model: lastModel, elapsedMs: Date.now() - startedAt }, failStatus)
  } catch (error) {
    const status = error instanceof RequestAuthError || error instanceof DailyQuotaError
      ? error.status
      : error instanceof SyntaxError
      ? 400
      : 500
    return json({ error: error instanceof Error ? error.message : String(error) }, status)
  }
})
