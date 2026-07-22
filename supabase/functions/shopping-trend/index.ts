// supabase/functions/shopping-trend/index.ts
// 데이터랩 쇼핑인사이트 — 분야별 인기 검색어 TOP N (+순위 변동)
// ⚠ 비공식 엔드포인트 사용: 데이터랩 웹페이지 내부 API를 호출합니다.
//   네이버가 페이지 구조를 바꾸면 동작이 멈출 수 있으며, 그 경우 에러만 반환됩니다.
// 시크릿 불필요 (공개 데이터)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* 네이버 쇼핑 1차 카테고리 CID */
const CATEGORY_CID: Record<string, string> = {
  "패션의류": "50000000",
  "패션잡화": "50000001",
  "화장품/미용": "50000002",
  "디지털/가전": "50000003",
  "가구/인테리어": "50000004",
  "출산/육아": "50000005",
  "식품": "50000006",
  "스포츠/레저": "50000007",
  "생활/건강": "50000008",
};

const DATALAB_URL = "https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* 기간 계산 (KST 기준) — offset: 기준일을 며칠 더 뒤로 물릴지 (집계 지연 대응) */
function periods(timeUnit: string, offset = 0) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const day = (n: number) => new Date(today.getTime() + (n - offset) * 86400000);

  if (timeUnit === "week") {
    return {
      cur: { start: fmtDate(day(-7)), end: fmtDate(day(-1)) },
      prev: { start: fmtDate(day(-14)), end: fmtDate(day(-8)) },
      unit: "week",
    };
  }
  if (timeUnit === "month") {
    return {
      cur: { start: fmtDate(day(-30)), end: fmtDate(day(-1)) },
      prev: { start: fmtDate(day(-60)), end: fmtDate(day(-31)) },
      unit: "month",
    };
  }
  return {
    cur: { start: fmtDate(day(-1)), end: fmtDate(day(-1)) },
    prev: { start: fmtDate(day(-2)), end: fmtDate(day(-2)) },
    unit: "date",
  };
}

async function fetchRank(cid: string, start: string, end: string, unit: string, count: number) {
  const form = new URLSearchParams({
    cid,
    timeUnit: unit,
    startDate: start,
    endDate: end,
    age: "",
    gender: "",
    device: "",
    page: "1",
    count: String(count),
  });

  const res = await fetch(DATALAB_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": "https://datalab.naver.com/shoppingInsight/sCategory.naver",
      "Origin": "https://datalab.naver.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`데이터랩 응답 ${res.status}`);
  }
  const data = await res.json();
  // 응답 형태: { ranks: [{ rank, keyword, linkId }, ...], ... }
  const ranks: Array<{ rank: number; keyword: string }> = data.ranks ?? [];
  return ranks; // 빈 배열 = 해당 날짜 집계 전 (호출부에서 날짜 이동 재시도)
}

/* ───────── 실시간 급상승 키워드 (시그널 + 네이트 + 구글 트렌드) ───────── */

const SNAPSHOT_TABLE = "realtime_trend_snapshot";
const TREND_ARCHIVE_TABLE = "realtime_trend_archive";
const CONTENT_IDEA_TABLE = "content_ideas";
const CONTENT_DRAFT_TABLE = "content_drafts";
const NICHE_DAILY_TABLE = "niche_trend_daily_snapshot";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

function getSupabaseCredentials() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return { url, key, enabled: !!url && !!key };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key, enabled } = getSupabaseCredentials();
  if (!enabled) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY 필요");
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`snapshot ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function saveNicheDailySnapshot(listType: "news" | "spike", payload: Record<string, unknown>) {
  await supabaseRequest(`/rest/v1/${NICHE_DAILY_TABLE}?on_conflict=snapshot_date,list_type`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      snapshot_date: kstToday(), list_type: listType, payload,
      captured_at: new Date().toISOString(),
    }]),
  });
}

async function readLatestNicheSnapshot(listType: "news" | "spike") {
  const rows = await supabaseRequest(
    `/rest/v1/${NICHE_DAILY_TABLE}?select=payload,captured_at,snapshot_date&list_type=eq.${listType}&order=snapshot_date.desc&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? { ...row.payload, storedAt: row.captured_at, snapshotDate: row.snapshot_date } : null;
}

async function cleanupNicheDailySnapshots() {
  const cutoff = new Date(Date.now() + 9 * 3600 * 1000 - 14 * 86400000).toISOString().slice(0, 10);
  await supabaseRequest(`/rest/v1/${NICHE_DAILY_TABLE}?snapshot_date=lt.${cutoff}`, { method: "DELETE" });
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchSignal(): Promise<{ rank: number; keyword: string }[]> {
  const res = await fetch("https://api.signal.bz/news/realtime", {
    headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`signal ${res.status}`);
  const data = await res.json();
  return (data.top10 || []).map((item: { rank: number; keyword: string }) => ({
    rank: Number(item.rank), keyword: String(item.keyword || "").trim(),
  })).filter((item: { keyword: string }) => item.keyword);
}

async function fetchNate(): Promise<{ rank: number; keyword: string }[]> {
  const res = await fetch("https://www.nate.com/js/data/jsonLiveKeywordDataV1.js", {
    headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`nate ${res.status}`);
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder("euc-kr").decode(buffer);
  const data = JSON.parse(text);
  // 각 행: [순위, 이슈제목, 플래그, 변동, 검색키워드]
  return (Array.isArray(data) ? data : []).map((row: string[]) => ({
    rank: Number(row[0]), keyword: String(row[4] || row[1] || "").trim(),
  })).filter((item: { keyword: string }) => item.keyword);
}

type GoogleTrendItem = {
  rank: number;
  keyword: string;
  trafficLabel: string;
  trafficValue: number;
  publishedAt: number;
  newsCount: number;
  newsTitle: string;
  newsSource: string;
  newsUrl: string;
};

function decodeXml(value: string) {
  return String(value || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function xmlValue(block: string, tag: string) {
  const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, "i"));
  return decodeXml(match?.[1] || "");
}

function trafficNumber(label: string) {
  const text = String(label || "").replace(/,/g, "").toUpperCase();
  const value = Number(text.match(/[\d.]+/)?.[0] || 0);
  if (/M|백만/.test(text)) return Math.round(value * 1_000_000);
  if (/K|천/.test(text)) return Math.round(value * 1_000);
  if (/만/.test(text)) return Math.round(value * 10_000);
  return Math.round(value);
}

function relativeAge(timestamp: number) {
  if (!timestamp) return "";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "1시간 이내";
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

async function fetchGoogleTrends(): Promise<GoogleTrendItem[]> {
  const urls = [
    "https://trends.google.co.kr/trending/rss?geo=KR",
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const xml = await res.text();
       const items: GoogleTrendItem[] = [];
       const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
       let rank = 1;
       for (const m of matches) {
         const block = String(m[1] || "");
         const keyword = xmlValue(block, "title");
         const trafficLabel = xmlValue(block, "ht:approx_traffic");
         const publishedAt = new Date(xmlValue(block, "pubDate")).getTime() || 0;
         const newsBlocks = [...block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi)];
         const firstNews = String(newsBlocks[0]?.[1] || "");
         if (keyword) items.push({
           rank: rank++, keyword, trafficLabel, trafficValue: trafficNumber(trafficLabel), publishedAt,
           newsCount: newsBlocks.length,
           newsTitle: xmlValue(firstNews, "ht:news_item_title"),
           newsSource: xmlValue(firstNews, "ht:news_item_source"),
           newsUrl: xmlValue(firstNews, "ht:news_item_url"),
         });
         if (rank > 20) break;
       }
      if (items.length) return items;
    } catch (_) { /* 다음 URL 시도 */ }
  }
  throw new Error("google trends 조회 실패");
}

// 여러 소스의 순위·중복 노출·구글 검색량을 함께 반영한 실시간 종합 순위
function mergeRealtime(lists: { name: string; items: Array<{ rank: number; keyword: string; trafficValue?: number }> }[]) {
  const map = new Map<string, { keyword: string; score: number; best: number; sources: string[]; trafficValue: number }>();
  lists.forEach(({ name, items }) => {
    items.forEach(item => {
      const key = item.keyword.replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, { keyword: item.keyword, score: 0, best: 99, sources: [], trafficValue: 0 });
      const acc = map.get(key)!;
      const sourceWeight = name === "구글" ? 1.12 : name === "시그널" ? 1.05 : 1;
      acc.score += Math.max(21 - item.rank, 1) * sourceWeight;
      acc.best = Math.min(acc.best, item.rank);
      acc.trafficValue = Math.max(acc.trafficValue, Number(item.trafficValue || 0));
      if (!acc.sources.includes(name)) acc.sources.push(name);
    });
  });
  return [...map.values()]
    .map(item => ({
      ...item,
      score: item.score + Math.max(0, item.sources.length - 1) * 18
        + Math.min(16, Math.log10(Math.max(item.trafficValue, 1)) * 3),
    }))
    .sort((a, b) => b.score - a.score || b.sources.length - a.sources.length || a.best - b.best)
    .slice(0, 20)
    .map((item, i) => ({ rank: i + 1, keyword: item.keyword, sources: item.sources }));
}

function kstSlot() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const hour = Math.floor(kst.getUTCHours() / 3) * 3;
  const date = kst.toISOString().slice(0, 10);
  return `${date} ${String(hour).padStart(2, "0")}:00`;
}

