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
  aiNotes?: string;
};

type YoutubeScriptResult = {
  youtubeTitle: string;
  youtubeOutline: string[];
  youtubeBody: string;
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

function cleanBodyText(value: unknown) {
  let text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = text.replace(/\s*(\*\*[^*]{2,90}\*\*)\s*/g, "\n\n$1\n\n").replace(/\n{3,}/g, "\n\n").trim();
  text = text
    .replace(/(습니다\.|합니다\.|됩니다\.|있습니다\.|많습니다\.|좋습니다\.|중요합니다\.|주세요\.|볼 수 있습니다\.)\s+/g, "$1\n\n")
    .replace(/([가-힣]{2,}\.)\s+(?=[가-힣"“‘'\[])/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function inferCategory(keyword: string, category = "") {
  const text = `${keyword} ${category}`;
  if (/아이소핑크|XPS|압출/.test(text)) return "아이소핑크";
  if (/열반사|은박|온도리/.test(text)) return "열반사단열재";
  if (/단열벽지|벽지|결로|곰팡이/.test(text)) return "단열벽지";
  return "기타";
}

function inferProductGroup(keyword: string, category = "") {
  const text = `${keyword} ${category}`;
  if (/제습|습기|장마|곰팡이|결로/i.test(text)) return "습기/결로 관리";
  if (/냉방비|전기요금|에어컨|실외기|폭염|열대야/i.test(text)) return "냉방비/실외기 관리";
  if (/차량용햇빛|자동차햇빛|차박|햇빛가리개|썬쉐이드|차량커튼/i.test(text)) return "차량 햇빛 차단";
  if (/창문|햇빛|열차단|단열필름/i.test(text)) return "창문 열차단";
  if (/아이소핑크|XPS|압출/i.test(text)) return "아이소핑크";
  if (/열반사|은박|온도리/i.test(text)) return "열반사단열재";
  if (/단열벽지|벽지/i.test(text)) return "단열벽지";
  return inferCategory(keyword, category);
}

function normalizeIdea(row: IdeaPayload): Required<IdeaPayload> {
  const keyword = cleanText(row.keyword);
  const category = inferCategory(keyword, cleanText(row.category || row.productGroup));
  return {
    id: cleanText(row.id) || crypto.randomUUID(),
    keyword,
    source: cleanText(row.source) || "manual",
    category,
    productGroup: cleanText(row.productGroup) || inferProductGroup(keyword, category),
    searchVolume: safeNumber(row.searchVolume),
    competitionScore: safeNumber(row.competitionScore),
    seasonScore: safeNumber(row.seasonScore),
    aiScore: safeNumber(row.aiScore),
  };
}

function fallbackIdeas(categories: string[], limit: number) {
  return [];
}

function currentKstMonth() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function prevKstMonth() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCMonth(kst.getUTCMonth() - 1);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function categoryAllowed(category: string, categories: string[]) {
  return !categories.length || categories.includes(category);
}

function isContentKeyword(keyword: string) {
  return /단열|아이소핑크|스티로폼|비드법|폼보드|열반사|은박|온도리|보온|결로|창문|햇빛|열차단|냉기|우레탄|PF보드|페놀폼|미네랄울|글라스울|실외기|에어컨|냉방비|전기요금|폭염|열대야|장마|제습|습기|곰팡이|차량용햇빛|자동차햇빛|차박|썬쉐이드|햇빛가리개|차량커튼|커버|XPS|EPS/i.test(keyword);
}

function isNewsNoise(keyword: string) {
  return /의원|선거|재검표|파업|노조|법원|회생|콘서트|홍보대사|역전승|외교관|이더|비니시우스|수력원자력|시위|MC몽|성애|경매|중구|연애|화재$|수소 자동차|자동차$/i.test(keyword);
}

function seasonScoreFor(keyword: string) {
  const month = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  const summer = /열차단|햇빛|창문|실외기|에어컨|열반사|단열필름|은박|온도리/i.test(keyword);
  const winter = /결로|냉기|난방|보온|곰팡이|단열벽지|바닥/i.test(keyword);
  if ([6, 7, 8, 9].includes(month)) return summer ? 92 : winter ? 35 : 68;
  if ([11, 12, 1, 2].includes(month)) return winter ? 92 : summer ? 40 : 68;
  return 72;
}

function keywordIdeaFromVolume(row: any): Required<IdeaPayload> | null {
  const keyword = cleanText(row.keyword);
  if (!keyword || !isContentKeyword(keyword) || isNewsNoise(keyword)) return null;
  const category = inferCategory(keyword);
  const total = safeNumber(row.total);
  const competition = Math.max(20, Math.min(85, Math.round(70 - Math.log10(Math.max(total, 10)) * 8)));
  const season = seasonScoreFor(keyword);
  const volumeScore = Math.min(100, Math.round(Math.log10(Math.max(total, 10)) * 22));
  return normalizeIdea({
    id: `volume-${keyword}`,
    keyword,
    source: season >= 85 ? "season" : "interest",
    category,
    productGroup: inferProductGroup(keyword, category),
    searchVolume: total,
    competitionScore: competition,
    seasonScore: season,
    aiScore: Math.round(volumeScore * 0.48 + season * 0.34 + (100 - competition) * 0.18),
  });
}

function keywordIdeaFromRankHistory(row: any): Required<IdeaPayload> | null {
  const keyword = cleanText(row.keyword);
  if (!keyword || !isContentKeyword(keyword) || isNewsNoise(keyword)) return null;
  const category = inferCategory(keyword, cleanText(row.main_keyword || ""));
  const total = safeNumber(row.search_volume_total);
  if (!total) return null;
  const competition = Math.max(18, Math.min(88, Math.round(72 - Math.log10(Math.max(total, 10)) * 8)));
  const season = seasonScoreFor(keyword);
  const volumeScore = Math.min(100, Math.round(Math.log10(Math.max(total, 10)) * 23));
  return normalizeIdea({
    id: `rank-volume-${keyword}`,
    keyword,
    source: season >= 85 ? "season" : "interest",
    category,
    productGroup: inferProductGroup(keyword, category),
    searchVolume: total,
    competitionScore: competition,
    seasonScore: season,
    aiScore: Math.round(volumeScore * 0.5 + season * 0.34 + (100 - competition) * 0.16),
  });
}

async function fetchRankHistoryIdeas(categories: string[], limit: number) {
  const rows = await supabaseRequest(
    "/rest/v1/keyword_rank_history?select=keyword,main_keyword,search_volume_total,collected_date&search_volume_total=gt.0&order=collected_date.desc,search_volume_total.desc&limit=1500",
  );
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : [])
    .map(keywordIdeaFromRankHistory)
    .filter((idea): idea is Required<IdeaPayload> => {
      if (!idea) return false;
      if (!categoryAllowed(idea.category, categories)) return false;
      if (seen.has(idea.keyword)) return false;
      seen.add(idea.keyword);
      return true;
    })
    .sort((a, b) => b.aiScore - a.aiScore || b.searchVolume - a.searchVolume)
    .slice(0, limit);
}

function keywordIdeaFromTrend(row: any): Required<IdeaPayload> | null {
  const keyword = cleanText(row.keyword);
  if (!keyword || !isContentKeyword(keyword) || isNewsNoise(keyword)) return null;
  const category = inferCategory(keyword);
  const rank = safeNumber(row.rank) || 99;
  const season = seasonScoreFor(keyword);
  const trendScore = Math.max(45, 105 - rank * 4);
  const productGroup = inferProductGroup(keyword, category);
  return normalizeIdea({
    id: `trend-${keyword}`,
    keyword,
    source: "trend",
    category,
    productGroup,
    searchVolume: 0,
    competitionScore: Math.max(25, Math.min(78, 45 + rank)),
    seasonScore: season,
    aiScore: Math.min(100, Math.round(trendScore * 0.58 + season * 0.42)),
  });
}

async function fetchTrendIdeas(categories: string[], limit: number) {
  const rows = await supabaseRequest(
    "/rest/v1/realtime_trend_snapshot?select=keyword,list_type,rank,sources,captured_at&order=captured_at.desc,rank.asc&limit=300",
  );
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : [])
    .map(keywordIdeaFromTrend)
    .filter((idea): idea is Required<IdeaPayload> => {
      if (!idea) return false;
      if (!categoryAllowed(idea.category, categories)) return false;
      const key = idea.keyword.replace(/\s+/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, limit);
}

async function fetchVolumeIdeas(categories: string[], limit: number) {
  const months = [currentKstMonth(), prevKstMonth()];
  const rows = await supabaseRequest(
    `/rest/v1/keyword_search_volume_monthly?select=keyword,snapshot_month,total&snapshot_month=in.(${months.join(",")})&total=gt.0&order=total.desc&limit=300`,
  );
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : [])
    .map(keywordIdeaFromVolume)
    .filter((idea): idea is Required<IdeaPayload> => {
      if (!idea) return false;
      if (!categoryAllowed(idea.category, categories)) return false;
      if (seen.has(idea.keyword)) return false;
      seen.add(idea.keyword);
      return true;
    })
    .sort((a, b) => b.aiScore - a.aiScore || b.searchVolume - a.searchVolume)
    .slice(0, limit);
}

async function fetchTrendBoostMap() {
  try {
    const rows = await supabaseRequest(
      "/rest/v1/realtime_trend_snapshot?select=keyword,rank,captured_at&order=captured_at.desc,rank.asc&limit=80",
    );
    const boost = new Map<string, number>();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const keyword = cleanText(row.keyword);
      if (!isContentKeyword(keyword) || isNewsNoise(keyword)) return;
      boost.set(keyword.replace(/\s+/g, ""), Math.max(0, 35 - safeNumber(row.rank)));
    });
    return boost;
  } catch (_) {
    return new Map<string, number>();
  }
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
  if (supplied.length) {
    const rows = supplied
      .map(normalizeIdea)
      .filter((idea) => isContentKeyword(idea.keyword) && !isNewsNoise(idea.keyword));
    if (rows.length) return rows.slice(0, limit);
  }

  const trendIdeas = await fetchTrendIdeas(categories, limit);

  if (trendIdeas.length >= limit) return trendIdeas;

  const volumeIdeas = await fetchVolumeIdeas(categories, limit);
  const rankHistoryIdeas = volumeIdeas;
  const trendBoost = await fetchTrendBoostMap();
  const boosted = rankHistoryIdeas.map((idea) => {
    const boost = trendBoost.get(idea.keyword.replace(/\s+/g, "")) || 0;
    return { ...idea, source: boost ? "trend" : idea.source, aiScore: Math.min(100, idea.aiScore + boost) };
  });
  return [...trendIdeas, ...boosted].slice(0, limit);
}

function buildPrompt(idea: Required<IdeaPayload>) {
  return [
    `키워드: ${idea.keyword}`,
    `상품군: ${idea.productGroup}`,
    `카테고리: ${idea.category}`,
    `검색량: ${idea.searchVolume || "실시간 화제성 기반"}`,
    `경쟁도: ${idea.competitionScore}`,
    `시즌성: ${idea.seasonScore}`,
    "",
    "에너가드컴퍼니 블로그에 올릴 수 있는 정보성 초안을 작성해 주세요.",
    "목표는 바로 발행이 아니라 내부 검토용 초안입니다. 문체와 구조는 아래 공식을 따르세요.",
    "",
    "[제목 공식]",
    "- 제목은 질문형 또는 검색 키워드 포함형으로 작성합니다.",
    "- 예: '여름철 창고에 오래 둔 단열재, 그냥 사용해도 될까요?'",
    "- 예: '[단열재시공방법] 아파트 베란다 셀프 단열 아이소핑크, 벽에 뭘로 붙일까?'",
    "- 제목에는 키워드를 자연스럽게 넣고, 클릭 유도성 과장 표현은 피합니다.",
    "",
    "[도입부 공식]",
    "- 계절, 생활 상황, 현장 상황, 사용자가 실제로 헷갈리는 질문에서 시작합니다.",
    "- 독자가 할 법한 질문을 1~3개 짧게 넣어 공감대를 만듭니다.",
    "- 바로 제품을 팔지 말고 왜 이 주제가 중요한지 현실적으로 설명합니다.",
    "- 문단은 매우 짧게 나눕니다. 한 문단은 보통 1~2문장입니다.",
    "",
    "[본문 공식]",
    "- 본문 소제목은 4~6개를 만듭니다.",
    "- 소제목은 반드시 이모지 + 굵은 제목 형태로 씁니다. 예: '**☀️ 자외선에 오래 노출되면 표면부터 달라집니다**'",
    "- 어려운 용어는 쓰되 바로 쉬운 말로 풀어 설명합니다.",
    "- 단순 정답보다 현장 조건, 보관 환경, 시공 부위, 예산, 계절에 따라 선택이 달라질 수 있음을 설명합니다.",
    "- 키워드가 단열재와 직접 관련이 없어도 여름/겨울 생활 이슈에서 단열, 열차단, 습기관리, 결로, 냉방비, 시공 편의성으로 자연스럽게 연결합니다.",
    "- 제품 연결은 중후반 이후에만 자연스럽게 넣습니다.",
    "",
    "[핵심 정리 공식]",
    "- 본문 뒤에 반드시 '**📌 핵심 정리**' 섹션을 넣습니다.",
    "- 5~6개의 짧은 요약 문장을 줄바꿈으로 나열합니다.",
    "- 목록 앞에 숫자나 긴 들여쓰기는 쓰지 않습니다.",
    "",
    "[마무리 공식]",
    "- 마지막 소제목은 반드시 '**🍀 ...**' 형태로 작성합니다.",
    "- 마무리는 4~7개의 짧은 문단으로 작성합니다.",
    "- 에너가드컴퍼니 언급은 마지막 부분에 1회 자연스럽게 넣습니다.",
    "- '편하게 문의 주세요', '상담 받아보시기 바랍니다' 같은 부담 없는 문장으로 끝냅니다.",
    "",
    "[문체 규칙]",
    "- 친절하고 현실적인 설명체를 사용합니다.",
    "- '~할 수 있습니다', '~하는 경우가 많습니다', '~이 중요합니다' 톤을 사용합니다.",
    "- 판매 문구보다 정보 제공을 우선합니다.",
    "- 과장된 효능, 허위 순위, 확정적 의학/건축 성능 표현은 피합니다.",
    "- '무조건 좋다' 대신 '현장 조건에 따라 다르다'는 식으로 씁니다.",
    "- 문단 사이 호흡이 느껴지도록 줄바꿈을 충분히 넣습니다.",
    "",
    "반드시 JSON만 반환하세요.",
    '형식: {"title":"질문형 제목","outline":["이모지 소제목1","이모지 소제목2"],"body":"도입부부터 마무리까지 포함한 전체 본문 초안","aiNotes":"검토 메모"}',
  ].join("\n");
}

function normalizeDraft(raw: any, idea: Required<IdeaPayload>): DraftResult {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const outline = Array.isArray(parsed.outline) ? parsed.outline.map(cleanText).filter(Boolean) : [];
  return {
    title: cleanText(parsed.title) || `${idea.keyword} 콘텐츠 초안`,
    outline: outline.length ? outline.slice(0, 6) : ["검색 의도", "상품군 연결", "시공 체크포인트"],
    body: cleanBodyText(parsed.body) || `${idea.keyword} 관련 초안 본문을 검토해 주세요.`,
    aiNotes: cleanText(parsed.aiNotes || parsed.ai_notes),
  };
}

function buildYoutubePrompt(idea: Required<IdeaPayload>) {
  return [
    `키워드: ${idea.keyword}`,
    `상품군: ${idea.productGroup}`,
    `카테고리: ${idea.category}`,
    `검색량: ${idea.searchVolume || "실시간 화제성 기반"}`,
    `경쟁도: ${idea.competitionScore}`,
    `시즌성: ${idea.seasonScore}`,
    "",
    "에너가드컴퍼니 유튜브 롱폼 영상용 대본 초안을 작성해 주세요.",
    "바로 녹음하거나 촬영 전 검토할 수 있는 대본이며, 아래 공식과 예시 스타일을 따릅니다.",
    "",
    "[제목 공식]",
    "- 제목은 '강한 문제 제기 | 보조 설명' 구조로 작성합니다.",
    "- 예: '단열은 겨울만의 이야기가 아닙니다 | 여름철 폭염을 버티는 집의 조건'",
    "- 예: '리모델링 단열재의 배신 | 우리 가족을 지키는 준불연단열재의 모든 것'",
    "- 예: 'PF보드, 아무거나 쓰지 마세요 | 고성능 단열재 실패 없이 고르는 완벽 가이드'",
    "",
    "[전체 구조]",
    "- 반드시 [오프닝]으로 시작합니다.",
    "- 이어서 4~6개의 주제 섹션을 만듭니다.",
    "- 마지막은 반드시 [아웃트로]로 끝냅니다.",
    "- 섹션 제목은 이모지 없이 대괄호 형식으로 씁니다. 예: [여름철 실내가 더워지는 진짜 이유]",
    "",
    "[오프닝 공식]",
    "- 뉴스, 계절 이슈, 비용 부담, 안전 문제, 사용자의 불안에서 시작합니다.",
    "- 처음부터 제품을 팔지 말고 '왜 이 주제가 중요한지'를 충분히 설명합니다.",
    "- 독자가 실제로 할 법한 질문을 자연스럽게 넣습니다.",
    "- 훅은 강하게 잡되 공포 마케팅처럼 과장하지 않습니다.",
    "",
    "[본문 공식]",
    "- 블로그보다 길고 설명이 누적되는 말투로 작성합니다.",
    "- 말로 읽었을 때 자연스럽도록 문장을 길게 쓸 수 있지만 문단은 짧게 나눕니다.",
    "- 문제 원인, 현장 구조, 선택 기준, 제품군 연결 순서로 전개합니다.",
    "- 전문 용어는 사용하되 바로 쉽게 풀어 설명합니다.",
    "- 제품명은 중반 이후부터 자연스럽게 연결합니다.",
    "- 에너가드컴퍼니 언급은 후반부 또는 아웃트로에만 자연스럽게 넣습니다.",
    "",
    "[아웃트로 공식]",
    "- 오늘 내용을 정리하겠습니다. 또는 질문형 문장으로 시작할 수 있습니다.",
    "- 핵심 내용을 3~5문단으로 다시 정리합니다.",
    "- 에너가드컴퍼니가 공급하는 자재와 상담 가능성을 자연스럽게 언급합니다.",
    "- 마지막 문장은 반드시 아래 흐름을 포함합니다.",
    "- '이상 친환경 단열재 제조 전문기업 에너가드컴퍼니였습니다.'",
    "- '시청해주셔서 감사합니다. 도움이 되셨다면 좋아요와 구독 부탁드립니다.'",
    "",
    "[분량]",
    "- 롱폼 기준으로 작성합니다.",
    "- 블로그 초안보다 길게, 최소 7개 이상의 문단 묶음으로 작성합니다.",
    "- 결과 본문은 5~8분 분량을 목표로 합니다.",
    "",
    "반드시 JSON만 반환하세요.",
    '형식: {"youtubeTitle":"영상 제목","youtubeOutline":["[오프닝]","[섹션1]","[아웃트로]"],"youtubeBody":"전체 유튜브 대본"}',
  ].join("\n");
}

function normalizeYoutubeScript(raw: any, idea: Required<IdeaPayload>): YoutubeScriptResult {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const outline = Array.isArray(parsed.youtubeOutline) ? parsed.youtubeOutline.map(cleanText).filter(Boolean) : [];
  return {
    youtubeTitle: cleanText(parsed.youtubeTitle || parsed.title) || `${idea.keyword} 유튜브 대본`,
    youtubeOutline: outline.length ? outline.slice(0, 8) : ["[오프닝]", "[핵심 문제]", "[선택 기준]", "[아웃트로]"],
    youtubeBody: cleanBodyText(parsed.youtubeBody || parsed.body) || `${idea.keyword} 관련 유튜브 대본을 검토해 주세요.`,
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
            "너는 에너가드컴퍼니 블로그의 콘텐츠 기획자다. 독자가 실제로 궁금해하는 질문에서 출발해 단열·열차단·습기관리·시공 관점으로 풀어내는 한국어 정보성 블로그 초안을 만든다. 짧은 문단, 이모지 소제목, 핵심 정리, 자연스러운 브랜드 연결을 지키고 결과는 유효한 JSON만 반환한다.",
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

async function generateYoutubeDraft(idea: Required<IdeaPayload>): Promise<YoutubeScriptResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY Supabase Secret이 필요합니다.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.42,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 에너가드컴퍼니 유튜브 채널의 대본 작가다. 뉴스성 훅, 현실 문제, 건축·단열 설명, 제품군 연결, 브랜드 아웃트로를 갖춘 한국어 롱폼 대본을 만든다. 결과는 유효한 JSON만 반환한다.",
        },
        { role: "user", content: buildYoutubePrompt(idea) },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return normalizeYoutubeScript(data?.choices?.[0]?.message?.content || "{}", idea);
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
    const existing = await fetchExistingDraft(idea.id);
    const existingNotes = parseAiNotes(existing?.ai_notes);
    const aiNotes = JSON.stringify({
      note: draft.aiNotes || existingNotes.note || "",
      youtube: existingNotes.youtube,
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
        ai_notes: aiNotes,
        status: "drafted",
        generated_at: new Date().toISOString(),
      }]),
    });
  } catch (_) {
    // 저장 테이블이 아직 없어도 프론트 응답은 살려서 확인할 수 있게 둡니다.
  }
}

