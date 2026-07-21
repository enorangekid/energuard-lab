const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

type IdeaPayload = {
  id?: string;
  keyword?: string;
  source?: string;
  category?: string;
  productGroup?: string;
  searchVolume?: number;
  competitionScore?: number;
  seasonScore?: number;
  aiScore?: number;
};

type DraftResult = {
  title: string;
  outline: string[];
  body: string;
  faq: string[];
  thumbnail: string;
  aiNotes?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferCategory(keyword: string, category = "") {
  const text = `${keyword} ${category}`;
  if (/아이소핑크|XPS|압출/.test(text)) return "아이소핑크";
  if (/열반사|은박|온도리/.test(text)) return "열반사단열재";
  if (/단열벽지|벽지|결로|곰팡이/.test(text)) return "단열벽지";
  return category || "기타";
}

function normalizeIdea(row: IdeaPayload): Required<IdeaPayload> {
  const keyword = cleanText(row.keyword);
  const category = inferCategory(keyword, cleanText(row.category || row.productGroup));
  return {
    id: cleanText(row.id) || crypto.randomUUID(),
    keyword,
    source: cleanText(row.source) || "manual",
    category,
    productGroup: cleanText(row.productGroup) || category,
    searchVolume: safeNumber(row.searchVolume),
    competitionScore: safeNumber(row.competitionScore),
    seasonScore: safeNumber(row.seasonScore),
    aiScore: safeNumber(row.aiScore),
  };
}

function fallbackIdeas(categories: string[], limit: number) {
  const base: IdeaPayload[] = [
    { keyword: "아이소핑크 시공 방법", source: "interest", category: "아이소핑크", searchVolume: 4200, competitionScore: 38, seasonScore: 72, aiScore: 86 },
    { keyword: "열반사단열재 효과", source: "interest", category: "열반사단열재", searchVolume: 3700, competitionScore: 41, seasonScore: 84, aiScore: 84 },
    { keyword: "겨울 결로 방지", source: "season", category: "단열벽지", searchVolume: 18300, competitionScore: 42, seasonScore: 93, aiScore: 88 },
    { keyword: "창문 햇빛 차단", source: "trend", category: "열반사단열재", searchVolume: 9600, competitionScore: 36, seasonScore: 86, aiScore: 82 },
    { keyword: "스티로폼 단열 차이", source: "interest", category: "기타", searchVolume: 2900, competitionScore: 44, seasonScore: 61, aiScore: 74 },
  ];
  const allow = new Set(categories.length ? categories : ["아이소핑크", "열반사단열재", "단열벽지", "기타"]);
  return base.filter(x => allow.has(String(x.category))).slice(0, limit).map(normalizeIdea);
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function fetchIdeas(categories: string[], limit: number, supplied: IdeaPayload[]) {
  if (supplied.length) return supplied.map(normalizeIdea).slice(0, limit);

  try {
    const categoryFilter = categories.length
      ? `&category=in.(${categories.map(encodeURIComponent).join(",")})`
      : "";
    const rows = await supabaseRequest(
      `/rest/v1/content_ideas?select=*&status=neq.used${categoryFilter}&order=ai_score.desc.nullslast,updated_at.desc&limit=${limit}`,
    );
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => normalizeIdea({
        id: row.id,
        keyword: row.keyword,
        source: row.source,
        category: row.category,
        productGroup: row.product_group,
        searchVolume: row.search_volume,
        competitionScore: row.competition_score,
        seasonScore: row.season_score,
        aiScore: row.ai_score,
      }));
    }
  } catch (_) {
    // 테이블이 없거나 아직 수집 데이터가 없으면 샘플 후보로 먼저 화면을 살립니다.
  }

  return fallbackIdeas(categories, limit);
}