function kstDateKey(slot: string) {
  return String(slot || kstSlot()).slice(0, 10).replace(/[^0-9]/g, "");
}

function retentionCutoffSlot() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.toISOString().slice(0, 13).replace("T", " ") + ":00";
}

async function cleanupRealtimeSnapshots() {
  const cutoff = retentionCutoffSlot();
  await supabaseRequest(
    `/rest/v1/${SNAPSHOT_TABLE}?slot=lt.${encodeURIComponent(cutoff)}`,
    { method: "DELETE" },
  );
}

async function readSlots() {
  const rows: Array<{ slot: string }> = await supabaseRequest(
    `/rest/v1/${SNAPSHOT_TABLE}?select=slot&list_type=eq.realtime&rank=eq.1&order=slot.desc&limit=100`,
  ) || [];
  return [...new Set(rows.map(row => row.slot))].filter(slot => {
    const hour = Number(String(slot).match(/ (\d{2}):00$/)?.[1]);
    return Number.isFinite(hour) && hour % 3 === 0;
  });
}

async function readSnapshot(slot: string, listType: string) {
  const rows = await supabaseRequest(
    `/rest/v1/${SNAPSHOT_TABLE}?slot=eq.${encodeURIComponent(slot)}&list_type=eq.${listType}&select=rank,keyword,sources,captured_at&order=rank.asc&limit=100`,
  ) || [];
  return rows as Array<{ rank: number; keyword: string; sources: string; captured_at?: string }>;
}

async function saveSnapshot(slot: string, listType: string, items: { rank: number; keyword: string; sources?: string[] }[]) {
  await supabaseRequest(`/rest/v1/${SNAPSHOT_TABLE}?slot=eq.${encodeURIComponent(slot)}&list_type=eq.${listType}`, { method: "DELETE" });
  await supabaseRequest(`/rest/v1/${SNAPSHOT_TABLE}`, {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(items.map(item => ({
      slot, list_type: listType, rank: item.rank, keyword: item.keyword,
      sources: JSON.stringify(item.sources || []),
    }))),
  });
}

async function saveTrendArchive(slot: string, listType: string, items: { rank: number; keyword: string; sources?: string[] }[]) {
  if (!items.length) return 0;
  await supabaseRequest(`/rest/v1/${TREND_ARCHIVE_TABLE}?on_conflict=slot,list_type,keyword`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(items.map(item => ({
      slot, list_type: listType, rank: item.rank, keyword: item.keyword,
      sources: JSON.stringify(item.sources || []),
      updated_at: new Date().toISOString(),
    }))),
  });
  return items.length;
}

async function readTrendArchive(listType: string) {
  const rows = await supabaseRequest(
    `/rest/v1/${TREND_ARCHIVE_TABLE}?select=id,slot,list_type,rank,keyword,sources,captured_at&list_type=eq.${encodeURIComponent(listType)}&deleted_at=is.null&order=slot.desc,rank.asc&limit=300`,
  ) || [];
  return rows as Array<{ id: string; slot: string; list_type: string; rank: number; keyword: string; sources: string; captured_at?: string }>;
}