function parseAiNotes(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return { note: "", youtube: null as YoutubeScriptResult | null };
  try {
    const parsed = JSON.parse(text);
    return {
      note: cleanText(parsed.note || parsed.aiNotes || parsed.text || ""),
      youtube: parsed.youtube ? normalizeYoutubeScript(parsed.youtube, {
        id: "",
        keyword: "",
        source: "manual",
        category: "기타",
        productGroup: "기타",
        searchVolume: 0,
        competitionScore: 0,
        seasonScore: 0,
        aiScore: 0,
      }) : null,
    };
  } catch (_) {
    return { note: text, youtube: null as YoutubeScriptResult | null };
  }
}

async function fetchExistingDraft(ideaId: string) {
  const rows = await supabaseRequest(`/rest/v1/content_drafts?idea_id=eq.${encodeURIComponent(ideaId)}&select=*&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function saveYoutubeScript(idea: Required<IdeaPayload>, script: YoutubeScriptResult) {
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
        updated_at: new Date().toISOString(),
      }]),
    });

    const existing = await fetchExistingDraft(idea.id);
    const existingNotes = parseAiNotes(existing?.ai_notes);
    const aiNotes = JSON.stringify({
      note: existingNotes.note,
      youtube: script,
    });

    if (existing) {
      await supabaseRequest(`/rest/v1/content_drafts?idea_id=eq.${encodeURIComponent(idea.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          ai_notes: aiNotes,
          updated_at: new Date().toISOString(),
        }),
      });
    } else {
      await supabaseRequest("/rest/v1/content_drafts?on_conflict=idea_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          idea_id: idea.id,
          keyword: idea.keyword,
          ai_notes: aiNotes,
          status: "drafted",
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]),
      });
    }
  } catch (_) {
    // 저장 테이블이 아직 없어도 프론트 응답은 살려서 확인할 수 있게 둡니다.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action || "generateDrafts");
    const categories = Array.isArray(body.categories) ? body.categories.map(cleanText).filter(Boolean) : [];
    const limit = Math.min(Math.max(Number(body.limit || 3), 1), 8);
    const requestedIdeas = Array.isArray(body.ideas) ? body.ideas : [];
    const ideas = await fetchIdeas(categories, limit, requestedIdeas);

    const items = [];
    for (const idea of ideas) {
      if (action === "generateYoutube") {
        const youtube = await generateYoutubeDraft(idea);
        await saveYoutubeScript(idea, youtube);
        items.push({ ...idea, updatedAt: new Date().toISOString(), ...youtube });
      } else {
        const draft = await generateDraft(idea);
        await saveDraft(idea, draft);
        items.push({ ...idea, status: "drafted", updatedAt: new Date().toISOString(), ...draft });
      }
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