function buildPrompt(idea: Required<IdeaPayload>) {
  return [
    `키워드: ${idea.keyword}`,
    `상품군: ${idea.productGroup}`,
    `카테고리: ${idea.category}`,
    `검색량: ${idea.searchVolume}`,
    `경쟁도: ${idea.competitionScore}`,
    `시즌성: ${idea.seasonScore}`,
    "",
    "에너가드랩 내부 직원이 검토할 블로그 초안을 작성해 주세요.",
    "고객에게 바로 발행하는 글이 아니라 초안입니다.",
    "단열재 구매/시공 의도를 분석하고, 자연스럽게 관련 상품군을 연결해 주세요.",
    "과장된 효능, 허위 순위, 확정적 의학/건축 성능 표현은 피하세요.",
    "",
    "반드시 JSON만 반환하세요.",
    '형식: {"title":"제목","outline":["목차1","목차2"],"body":"본문 초안","faq":["질문1","질문2"],"thumbnail":"썸네일 문구","aiNotes":"검토 메모"}',
  ].join("\n");
}

function normalizeDraft(raw: any, idea: Required<IdeaPayload>): DraftResult {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const outline = Array.isArray(parsed.outline) ? parsed.outline.map(cleanText).filter(Boolean) : [];
  const faq = Array.isArray(parsed.faq) ? parsed.faq.map(cleanText).filter(Boolean) : [];
  return {
    title: cleanText(parsed.title) || `${idea.keyword} 콘텐츠 초안`,
    outline: outline.length ? outline.slice(0, 6) : ["검색 의도", "상품군 연결", "시공 체크포인트", "FAQ"],
    body: cleanText(parsed.body) || `${idea.keyword} 관련 초안 본문을 검토해 주세요.`,
    faq: faq.length ? faq.slice(0, 5) : [`${idea.keyword} 선택 시 무엇을 확인해야 하나요?`],
    thumbnail: cleanText(parsed.thumbnail) || `${idea.keyword} 핵심 체크`,
    aiNotes: cleanText(parsed.aiNotes || parsed.ai_notes),
  };
}

async function generateDraft(idea: Required<IdeaPayload>): Promise<DraftResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY Supabase Secret이 필요합니다.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 단열재 쇼핑몰의 콘텐츠 기획자다. 한국어로 간결하고 실무적인 블로그 초안을 만든다. 결과는 유효한 JSON만 반환한다.",
        },
        { role: "user", content: buildPrompt(idea) },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return normalizeDraft(data?.choices?.[0]?.message?.content || "{}", idea);
}

async function saveDraft(idea: Required<IdeaPayload>, draft: DraftResult) {
  try {
    await supabaseRequest("/rest/v1/content_ideas?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        id: idea.id,
        keyword: idea.keyword,
        source: idea.source,
        category: idea.category,
        product_group: idea.productGroup,
        search_volume: idea.searchVolume,
        competition_score: idea.competitionScore,
        season_score: idea.seasonScore,
        ai_score: idea.aiScore,
        status: "drafted",
        updated_at: new Date().toISOString(),
      }]),
    });
    await supabaseRequest("/rest/v1/content_drafts?on_conflict=idea_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        idea_id: idea.id,
        keyword: idea.keyword,
        title: draft.title,
        outline: draft.outline,
        body: draft.body,
        faq: draft.faq,
        thumbnail: draft.thumbnail,
        ai_notes: draft.aiNotes || "",
        status: "drafted",
        generated_at: new Date().toISOString(),
      }]),
    });
  } catch (_) {
    // 저장 테이블이 아직 없어도 프론트 응답은 살려서 확인할 수 있게 둡니다.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const categories = Array.isArray(body.categories) ? body.categories.map(cleanText).filter(Boolean) : [];
    const limit = Math.min(Math.max(Number(body.limit || 3), 1), 8);
    const requestedIdeas = Array.isArray(body.ideas) ? body.ideas : [];
    const ideas = await fetchIdeas(categories, limit, requestedIdeas);

    const items = [];
    for (const idea of ideas) {
      const draft = await generateDraft(idea);
      await saveDraft(idea, draft);
      items.push({ ...idea, status: "drafted", updatedAt: new Date().toISOString(), ...draft });
    }

    return json({
      ok: true,
      source: OPENAI_MODEL,
      count: items.length,
      items,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
});