async function deleteTrendArchive(idRaw: unknown) {
  const id = String(idRaw || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("삭제할 트렌드 ID가 필요합니다.");
  await supabaseRequest(`/rest/v1/${TREND_ARCHIVE_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  return { ok: true, id };
}

function cleanIdeaKeyword(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function ideaKey(value: string) {
  return cleanIdeaKeyword(value).replace(/\s+/g, "");
}

function isBlogCandidate(keyword: string) {
  return /단열|아이소핑크|스티로폼|비드법|폼보드|열반사|은박|온도리|보온|결로|창문|햇빛|열차단|냉기|우레탄|PF보드|페놀폼|미네랄울|글라스울|실외기|에어컨|냉방비|전기요금|폭염|열대야|장마|제습|습기|곰팡이|차량용햇빛|자동차햇빛|차박|썬쉐이드|햇빛가리개|차량커튼|커버|XPS|EPS/i.test(keyword);
}

function isPotentialContentTopic(keyword: string) {
  return isBlogCandidate(keyword)
    || /기온|무더위|더위|한파|폭설|태풍|집중호우|호우|침수|습도|냉방|난방|전기료|에너지비|관리비|실내온도|주거|주택|아파트|리모델링|인테리어|셀프시공|DIY|캠핑|차량온도|자동차열|차량커튼|방수|누수|환기/i.test(keyword);
}

function isBlogNoise(keyword: string) {
  return /의원|선거|재검표|파업|노조|법원|회생|콘서트|홍보대사|역전승|외교관|이더|비니시우스|수력원자력|시위|MC몽|성애|연애/i.test(keyword);
}

function ideaCategory(keyword: string) {
  if (/아이소핑크|XPS|압출/i.test(keyword)) return "아이소핑크";
  if (/열반사|은박|온도리|단열필름/i.test(keyword)) return "열반사단열재";
  if (/단열벽지|벽지|결로|곰팡이|습기|제습|장마/i.test(keyword)) return "단열벽지";
  return "기타";
}

function ideaProductGroup(keyword: string, category = "") {
  const text = `${keyword} ${category}`;
  if (/제습|습기|장마|곰팡이|결로/i.test(text)) return "습기/결로 관리";
  if (/냉방비|전기요금|에어컨|실외기|폭염|열대야/i.test(text)) return "냉방비/실외기 관리";
  if (/차량용햇빛|자동차햇빛|차박|햇빛가리개|썬쉐이드|차량커튼/i.test(text)) return "차량 햇빛 차단";
  if (/창문|햇빛|열차단|단열필름/i.test(text)) return "창문 열차단";
  return category || "기타";
}

function ideaSeasonScore(keyword: string) {
  const month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
  const summer = /열차단|햇빛|창문|실외기|에어컨|냉방비|폭염|열대야|장마|제습|습기|차량용햇빛|자동차햇빛|썬쉐이드|열반사|단열필름|은박|온도리/i.test(keyword);
  const winter = /결로|냉기|난방|보온|곰팡이|단열벽지|바닥/i.test(keyword);
  if ([6, 7, 8, 9].includes(month)) return summer ? 94 : winter ? 42 : 68;
  if ([11, 12, 1, 2].includes(month)) return winter ? 94 : summer ? 45 : 68;
  return 72;
}

type ContentIdeaCandidate = {
  rank: number;
  keyword: string;
  sources: string[];
  context?: string;
};

type SemanticIdea = ContentIdeaCandidate & {
  relevanceScore: number;
  category: string;
  productGroup: string;
  contentAngle: string;
  selectionReason: string;
};

function clampScore(value: unknown, fallback = 0) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallback;
}

function contentIdeaPool(
  realtime: Array<{ rank: number; keyword: string; sources?: string[] }>,
  google: GoogleTrendItem[],
) {
  const map = new Map<string, ContentIdeaCandidate>();
  realtime.forEach(item => {
    const keyword = cleanIdeaKeyword(item.keyword);
    const key = ideaKey(keyword);
    if (!key || isBlogNoise(keyword) || !isPotentialContentTopic(keyword)) return;
    map.set(key, { rank: item.rank, keyword, sources: item.sources || ["실시간 통합"] });
  });
  google.forEach(item => {
    const keyword = cleanIdeaKeyword(item.keyword);
    const key = ideaKey(keyword);
    if (!key || isBlogNoise(keyword) || !isPotentialContentTopic(keyword)) return;
    const current = map.get(key);
    const sources = [...new Set([...(current?.sources || []), "구글"] )];
    map.set(key, {
      rank: Math.min(current?.rank || 99, item.rank), keyword, sources,
      context: [item.newsTitle, item.newsSource, item.trafficLabel && `검색 ${item.trafficLabel}`].filter(Boolean).join(" · "),
    });
  });
  return [...map.values()].sort((a, b) => a.rank - b.rank).slice(0, 36);
}

function fallbackSemanticIdeas(items: ContentIdeaCandidate[]): SemanticIdea[] {
  return items.filter(item => isBlogCandidate(item.keyword)).slice(0, 14).map(item => {
    const category = ideaCategory(item.keyword);
    return {
      ...item,
      relevanceScore: 72,
      category,
      productGroup: ideaProductGroup(item.keyword, category),
      contentAngle: `${item.keyword} 이슈를 생활 속 단열·열차단·습기 관리 관점으로 정리`,
      selectionReason: "현재 트렌드와 에너가드랩의 실용 콘텐츠 주제를 직접 연결할 수 있습니다.",
    };
  });
}

async function selectSemanticIdeas(items: ContentIdeaCandidate[]): Promise<SemanticIdea[]> {
  if (!items.length) return [];
  if (!OPENAI_API_KEY) return fallbackSemanticIdeas(items);
  const month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "너는 단열재 쇼핑몰의 엄격한 콘텐츠 편집자다. 키워드 자체가 날씨, 주거, 에너지 비용, 냉난방, 습기, 셀프시공, 차량 열차단처럼 소비자의 실용 문제를 나타낼 때만 채택한다. 사람 이름, 질병, 음식, 연예, 정치, 금융, 일반 IT 제품, 추상어를 단열과 비유하거나 억지로 연결하면 반드시 탈락시킨다. JSON만 반환한다.",
        },
        {
          role: "user",
          content: [
            `현재 한국 기준 월: ${month}월`,
            "아래 후보에서 최대 14개를 선택하세요. 적합한 후보가 없으면 빈 배열을 반환하세요.",
            "채택 예: 장마, 제습기, 냉방비, 폭염, 차량 햇빛차단, 실외기 관리, 결로, 창문 열차단.",
            "탈락 예: 연예인 이름, 치매, 스마트폰 신제품, 스포츠 경기, 정치인, 가짜뉴스. 단열과 문장으로 연결할 수 있다는 이유만으로 채택하지 마세요.",
            "keep은 키워드 자체가 실용 콘텐츠 수요를 담을 때만 true이며 relevanceScore 70 이상이어야 합니다.",
            "category는 아이소핑크, 열반사단열재, 단열벽지, 기타 중 하나로 분류하세요.",
            "contentAngle은 실제 블로그 제목 방향을 한 문장으로, selectionReason은 선정 이유를 짧게 작성하세요.",
            '반환 형식: {"items":[{"keyword":"","keep":true,"relevanceScore":0,"category":"기타","productGroup":"","contentAngle":"","selectionReason":""}]}',
            JSON.stringify(items),
          ].join("\n"),
        },
      ],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI 후보 선별 ${res.status}`);
  const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  const sourceMap = new Map(items.map(item => [ideaKey(item.keyword), item]));
  return (Array.isArray(parsed.items) ? parsed.items : []).map((row: any) => {
    const original = sourceMap.get(ideaKey(row.keyword));
    if (!original) return null;
    const relevanceScore = clampScore(row.relevanceScore);
    if (row.keep !== true || relevanceScore < 70 || !isPotentialContentTopic(original.keyword)) return null;
    const category = ["아이소핑크", "열반사단열재", "단열벽지", "기타"].includes(row.category) ? row.category : ideaCategory(original.keyword);
    return {
      ...original,
      relevanceScore,
      category,
      productGroup: cleanIdeaKeyword(row.productGroup) || ideaProductGroup(original.keyword, category),
      contentAngle: cleanIdeaKeyword(row.contentAngle),
      selectionReason: cleanIdeaKeyword(row.selectionReason),
    };
  }).filter(Boolean).slice(0, 14) as SemanticIdea[];
}

async function saveContentIdeas(slot: string, items: SemanticIdea[]) {
  const rows = items.map(item => {
    const seasonScore = ideaSeasonScore(`${item.keyword} ${item.contentAngle}`);
    const trendScore = Math.max(45, 105 - Number(item.rank || 99) * 4 + Math.max(0, item.sources.length - 1) * 6);
    return {
      id: `trend-${kstDateKey(slot)}-${ideaKey(item.keyword)}`,
      keyword: item.keyword,
      source: "trend",
      category: item.category,
      product_group: item.productGroup,
      search_volume: 0,
      competition_score: Math.max(25, Math.min(78, 45 + Number(item.rank || 0))),
      season_score: seasonScore,
      trend_score: clampScore(trendScore),
      ai_score: clampScore(item.relevanceScore * 0.48 + trendScore * 0.34 + seasonScore * 0.18),
      content_angle: item.contentAngle,
      selection_reason: item.selectionReason,
      updated_at: new Date().toISOString(),
    };
  });
  if (!rows.length) return 0;
  const idsFilter = encodeURIComponent(`(${rows.map(row => `"${row.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`);
  const existing: Array<{ id: string; status: string }> = await supabaseRequest(
    `/rest/v1/${CONTENT_IDEA_TABLE}?select=id,status&id=in.${idsFilter}`,
  ).catch(() => []) || [];
  const existingStatus = new Map(existing.map(row => [row.id, row.status]));
  const writableRows = rows
    .filter(row => !existingStatus.has(row.id) || existingStatus.get(row.id) === "candidate")
    .map(row => ({ ...row, status: existingStatus.get(row.id) || "candidate" }));
  if (!writableRows.length) return 0;
  await supabaseRequest(`/rest/v1/${CONTENT_IDEA_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(writableRows),
  });
  return writableRows.length;
}

async function addContentIdea(body: Record<string, unknown>) {
  const keyword = cleanIdeaKeyword(String(body.keyword || ""));
  if (!keyword) throw new Error("추가할 키워드가 필요합니다.");
  const listType = String(body.listType || body.source || "").trim();
  const fromSearch = listType === "keywordSearch" || listType === "keyword_search" || listType === "search";
  const id = `${fromSearch ? "manual-search" : "manual-trend"}-${ideaKey(keyword)}`;
  const existing = await supabaseRequest(
    `/rest/v1/${CONTENT_IDEA_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  ).catch(() => []);
  const searchVolume = Math.max(0, Number(body.searchVolume || body.search_volume || 0));
  const products = Math.max(0, Number(body.products || 0));
  const requestedCompetition = Number(body.competitionScore || body.competition_score || 0);
  if (Array.isArray(existing) && existing[0]) {
    const patch: Record<string, unknown> = {
      source: fromSearch ? "keyword_search" : "trend_manual",
      selection_reason: fromSearch
        ? "키워드 분석에서 저장한 발굴 키워드입니다."
        : "트렌드 분석에서 직접 선택한 영감 키워드입니다.",
      updated_at: new Date().toISOString(),
    };
    if (searchVolume > 0) patch.search_volume = searchVolume;
    if (requestedCompetition > 0) patch.competition_score = clampScore(requestedCompetition);
    const updated = await supabaseRequest(`/rest/v1/${CONTENT_IDEA_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(patch),
    }).catch(() => existing);
    return { ok: true, alreadyExists: true, item: Array.isArray(updated) ? updated[0] : { ...existing[0], ...patch } };
  }

  const rank = Math.max(1, Number(body.rank || 99));
  const category = ideaCategory(keyword);
  const seasonScore = ideaSeasonScore(keyword);
  const trendScore = clampScore(Math.max(45, 105 - rank * 4));
  const competitionScore = requestedCompetition > 0
    ? clampScore(requestedCompetition)
    : Math.max(25, Math.min(78, 45 + rank));
  const row = {
    id,
    keyword,
    source: fromSearch ? "keyword_search" : "trend_manual",
    category,
    product_group: ideaProductGroup(keyword, category),
    search_volume: searchVolume,
    competition_score: competitionScore,
    season_score: seasonScore,
    trend_score: trendScore,
    ai_score: clampScore(trendScore * 0.5 + seasonScore * 0.3 + Math.min(20, searchVolume / 1000) - Math.min(10, products / 100000)),
    content_angle: `${keyword} 이슈를 생활 속 단열·열차단·습기 관리 관점에서 검토`,
    selection_reason: fromSearch
      ? "키워드 분석에서 저장한 발굴 키워드입니다."
      : "트렌드 분석에서 직접 선택한 영감 키워드입니다.",
    status: "candidate",
    updated_at: new Date().toISOString(),
  };
  const saved = await supabaseRequest(`/rest/v1/${CONTENT_IDEA_TABLE}`, {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify([row]),
  });
  return { ok: true, alreadyExists: false, item: Array.isArray(saved) ? saved[0] : row };
}

async function deleteContentIdea(idRaw: unknown) {
  const id = String(idRaw || "").trim();
  if (!id) throw new Error("삭제할 발굴 키워드 ID가 필요합니다.");
  await supabaseRequest(`/rest/v1/${CONTENT_DRAFT_TABLE}?idea_id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" },
  }).catch(() => null);
  await supabaseRequest(`/rest/v1/${CONTENT_IDEA_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" },
  });
  return { ok: true, id };
}

function parseStoredSources(value: string) {
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch (_) { /* 기존 문자열 형식으로 처리 */ }
  }
  return text.split(",").map(item => item.trim()).filter(Boolean);
}

function fillFromPrevious(
  items: Array<{ rank: number; keyword: string; sources: string[] }>,
  previous: Array<{ rank: number; keyword: string; sources: string }>,
  limit = 20,
) {
  const result = [...items];
  const used = new Set(result.map(item => item.keyword.replace(/[^0-9a-z가-힣]/gi, "").toLowerCase()));
  for (const row of previous) {
    if (result.length >= limit) break;
    const key = row.keyword.replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();
    if (!key || used.has(key)) continue;
    used.add(key);
    result.push({ rank: result.length + 1, keyword: row.keyword, sources: [...parseStoredSources(row.sources), "직전 자료"] });
  }
  return result.map((item, index) => ({ ...item, rank: index + 1 }));
}

function withDelta(
  items: { rank: number; keyword: string; sources?: string[] }[],
  prev: Array<{ rank: number; keyword: string }>,
) {
  const prevMap = new Map(prev.map(row => [row.keyword.replace(/\s+/g, ""), row.rank]));
  return items.map(item => {
    const prevRank = prevMap.get(item.keyword.replace(/\s+/g, ""));
    return {
      ...item,
      change: prevRank == null ? "new" : prevRank > item.rank ? "up" : prevRank < item.rank ? "down" : "same",
      delta: prevRank == null ? null : prevRank - item.rank,
    };
  });
}

async function collectRealtime() {
  const results = await Promise.allSettled([fetchSignal(), fetchNate(), fetchGoogleTrends()]);
  const signal = results[0].status === "fulfilled" ? results[0].value : [];
  const nate = results[1].status === "fulfilled" ? results[1].value : [];
  const google = results[2].status === "fulfilled" ? results[2].value : [];
  const failed = ["시그널", "네이트", "구글"].filter((_, i) => results[i].status === "rejected");
  if (!signal.length && !nate.length) throw new Error("실시간 소스 모두 실패: " + failed.join(", "));

  const slot = kstSlot();
  const slotsBefore = await readSlots().catch(() => [] as string[]);
  const previousSlot = slotsBefore.find(item => item < slot) || "";
  const previousRealtime = previousSlot ? await readSnapshot(previousSlot, "realtime").catch(() => []) : [];

  const mergedBase = mergeRealtime([
    { name: "시그널", items: signal },
    { name: "네이트", items: nate },
    { name: "구글", items: google },
  ]);
  const merged = fillFromPrevious(mergedBase, previousRealtime);
  const googleList = google.map(item => ({
    rank: item.rank,
    keyword: item.keyword,
    sources: [
      "구글",
      item.trafficLabel ? `검색 ${item.trafficLabel}` : "",
      relativeAge(item.publishedAt),
      item.newsCount ? `관련 뉴스 ${item.newsCount}건` : "",
      item.newsSource ? `대표 ${item.newsSource}` : "",
    ].filter(Boolean),
  }));

  // 스냅샷 저장 + 직전 슬롯과 비교해 변동 계산
  let realtimeOut = merged.map(item => ({ ...item, change: "same", delta: null as number | null }));
  let googleOut = googleList.map(item => ({ ...item, change: "same", delta: null as number | null }));
  let slots: string[] = [];
  try {
    await saveSnapshot(slot, "realtime", merged);
    await saveTrendArchive(slot, "realtime", merged);
    if (googleList.length) await saveSnapshot(slot, "google", googleList);
    if (googleList.length) await saveTrendArchive(slot, "google", googleList);
    await cleanupRealtimeSnapshots();
    const ideaPool = contentIdeaPool(merged, google);
    const semanticIdeas = await selectSemanticIdeas(ideaPool).catch(() => fallbackSemanticIdeas(ideaPool));
    await saveContentIdeas(slot, semanticIdeas);
    slots = await readSlots();
    const prevSlot = slots.find(s => s < slot);
    if (prevSlot) {
      realtimeOut = withDelta(merged, await readSnapshot(prevSlot, "realtime"));
      googleOut = withDelta(googleList, await readSnapshot(prevSlot, "google"));
    }
  } catch (_) { /* 스냅샷 실패 시 변동 없이 현재 순위만 반환 */ }

  return {
    slot,
    slots,
    capturedAt: new Date().toISOString(),
    realtime: realtimeOut,
    google: googleOut,
    sourceNote: failed.length ? `${failed.join("·")} 소스 응답 없음` : "",
  };
}

async function handleRealtime() {
  const slots = await readSlots();
  const slot = slots[0] || "";
  const mapArchiveRows = (rows: Array<{ id: string; slot: string; rank: number; keyword: string; sources: string; captured_at?: string }>) =>
    rows.map((row, index) => ({
      id: row.id,
      rank: index + 1,
      originalRank: row.rank,
      keyword: row.keyword,
      sources: parseStoredSources(row.sources),
      slot: row.slot,
      capturedAt: row.captured_at,
      change: "same",
      delta: null,
    }));
  const realtimeRows = await readTrendArchive("realtime").catch(() => []);
  const googleRows = await readTrendArchive("google").catch(() => []);
  if (!slot && !realtimeRows.length && !googleRows.length) return { slot: "", slots: [], capturedAt: null, realtime: [], google: [], sourceNote: "저장된 실시간 자료 없음" };
  return {
    slot,
    slots,
    capturedAt: realtimeRows[0]?.captured_at || googleRows[0]?.captured_at || null,
    realtime: mapArchiveRows(realtimeRows),
    google: mapArchiveRows(googleRows),
    sourceNote: "누적 저장 데이터",
    archive: true,
  };
}

async function handleRealtimeAt(slotRaw: string) {
  const slot = String(slotRaw || "");
  if (!slot) throw new Error("slot이 필요합니다.");
  const slots = await readSlots();
  const prevSlot = slots.find(s => s < slot);
  const realtimeRows = await readSnapshot(slot, "realtime");
  const googleRows = await readSnapshot(slot, "google");
  const mapRows = (rows: Array<{ rank: number; keyword: string; sources: string }>) =>
    rows.map(row => ({ rank: row.rank, keyword: row.keyword, sources: parseStoredSources(row.sources) }));
  return {
    slot,
    slots,
    capturedAt: realtimeRows[0]?.captured_at || googleRows[0]?.captured_at || null,
    realtime: withDelta(mapRows(realtimeRows), prevSlot ? await readSnapshot(prevSlot, "realtime") : []),
    google: withDelta(mapRows(googleRows), prevSlot ? await readSnapshot(prevSlot, "google") : []),
    sourceNote: "",
  };
}

/* ───────── 단열 관련 이슈 TOP 20 (네이버 뉴스 검색 API) ─────────
   단열 시드어로 최근 뉴스를 수집해, 같은 이슈를 다룬 기사끼리 묶고
   기사 수 × 최신성으로 순위를 매긴다. 공식 API라 안정적. */

const NICHE_BASE_SEEDS = [
  "단열재", "단열 시공", "아이소핑크", "우레탄폼", "열반사단열재",
  "준불연 단열재", "결로", "벽 곰팡이", "누수", "리모델링 단열",
];
const NICHE_SUMMER_SEEDS = ["폭염 냉방비", "에어컨 실외기", "제습기 장마", "창문 열차단", "차량 햇빛 차단", "단열필름"];
const NICHE_WINTER_SEEDS = ["난방비 절약", "창문 외풍", "결로 방지", "보일러", "단열벽지", "바닥 단열"];

function nicheSeeds() {
  const month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
  const seasonal = [5, 6, 7, 8, 9].includes(month) ? NICHE_SUMMER_SEEDS
    : [11, 12, 1, 2].includes(month) ? NICHE_WINTER_SEEDS
    : ["결로 방지", "냉난방비", "창문 단열", "셀프 인테리어", "단열필름", "제습기"];
  return [...new Set([...NICHE_BASE_SEEDS, ...seasonal])];
}

function stripTags(s: string) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").trim();
}

function titleTokens(title: string) {
  return new Set(
    title.replace(/[^\w가-힣\s]/g, " ").split(/\s+/).filter(t => t.length >= 2),
  );
}

async function fetchNicheNews(seed: string, sort: "date" | "sim") {
  const clientId = Deno.env.get("NAVER_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 필요합니다.");
  const res = await fetch(
    `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(seed)}&display=20&sort=${sort}`,
    {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`뉴스 API ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item: { title: string; description: string; link: string; originallink: string; pubDate: string }) => ({
    title: stripTags(item.title),
    description: stripTags(item.description),
    link: item.link || item.originallink || "",
    source: (() => {
      try { return new URL(item.originallink || item.link || "").hostname.replace(/^www\./, ""); } catch (_) { return ""; }
    })(),
    pubDate: new Date(item.pubDate).getTime() || 0,
    seed, sort,
  }));
}

async function collectNicheTrendData() {
  const seeds = nicheSeeds();
  const requests = seeds.flatMap(seed => [fetchNicheNews(seed, "date"), fetchNicheNews(seed, "sim")]);
  const results = await Promise.allSettled(requests);
  const articles: Array<{ title: string; description: string; link: string; source: string; pubDate: number; seed: string; sort: string }> = [];
  results.forEach(result => {
    if (result.status === "fulfilled") articles.push(...result.value);
  });
  if (!articles.length) throw new Error("뉴스 조회 실패 (NAVER_CLIENT_ID 시크릿 확인)");

  // 최근 30일 기사만, 최신순
  const monthAgo = Date.now() - 30 * 86400000;
  const domainPattern = /단열|결로|곰팡이|누수|방수|냉방|난방|폭염|열대야|장마|제습|습기|에어컨|실외기|창문|창호|샷시|햇빛|열차단|외풍|보일러|리모델링|집수리|에너지효율|에너지 효율|녹색건축|제로에너지|패시브|우레탄|아이소핑크|스티로폼|준불연|PF보드|단열필름/i;
  const noisePattern = /선거|증시|코인|야구|축구|연예|콘서트|게임|드라마|영화|부고|인사 이동|보험 손해율|치과용|진료|건강보험/i;
  const physicalLeakPattern = /주택|건물|건축|아파트|상가|옥상|지붕|벽|천장|배관|수도|누수탐지|방수|시설|공사|하자|침수/i;
  const physicalCondensationPattern = /창문|유리|벽|천장|주택|건물|건축|아파트|습기|곰팡이|단열|창호|겨울|하자|시공|방지|제습/i;
  const isRelevantTitle = (title: string) => {
    if (!title || noisePattern.test(title) || !domainPattern.test(title)) return false;
    if (/누수/.test(title) && !physicalLeakPattern.test(title)) return false;
    if (/결로/.test(title) && !physicalCondensationPattern.test(title)) return false;
    return true;
  };
  const seen = new Set<string>();
  const recent = articles
    .filter(a => a.pubDate >= monthAgo && isRelevantTitle(a.title))
    .filter(a => {
      const key = (a.link || a.title).replace(/[?#].*$/, "").replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.pubDate - a.pubDate);

  // 제목 토큰이 3개 이상 겹치면 같은 이슈로 묶기 (탐욕적 클러스터링)
  type Cluster = {
    title: string; link: string; pubDate: number; count: number; seeds: Set<string>;
    sources: Set<string>; tokens: Set<string>; relevanceHits: number;
  };
  const clusters: Cluster[] = [];
  recent.forEach(article => {
    const tokens = titleTokens(article.title);
    const found = clusters.find(cluster => {
      let overlap = 0;
      tokens.forEach(t => { if (cluster.tokens.has(t)) overlap++; });
      const denominator = Math.max(1, Math.min(tokens.size, cluster.tokens.size));
      return overlap >= 2 && overlap / denominator >= 0.5;
    });
    if (found) {
      found.count += 1;
      found.seeds.add(article.seed);
      if (article.source) found.sources.add(article.source);
      tokens.forEach(t => found.tokens.add(t));
      if (article.pubDate > found.pubDate) {
        found.pubDate = article.pubDate;
      }
    } else {
      clusters.push({
        title: article.title, link: article.link, pubDate: article.pubDate,
        count: 1, seeds: new Set([article.seed]), sources: new Set(article.source ? [article.source] : []), tokens,
        relevanceHits: [...titleTokens(article.title)].filter(token => domainPattern.test(token)).length,
      });
    }
  });

  // 관련성·최신성·보도량·언론사 다양성을 합산한 이슈 점수
  const now = Date.now();
  const scored = clusters.map(cluster => {
    const ageHours = (now - cluster.pubDate) / 3600000;
    const relevance = Math.min(35, 15 + cluster.relevanceHits * 5 + cluster.seeds.size * 3);
    const recency = ageHours <= 6 ? 25 : ageHours <= 24 ? 20 : ageHours <= 72 ? 12
      : ageHours <= 168 ? 7 : ageHours <= 336 ? 4 : 1;
    const coverage = Math.min(20, cluster.count * 4);
    const diversity = Math.min(15, cluster.sources.size * 4);
    const score = relevance + recency + coverage + diversity + Math.min(5, cluster.seeds.size);
    return { ...cluster, score };
  }).sort((a, b) => b.score - a.score || b.pubDate - a.pubDate);

  const fmtAge = (t: number) => {
    const h = Math.floor((now - t) / 3600000);
    if (h < 1) return "방금";
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  return {
    date: "네이버 뉴스 · 최근 30일",
    niche: scored.slice(0, 20).map((cluster, i) => ({
      rank: i + 1,
      keyword: cluster.title,
      link: cluster.link,
      query: [...cluster.seeds][0],
      sources: [
        `이슈 ${cluster.score}점`, `기사 ${cluster.count}건`, `언론사 ${cluster.sources.size}곳`,
        fmtAge(cluster.pubDate), [...cluster.seeds].slice(0, 2).join("·"),
      ],
      change: "same",
      delta: null,
    })),
  };
}

/* ───────── 단열 검색량 급증 감지 (데이터랩 검색어트렌드 API, 공식) ─────────
   단열 키워드 풀의 최근 30일 일별 검색 추이를 받아,
   "평소(직전 3주 평균) 대비 최근 이틀"의 배율로 급증을 감지한다.
   → 사람들이 실제로 검색하기 시작한 단열 주제를 포착 */

const SPIKE_KEYWORDS = [
  "단열재", "단열", "아이소핑크", "스티로폼", "우레탄폼", "압출법단열재", "열반사단열재", "그라스울",
  "단열벽지", "단열필름", "단열페인트", "단열시공", "샌드위치패널", "준불연", "PF보드",
  "문풍지", "뽁뽁이", "방풍비닐", "외풍차단", "창문단열", "샷시교체", "창호",
  "결로", "결로방지", "곰팡이제거", "방습제", "제습기", "벽지곰팡이",
  "방음재", "흡음재", "난방비절약", "보일러교체", "온수매트", "전기장판",
  "코킹", "옥상방수", "누수", "리모델링", "셀프인테리어", "단열도어",
  "냉방비", "전기요금", "에어컨전기세", "에어컨실외기", "실외기커버", "실외기차광막",
  "폭염", "열대야", "장마", "습도", "제습기전기세", "창문햇빛차단", "차량햇빛가리개",
  "썬쉐이드", "차박단열", "은박단열재", "온도리", "미네랄울", "경질우레탄보드",
];

async function fetchDatalabTrend(keywords: string[], startDate: string, endDate: string) {
  const clientId = Deno.env.get("NAVER_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 필요합니다.");
  const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    body: JSON.stringify({
      startDate, endDate, timeUnit: "date",
      keywordGroups: keywords.map(k => ({ groupName: k, keywords: [k] })),
    }),
  });
  if (!res.ok) throw new Error(`데이터랩 검색어트렌드 ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  return (data.results || []) as Array<{ title: string; data: Array<{ period: string; ratio: number }> }>;
}

async function collectNicheSpikeData() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const end = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 86400000); // 어제
  const start = new Date(end.getTime() - 29 * 86400000);
  const startDate = fmtDate(start);
  const endDate = fmtDate(end);

  // 데이터랩은 요청당 키워드 그룹 5개 제한 → 5개씩 배치 병렬 호출
  const batches: string[][] = [];
  for (let i = 0; i < SPIKE_KEYWORDS.length; i += 5) batches.push(SPIKE_KEYWORDS.slice(i, i + 5));
  const series: Array<{ title: string; data: Array<{ period: string; ratio: number }> }> = [];
  let failCount = 0;
  // 네이버 API의 순간 호출 제한과 전체 대기 시간을 함께 제어한다.
  for (let i = 0; i < batches.length; i += 4) {
    const settled = await Promise.allSettled(
      batches.slice(i, i + 4).map(batch => fetchDatalabTrend(batch, startDate, endDate)),
    );
    settled.forEach(result => {
      if (result.status === "fulfilled") series.push(...result.value);
      else failCount++;
    });
  }
  if (!series.length) {
    throw new Error("검색어트렌드 조회 실패 — 네이버 애플리케이션에 '데이터랩(검색어트렌드)' API가 등록되어 있는지 확인해 주세요.");
  }

  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const robustAverage = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.length >= 10 ? sorted.slice(1, -1) : sorted;
    return average(trimmed);
  };

  const candidates = series.map(s => {
    const byDate = new Map(s.data.map(d => [d.period, d.ratio]));
    // 최근 30일 날짜 배열 구성 (빠진 날 = 0)
    const ratios: number[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      ratios.push(byDate.get(fmtDate(new Date(t))) || 0);
    }
    const recent = average(ratios.slice(-2));
    const baseline = robustAverage(ratios.slice(0, -7));
    const currentWeek = average(ratios.slice(-7));
    const previousWeek = average(ratios.slice(-14, -7));
    const spike = recent / Math.max(baseline, 1);
    const momentum = currentWeek / Math.max(previousWeek, 1);
    const spikeScore = Math.min(100, Math.max(0, (spike - 0.8) * 48));
    const momentumScore = Math.min(100, Math.max(0, (momentum - 0.8) * 55));
    const levelScore = Math.min(100, Math.max(0, recent));
    const signalScore = spikeScore * 0.5 + momentumScore * 0.28 + levelScore * 0.22;
    return {
      keyword: s.title,
      spike: Math.round(spike * 10) / 10,
      momentum: Math.round(momentum * 10) / 10,
      recent: Math.round(recent),
      baseline: Math.round(baseline),
      signalScore,
      week: ratios.slice(-7).map(r => Math.round(r)),
    };
  })
  .filter(item => item.recent > 0)
  .sort((a, b) => b.signalScore - a.signalScore || b.spike - a.spike)
  .slice(0, 30);

  // 검색량 검증은 급상승 가능성이 높은 30개에만 수행해 응답 시간을 줄인다.
  const volumeMap = await fetchSearchVolumeBatch(candidates.map(item => item.keyword));
  const items = candidates.map(item => {
    const volume = volumeMap.has(item.keyword) ? volumeMap.get(item.keyword)! : null;
    const volumeConfidence = volume == null ? 0.55 : Math.min(1, Math.log10(Math.max(volume, 10)) / 4);
    return { ...item, volume, score: Math.round(item.signalScore * (0.68 + volumeConfidence * 0.32)) };
  })
  .filter(item => item.volume == null || item.volume >= 10)
  .sort((a, b) => b.score - a.score || b.spike - a.spike || b.recent - a.recent);

  return {
    date: `${endDate} 기준 · 직전 3주 평균 대비 최근 이틀`,
    failNote: failCount ? `${failCount}개 배치 조회 실패` : "",
    niche: items.slice(0, 20).map((item, i) => ({
      rank: i + 1,
      keyword: item.keyword,
      spike: item.spike,
      volume: item.volume,
      query: item.keyword,
      sources: [
        `급상승 ${item.score}점`, `평소 ${item.baseline} → 최근 ${item.recent}`,
        `주간 ×${item.momentum}`, item.volume == null ? "검색량 확인 안 됨" : `월간 ${item.volume.toLocaleString()}회`,
      ],
      change: item.spike >= 1.5 ? "up" : "same",
      delta: null,
    })),
  };
}

async function collectNicheDaily() {
  const [newsResult, spikeResult] = await Promise.allSettled([
    collectNicheTrendData(), collectNicheSpikeData(),
  ]);
  const saved: string[] = [];
  const errors: string[] = [];
  if (newsResult.status === "fulfilled") {
    await saveNicheDailySnapshot("news", newsResult.value);
    saved.push("news");
  } else errors.push(`news: ${String(newsResult.reason?.message || newsResult.reason)}`);
  if (spikeResult.status === "fulfilled") {
    await saveNicheDailySnapshot("spike", spikeResult.value);
    saved.push("spike");
  } else errors.push(`spike: ${String(spikeResult.reason?.message || spikeResult.reason)}`);
  if (!saved.length) throw new Error(errors.join(" / "));
  await cleanupNicheDailySnapshots().catch(() => null);
  return { ok: true, snapshotDate: kstToday(), saved, errors, capturedAt: new Date().toISOString() };
}

async function handleNicheTrend() {
  return await readLatestNicheSnapshot("news") || {
    date: "저장된 단열 뉴스 없음", niche: [], storedAt: null, snapshotDate: null,
  };
}

async function handleNicheSpike() {
  return await readLatestNicheSnapshot("spike") || {
    date: "저장된 단열 급상승 자료 없음", niche: [], failNote: "", storedAt: null, snapshotDate: null,
  };
}

/* ───────── 카테고리 탐색기 (1·2·3차 카테고리 → 인기 키워드 + 검색수/상품수/경쟁지수) ─────────
   카테고리 트리: 데이터랩 쇼핑인사이트 내부 API (비공식, 1차는 getCategoryList.naver,
   2차 이하는 getCategory.naver?cid=<부모cid>). 인기 키워드는 기존 fetchRank() 재사용.
   검색수(검색광고 키워드도구)·상품수(쇼핑 검색 API)는 naver-rank 함수와 동일한 공식 API. */

const CATEGORY_LIST_URL = "https://datalab.naver.com/shoppingInsight/getCategoryList.naver";
const CATEGORY_TREE_URL = "https://datalab.naver.com/shoppingInsight/getCategory.naver";
const DATALAB_HEADERS = {
  "User-Agent": UA,
  "Referer": "https://datalab.naver.com/shoppingInsight/sCategory.naver",
};

async function fetchCategoryRoots() {
  const res = await fetch(CATEGORY_LIST_URL, { headers: DATALAB_HEADERS });
  if (!res.ok) throw new Error(`카테고리 목록 조회 ${res.status}`);
  const list: Array<{ cid: number; name: string }> = await res.json();
  return list.map(item => ({ cid: String(item.cid), name: item.name, leaf: false }));
}

async function fetchCategoryChildren(cid: string) {
  const res = await fetch(`${CATEGORY_TREE_URL}?cid=${encodeURIComponent(cid)}`, { headers: DATALAB_HEADERS });
  if (!res.ok) throw new Error(`카테고리 조회 ${res.status}`);
  const data = await res.json();
  const children: Array<{ cid: number; name: string; leaf: boolean }> = data.childList || [];
  return children.map(item => ({ cid: String(item.cid), name: item.name, leaf: !!item.leaf }));
}

async function handleCategoryTree(cidRaw: unknown) {
  const cid = String(cidRaw || "0");
  const children = cid === "0" ? await fetchCategoryRoots() : await fetchCategoryChildren(cid);
  return { cid, children };
}

function normKw(s: string) {
  return String(s || "").replace(/\s+/g, "").toUpperCase();
}

async function adSignature(secret: string, timestamp: string, method: string, path: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${timestamp}.${method}.${path}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// 검색광고 키워드도구 — 최대 5개씩 묶어 월간 검색량(PC+모바일) 조회
async function fetchSearchVolumeBatch(keywords: string[]) {
  const customerId = Deno.env.get("NAVER_AD_CUSTOMER_ID") || "";
  const license = Deno.env.get("NAVER_AD_ACCESS_LICENSE") || "";
  const secret = Deno.env.get("NAVER_AD_SECRET_KEY") || "";
  const volumeMap = new Map<string, number>();
  if (!customerId || !license || !secret || !keywords.length) return volumeMap;

  const path = "/keywordstool";
  for (let i = 0; i < keywords.length; i += 5) {
    const batch = keywords.slice(i, i + 5);
    const hint = batch.map(normKw).join(",");
    const timestamp = String(Date.now());
    const sig = await adSignature(secret, timestamp, "GET", path);
    try {
      const res = await fetch(
        `https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`,
        {
          headers: { "X-Timestamp": timestamp, "X-API-KEY": license, "X-Customer": customerId, "X-Signature": sig },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const list: Array<Record<string, unknown>> = data.keywordList ?? [];
      const targets = new Set(batch.map(normKw));
      list.forEach(k => {
        const rel = normKw(String(k.relKeyword ?? ""));
        if (!targets.has(rel)) return;
        const pc = Number(k.monthlyPcQcCnt) || (String(k.monthlyPcQcCnt) === "< 10" ? 5 : 0);
        const mobile = Number(k.monthlyMobileQcCnt) || (String(k.monthlyMobileQcCnt) === "< 10" ? 5 : 0);
        const original = batch.find(b => normKw(b) === rel);
        if (original) volumeMap.set(original, pc + mobile);
      });
    } catch (_) { /* 배치 실패 시 해당 키워드는 검색량 없음으로 처리 */ }
  }
  return volumeMap;
}

async function fetchProductCount(keyword: string) {
  const clientId = Deno.env.get("NAVER_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=1&sort=sim`,
      { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Number(data.total) || 0;
  } catch (_) {
    return null;
  }
}

// 상품수÷검색량 비율을 0~100 경쟁지수로 (naver-rank.html의 compScore와 동일한 로그 보간)
function compScore(ratio: number | null) {
  if (ratio == null) return null;
  if (ratio <= 0) return 0;
  const anchors: [number, number][] = [[0.05, 0], [0.8, 40], [3, 70], [50, 100]];
  if (ratio <= anchors[0][0]) return 0;
  if (ratio >= anchors[anchors.length - 1][0]) return 100;
  for (let i = 0; i < anchors.length - 1; i++) {
    const [r1, s1] = anchors[i];
    const [r2, s2] = anchors[i + 1];
    if (ratio <= r2) {
      const t = (Math.log10(ratio) - Math.log10(r1)) / (Math.log10(r2) - Math.log10(r1));
      return Math.round(s1 + t * (s2 - s1));
    }
  }
  return 100;
}

async function handleCategoryKeywords(body: JsonBody) {
  const cid = String(body.cid || "");
  if (!cid) throw new Error("cid가 필요합니다.");
  const count = Math.min(Math.max(Number(body.count) || 20, 5), 30);

  let p = periods("date", 0);
  let curRanks: Array<{ rank: number; keyword: string }> = [];
  for (let offset = 0; offset <= 2; offset++) {
    p = periods("date", offset);
    try {
      curRanks = await fetchRank(cid, p.cur.start, p.cur.end, "date", count);
      if (curRanks.length) break;
    } catch (_) { /* 다음 offset 시도 */ }
  }
  if (!curRanks.length) throw new Error("이 카테고리의 인기 키워드를 가져오지 못했습니다.");

  const keywordList = curRanks.slice(0, count).map(r => r.keyword);
  const [volumeMap, productCounts] = await Promise.all([
    fetchSearchVolumeBatch(keywordList),
    Promise.all(keywordList.map(kw => fetchProductCount(kw))),
  ]);

  const items = keywordList.map((keyword, i) => {
    const volume = volumeMap.has(keyword) ? volumeMap.get(keyword)! : null;
    const products = productCounts[i];
    const ratio = (volume != null && volume > 0 && products != null) ? products / volume : null;
    return {
      rank: i + 1,
      keyword,
      volume,
      products,
      compRatio: ratio == null ? null : Math.round(ratio * 100) / 100,
      compScore: compScore(ratio),
    };
  });

  return { cid, date: p.cur.end, items };
}

type JsonBody = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "realtime") return json(await handleRealtime());
    if (body.action === "collectRealtime") return json(await collectRealtime());
    if (body.action === "realtimeAt") return json(await handleRealtimeAt(body.slot));
    if (body.action === "deleteRealtimeTrend") return json(await deleteTrendArchive(body.id));
    if (body.action === "addContentIdea") return json(await addContentIdea(body));
    if (body.action === "deleteContentIdea") return json(await deleteContentIdea(body.id));
    if (body.action === "collectNicheDaily") return json(await collectNicheDaily());
    if (body.action === "nicheTrend") return json(await handleNicheTrend());
    if (body.action === "nicheSpike") return json(await handleNicheSpike());
    if (body.action === "categoryTree") return json(await handleCategoryTree(body.cid));
    if (body.action === "categoryKeywords") return json(await handleCategoryKeywords(body));
    const category: string = body.category || "생활/건강";
    const timeUnit: string = ["date", "week", "month"].includes(body.timeUnit) ? body.timeUnit : "date";
    const count: number = Math.min(Number(body.count) || 20, 100);

    const cid = CATEGORY_CID[category] || String(body.cid || "");
    if (!cid) {
      return json({ error: `알 수 없는 카테고리: ${category}`, available: Object.keys(CATEGORY_CID) }, 400);
    }

    // 집계 지연 대응: 기준일을 0~2일 물려가며 데이터가 있는 날짜를 찾음
    let p = periods(timeUnit, 0);
    let curRanks: Array<{ rank: number; keyword: string }> = [];
    let lastErr = "";
    for (let offset = 0; offset <= 2; offset++) {
      p = periods(timeUnit, offset);
      try {
        curRanks = await fetchRank(cid, p.cur.start, p.cur.end, p.unit, count);
        if (curRanks.length) break;
        lastErr = `${p.cur.start} 데이터 없음(집계 전)`;
      } catch (e) {
        lastErr = String(e);
      }
    }
    if (!curRanks.length) {
      return json({ error: "데이터랩 조회 실패", detail: lastErr }, 502);
    }

    const prevMap = new Map<string, number>();
    try {
      const prevRanks = await fetchRank(cid, p.prev.start, p.prev.end, p.unit, count + 30);
      for (const r of prevRanks) prevMap.set(r.keyword, r.rank);
    } catch (_) { /* 이전 기간 실패 시 변동 표시만 생략 */ }

    const keywords = curRanks.slice(0, count).map((r) => {
      const prev = prevMap.get(r.keyword) ?? null;
      let change: string;
      let delta: number | null = null;
      if (prev == null) change = "new";
      else {
        delta = prev - r.rank;
        change = delta > 0 ? "up" : delta < 0 ? "down" : "same";
      }
      return { rank: r.rank, keyword: r.keyword, prevRank: prev, delta, change };
    });

    return json({
      category,
      cid,
      timeUnit,
      period: p.cur,
      comparedTo: prevMap.size ? p.prev : null,
      keywords,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: "서버 오류", detail: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
