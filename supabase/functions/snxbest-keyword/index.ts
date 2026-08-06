// supabase/functions/snxbest-keyword/index.ts
// 네이버플러스스토어 BEST 키워드 — snxbest.naver.com 공개 API 프록시
// ⚠ 비공식 엔드포인트 사용: 네이버가 페이지 구조를 바꾸면 동작이 멈출 수 있습니다.
// 시크릿 불필요 (공개 데이터, 쿠키·인증 없이 응답 확인됨). CORS를 안 열어주는 API라 브라우저
// 직접 호출은 막히고, 서버(여기)를 거쳐야 한다 — shopping-trend(데이터랩)와 같은 이유.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SNXBEST_URL = "https://snxbest.naver.com/api/v1/snxbest/keyword/rank";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/* 네이버 쇼핑 1차 카테고리 CID — shopping-trend/index.ts의 CATEGORY_CID와 동일 목록 */
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

const SORT_TYPE: Record<string, string> = {
  popular: "KEYWORD_POPULAR",
  issue: "KEYWORD_ISSUE",
  new: "KEYWORD_NEW",
};

const PERIOD_TYPE: Record<string, string> = {
  date: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
};

interface SnxItem {
  rank: number;
  status: "UP" | "DOWN" | "STABLE" | "SOAR" | "NEW";
  rankFluctuation?: number;
  title: string;
  subTitle: string;
  syncDate: string;
}

async function fetchBestKeyword(categoryId: string, sortType: string, periodType: string) {
  const params = new URLSearchParams({ ageType: "ALL", sortType, periodType });
  if (categoryId) params.set("categoryId", categoryId);
  const res = await fetch(`${SNXBEST_URL}?${params.toString()}`, {
    headers: { "User-Agent": UA, "Referer": "https://snxbest.naver.com/keyword/best" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`snxbest 응답 ${res.status}`);
  const data = (await res.json()) as SnxItem[];
  return data.map((item) => ({
    rank: item.rank,
    keyword: item.title,
    category: item.subTitle,
    status: item.status,
    delta: item.rankFluctuation ?? null,
    syncDate: item.syncDate,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const category = String(body.category || "전체");
    const tab = String(body.tab || "popular"); // popular | issue | new
    const timeUnit = String(body.timeUnit || "date"); // date | week | month

    const categoryId = category === "전체" ? "" : (CATEGORY_CID[category] || "");
    const sortType = SORT_TYPE[tab] || SORT_TYPE.popular;
    const periodType = PERIOD_TYPE[timeUnit] || PERIOD_TYPE.date;

    const keywords = await fetchBestKeyword(categoryId, sortType, periodType);
    return json({ category, tab, timeUnit, keywords });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
