const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Device = "desktop" | "mobile";
type Provider = "naver_blog_screen" | "naver_blog_api";

interface BlogRow {
  blog_id: string;
  blog_name: string;
  is_mine: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PostRow {
  blog_id: string;
  log_no: string;
  title: string;
  post_url: string;
  published_at: string | null;
  first_seen_at: string;
}

interface PostKeywordRow {
  id: number;
  blog_id: string;
  log_no: string;
  keyword: string;
  source: "manual" | "auto";
  search_volume: number | null;
  device: Device;
  max_rank: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface RankResult {
  provider: Provider;
  rank: number | null;
  page: number | null;
  found: boolean;
  checked_count: number;
  collected_at: string;
}

interface DiagnosisSnapshot {
  blog_level: number | null;
  neighbor_count: number | null;
  visitors_today: number | null;
  visitors_avg: number | null;
  visitors_total: number | null;
  category_label: string | null;
  category_rank: number | null;
  best_rank: number | null;
  valid_keyword_count: number | null;
  total_keyword_count: number | null;
}

interface TargetKeywordRow {
  id: number;
  blog_id: string;
  keyword: string;
  category: "메인" | "서브";
  device: Device;
  max_rank: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PostContentAnalysis {
  thumbnail_url: string | null;
  char_count: number | null;
  image_count: number | null;
  video_count: number | null;
  comment_count: number | null;
  quote_count: number | null;
  external_link_count: number | null;
  has_list: boolean;
  has_table: boolean;
}

interface PostContentAnalysisResult extends PostContentAnalysis {
  body_text: string;
}

interface PostAiJudgment {
  conclusion_first: boolean | null;
  structured_flow: boolean | null;
  niche_topic: boolean | null;
  ai_generated: boolean | null;
  excessive_promo: boolean | null;
  channel_consistent: boolean | null;
  reasoning: string | null;
}

/* 노출 현황 진단(블로그 전체 기준 키워드 검색)은 특정 포스팅에 미리 연결하지 않으므로
   검색해서 걸린 포스팅 정보(log_no/title/url)까지 결과에 같이 담아야 한다 — RankResult와 다른 점. */
interface ExposureResult {
  provider: Provider;
  found: boolean;
  rank: number | null;
  page: number | null;
  resultLogNo: string | null;
  resultUrl: string | null;
  checked_count: number;
  collected_at: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function env(name: string) {
  return Deno.env.get(name) || "";
}

async function db(path: string, init: RequestInit = {}) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase 서버 설정이 없습니다.");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`데이터베이스 ${response.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

/* whereispost/블로그차트 등 스크래핑 대상이 전부 한국 사이트라 "오늘"이 KST 기준인데,
   new Date().toISOString()은 UTC라서 KST 00~09시 사이(=UTC 전날 15~23시)에 수집하면
   방금 시작한 KST "오늘"의 방문자 몇 명짜리 스냅샷이 UTC 기준 "어제" 날짜로 저장돼버린다
   (예: 한국 시각 새벽에 수집하면 "오늘 방문자 1명"이 전날 값으로 잘못 찍힘).
   naver-rank/index.ts에서 이미 쓰던 KST 계산 방식을 그대로 가져와 날짜 라벨을 맞춘다. */
function kstDateString() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function stripTags(value: unknown) {
  return cleanText(value).replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&").replace(/&#39;/g, "'");
}

/* RSS 필드는 <![CDATA[...]]>로 감싸여 오는데, 이 마커 안에 실제 콘텐츠가 있어서
   stripTags()를 먼저 돌리면 "<...>" 통짜로 매칭돼 내용까지 통째로 지워진다.
   그래서 CDATA 내용만 먼저 꺼낸 뒤에 stripTags/decodeHtml을 적용해야 한다. */
function stripCdata(value: string) {
  const match = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return match ? match[1] : value;
}

function decodeHtml(value: unknown) {
  return cleanText(value)
    .replace(/\\\//g, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003A/gi, ":")
    .replace(/\\u0026/gi, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function htmlAttr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function extractThumbnailFromHtml(text: string) {
  const imageResourceTags = [...text.matchAll(/<img\b[^>]*class=["'][^"']*\bse-image-resource\b[^"']*["'][^>]*>/gi)]
    .map((match) => match[0]);
  if (imageResourceTags.length) {
    const first = imageResourceTags[0];
    const imageUrl = htmlAttr(first, "data-lazy-src") || htmlAttr(first, "src");
    if (imageUrl) return imageUrl;
  }

  const ogImageMatch = text.match(/<meta\b[^>]*(?:property|name)=["']og:image["'][^>]*>/i);
  return ogImageMatch ? htmlAttr(ogImageMatch[0], "content") || null : null;
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
}

/* 블로그 URL/ID 파싱 */
function parseBlogId(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) throw new Error("블로그 주소 또는 아이디를 입력해 주세요.");

  if (/^[A-Za-z0-9_-]+$/.test(raw) && !raw.includes(".")) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error("올바른 블로그 주소가 아닙니다.");
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("blog.naver.com")) {
    throw new Error("네이버 블로그 주소만 등록할 수 있습니다.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const blogId = parts[0] || url.searchParams.get("blogId") || url.searchParams.get("blogid") || "";
  if (!blogId) throw new Error("주소에서 블로그 아이디를 확인할 수 없습니다.");
  return blogId;
}

/* ── 블로그 RSS로 최근 포스팅 목록 자동 수집 ── */
async function fetchBlogRss(blogId: string): Promise<{ blogName: string; posts: PostRow[] }> {
  const response = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`RSS 조회 실패 (${response.status}) — 블로그 아이디를 확인해 주세요.`);

  const channelTitleMatch = text.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
  const blogName = channelTitleMatch ? stripTags(decodeHtml(stripCdata(channelTitleMatch[1]))).trim() : "";

  const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const posts: PostRow[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const link = stripCdata(cleanText(linkMatch?.[1]));
    const logNoMatch = link.match(/\/(\d+)(?:$|[?#])/);
    if (!logNoMatch) continue;

    const title = stripTags(decodeHtml(stripCdata(titleMatch?.[1] || ""))).trim();
    const pubDate = cleanText(dateMatch?.[1]);
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : null;

    posts.push({
      blog_id: blogId,
      log_no: logNoMatch[1],
      title,
      post_url: `https://blog.naver.com/${blogId}/${logNoMatch[1]}`,
      published_at: publishedAt,
      first_seen_at: now,
    });
  }

  return { blogName: blogName || blogId, posts };
}

/* ── whereispost.com에서 블로그 지수/방문자 현황 스냅샷 조회 (로그인 불필요, 서버 렌더링) ── */
function extractStat(html: string, label: string): number | null {
  const match = html.match(new RegExp(`${label}[\\s\\S]{0,200}?fw-bold[^"]*"[^>]*>\\s*([\\d,]+)\\s*<`));
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

async function fetchWhereIsPost(blogId: string): Promise<Partial<DiagnosisSnapshot>> {
  const response = await fetch("https://whereispost.com/level", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: `blogurl=${encodeURIComponent(blogId)}`,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`블로그 지수 조회 실패 (${response.status})`);

  // 실제 결과는 class="level {색상}">뿐이고, 위쪽 범례(0~10단계 설명)는 "level {색상} mt-1"이라 구분된다.
  const levelMatch = text.match(/class="level (?:gray|green|blue|purple|red)">\s*Level\s*(\d+)/i);
  return {
    blog_level: levelMatch ? Number(levelMatch[1]) : null,
    neighbor_count: extractStat(text, "이웃"),
    visitors_today: extractStat(text, "오늘 방문자"),
    visitors_avg: extractStat(text, "평균 방문자"),
    visitors_total: extractStat(text, "전체 방문자"),
  };
}

/* ── 블로그차트 로그인 세션으로 "내 블로그" 카테고리 랭킹 조회 (로그인 필요) ──
   /user/mychart는 302로 insight.blogchart.co.kr/user/blog로 넘어가는데, fetch 기본 redirect:"follow"는
   그 과정에서 수동으로 넣은 Cookie 헤더를 다음 호스트로 넘기지 못해 로그인 페이지로 튕긴다.
   그래서 리다이렉트를 따라가지 않고 최종 목적지(insight.blogchart.co.kr/user/blog)를 바로 호출한다. */
async function blogchartLogin(): Promise<string> {
  const email = env("BLOGCHART_EMAIL");
  const password = env("BLOGCHART_PASSWORD");
  if (!email || !password) throw new Error("블로그차트 계정이 설정되지 않았습니다.");

  const response = await fetch("https://www.blogchart.co.kr/user/do_login", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.blogchart.co.kr/",
    },
    body: `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}`,
  });

  let cookies = response.headers.getSetCookie?.() || [];
  if (!cookies.length) {
    cookies = [...response.headers.entries()]
      .filter(([key]) => key.toLowerCase() === "set-cookie")
      .map(([, value]) => value);
  }
  if (!cookies.length) throw new Error("블로그차트 로그인에 실패했습니다.");
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchBlogchartMyChartHtml(): Promise<string> {
  const cookie = await blogchartLogin();
  const response = await fetch("https://insight.blogchart.co.kr/user/blog", {
    headers: {
      Cookie: cookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  return response.text();
}

/* insight.blogchart.co.kr/user/blog 는 로그인한 계정 소유주(내 블로그) 1개만 보여준다 —
   blogId 파라미터로 다른 블로그를 조회하는 기능이 없어서, 이 진단은 내 블로그에만 적용된다. */
async function fetchBlogchartRank(): Promise<Partial<DiagnosisSnapshot>> {
  const html = await fetchBlogchartMyChartHtml();

  const categoryMatch = html.match(
    /kt-widget24__desc[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]{0,400}?kt-widget24__stats[^>]*>\s*([\d,]+)\s*위/,
  );
  const bestRankMatch = html.match(/최고 랭킹[\s\S]{0,200}?kt-widget4__number[^>]*>\s*([\d,]+)\s*위/);
  const validKeywordMatch = html.match(/유효키워드 수[\s\S]{0,200}?kt-widget4__number[^>]*>\s*([\d,]+)\s*개/);
  const totalKeywordMatch = html.match(/전체키워드 수[\s\S]{0,200}?kt-widget4__number[^>]*>\s*([\d,]+)\s*개/);

  return {
    category_label: categoryMatch ? categoryMatch[1].trim() : null,
    category_rank: categoryMatch ? Number(categoryMatch[2].replace(/,/g, "")) : null,
    best_rank: bestRankMatch ? Number(bestRankMatch[1].replace(/,/g, "")) : null,
    valid_keyword_count: validKeywordMatch ? Number(validKeywordMatch[1].replace(/,/g, "")) : null,
    total_keyword_count: totalKeywordMatch ? Number(totalKeywordMatch[1].replace(/,/g, "")) : null,
  };
}

/* ── 검색광고 API 서명 (HMAC-SHA256) — naver-rank 함수와 동일한 방식 ── */
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

function adNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.includes("<")) return 5;
    const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* 키워드별 월간 검색량 조회 (최대 5개씩 배치) — 실패해도 조용히 빈 맵 반환 */
async function fetchSearchVolumes(keywords: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const customerId = env("NAVER_AD_CUSTOMER_ID");
  const license = env("NAVER_AD_ACCESS_LICENSE");
  const secret = env("NAVER_AD_SECRET_KEY");
  if (!customerId || !license || !secret || !keywords.length) return map;

  const norm = (s: string) => s.replace(/\s+/g, "");
  try {
    const hint = keywords.map(norm).filter(Boolean).slice(0, 5).join(",");
    const path = "/keywordstool";
    const timestamp = String(Date.now());
    const sig = await adSignature(secret, timestamp, "GET", path);
    const response = await fetch(
      `https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`,
      {
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": license,
          "X-Customer": customerId,
          "X-Signature": sig,
        },
      },
    );
    if (!response.ok) return map;
    const data = await response.json();
    const list = (data.keywordList ?? []) as Array<Record<string, unknown>>;
    for (const item of list) {
      const kw = norm(String(item.relKeyword ?? "")).toUpperCase();
      const total = adNum(item.monthlyPcQcCnt) + adNum(item.monthlyMobileQcCnt);
      for (const original of keywords) {
        if (norm(original).toUpperCase() === kw && !map.has(original)) map.set(original, total);
      }
    }
  } catch {
    // 검색량 조회 실패 — 무시하고 null로 둔다
  }
  return map;
}

function uaFor(device: Device) {
  if (device === "mobile") {
    return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  }
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
}

async function fetchNaverText(url: string, device: Device, queryInfo = "") {
  const response = await fetch(url, {
    headers: {
      "User-Agent": uaFor(device),
      "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
      "Referer": "https://search.naver.com/",
      ...(queryInfo ? { "X-Prs-Query-Info": queryInfo } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Naver blog screen ${response.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

function isSamePost(link: string, blogId: string, logNo: string) {
  const normalized = decodeHtml(link).toLowerCase();
  return normalized.includes(`blog.naver.com/${blogId.toLowerCase()}/${logNo}`);
}

/* 노출 현황 진단용 — 특정 포스팅이 아니라 "이 블로그의 아무 포스팅이나" 걸리는지만 확인 */
function linkBelongsToBlog(link: string, blogId: string) {
  const normalized = decodeHtml(link).toLowerCase();
  return normalized.includes(`blog.naver.com/${blogId.toLowerCase()}/`);
}

function extractLogNoFromUrl(url: string) {
  const match = url.match(/blog\.naver\.com\/[^/]+\/(\d+)/i);
  return match ? match[1] : null;
}

function extractMainUrlFromCard(card: string) {
  const normalized = decodeHtml(card);
  const canonical = normalized.match(/https?:\/\/m?\.?blog\.naver\.com\/[A-Za-z0-9_.-]+\/\d+/i);
  if (canonical) return canonical[0];
  const postView = normalized.match(/https?:\/\/blog\.naver\.com\/PostView\.naver\?[^"'<>\s]+/i);
  if (postView) return postView[0];
  const hrefs = [...normalized.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => !/search\.naver\.com|ssl\.pstatic\.net|static\.naver\./i.test(url));
  return hrefs[0] || "";
}

function extractBlogCards(html: string) {
  const normalized = decodeHtml(html);
  return normalized
    .split(/data-template-id=["']ugcItem["']/i)
    .slice(1)
    .map((card) => card.slice(0, 24000));
}

function isAdCard(card: string) {
  const normalized = decodeHtml(card);
  return /ader\.naver\.com/i.test(normalized) ||
    /aria-label=["']광고["']|>\s*광고\s*</.test(normalized);
}

function extractNextRequest(html: string) {
  const normalized = decodeHtml(html);
  const request = normalized.match(/url:"(https:\/\/s\.search\.naver\.com\/p\/review\/50\/search\.naver[^"]+)"[\s\S]{0,500}?X-Prs-Query-Info":"([^"]+)"/);
  if (request) {
    return { url: decodeHtml(request[1]), queryInfo: decodeHtml(request[2]) };
  }
  const nextUrl = normalized.match(/"url"\s*:\s*"(https:\/\/s\.search\.naver\.com\/p\/review\/50\/search\.naver[^"]+)"/);
  return nextUrl ? { url: decodeHtml(nextUrl[1]), queryInfo: "" } : null;
}

/* fetchNaverBlogScreenForPost/ForKeyword가 검색결과 페이지네이션·카드추출 로직을 그대로 복붙하던 걸
   공통 코어로 뺐다 — 매칭 조건(isMatch)만 다르게 넣어주면 "특정 포스팅 찾기"/"이 블로그 아무 글이나
   찾기" 둘 다 처리된다. */
async function searchNaverBlogCards(
  keyword: string,
  device: Device,
  maxRank: number,
  isMatch: (url: string) => boolean,
): Promise<{ matchedUrl: string | null; rank: number | null; page: number | null; checked: number }> {
  const limit = Math.min(1000, Math.max(30, maxRank || 300));
  const firstUrl = new URL("https://search.naver.com/search.naver");
  firstUrl.searchParams.set("ssc", "tab.blog.all");
  firstUrl.searchParams.set("sm", "tab_jum");
  firstUrl.searchParams.set("query", keyword);

  let html = await fetchNaverText(firstUrl.toString(), device);
  let next = extractNextRequest(html);
  const seen = new Set<string>();
  let checked = 0;

  for (let pageLoop = 0; pageLoop < 40 && checked < limit; pageLoop += 1) {
    const cards = extractBlogCards(html);

    for (const card of cards) {
      if (isAdCard(card)) continue;

      const mainUrl = extractMainUrlFromCard(card);
      const key = mainUrl || `card:${simpleHash(stripTags(card).slice(0, 800))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checked += 1;

      if (mainUrl && isMatch(mainUrl)) {
        return { matchedUrl: mainUrl, rank: checked, page: Math.ceil(checked / 30), checked };
      }

      if (checked >= limit) break;
    }

    if (checked >= limit || !next?.url) break;

    const jsonText = await fetchNaverText(next.url, device, next.queryInfo);
    const data = JSON.parse(jsonText);
    html = Array.isArray(data.collection)
      ? data.collection.map((item: Record<string, unknown>) => cleanText(item.html)).join("\n")
      : "";
    next = data.url ? { url: decodeHtml(data.url), queryInfo: next.queryInfo } : null;
    if (!html) break;
  }

  return { matchedUrl: null, rank: null, page: null, checked };
}

async function fetchNaverBlogScreenForPost(
  keyword: string,
  blogId: string,
  logNo: string,
  device: Device,
  maxRank: number,
): Promise<RankResult> {
  const result = await searchNaverBlogCards(keyword, device, maxRank, (url) => isSamePost(url, blogId, logNo));
  return {
    provider: "naver_blog_screen",
    rank: result.rank,
    page: result.page,
    found: result.matchedUrl != null,
    checked_count: result.checked,
    collected_at: new Date().toISOString(),
  };
}

async function fetchNaverBlogApiForPost(
  keyword: string,
  blogId: string,
  logNo: string,
  maxRank: number,
): Promise<RankResult> {
  const clientId = env("NAVER_CLIENT_ID");
  const clientSecret = env("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("네이버 검색 API 키가 없습니다.");

  const limit = Math.min(1000, Math.max(100, maxRank || 300));
  let checked = 0;

  for (let start = 1; start <= limit; start += 100) {
    const url = new URL("https://openapi.naver.com/v1/search/blog.json");
    url.searchParams.set("query", keyword);
    url.searchParams.set("display", String(Math.min(100, limit - start + 1)));
    url.searchParams.set("start", String(start));
    url.searchParams.set("sort", "sim");

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`네이버 블로그 API ${response.status}: ${text.slice(0, 300)}`);
    }
    const data = JSON.parse(text);
    const items = Array.isArray(data.items) ? data.items : [];

    for (let index = 0; index < items.length; index += 1) {
      checked += 1;
      const link = cleanText(items[index]?.link);
      if (link && isSamePost(link, blogId, logNo)) {
        const rank = start + index;
        return {
          provider: "naver_blog_api",
          rank,
          page: Math.ceil(rank / 10),
          found: true,
          checked_count: checked,
          collected_at: new Date().toISOString(),
        };
      }
    }

    if (items.length < 100) break;
  }

  return {
    provider: "naver_blog_api",
    rank: null,
    page: null,
    found: false,
    checked_count: checked,
    collected_at: new Date().toISOString(),
  };
}

async function fetchNaverBlogScreenForKeyword(
  keyword: string,
  blogId: string,
  device: Device,
  maxRank: number,
): Promise<ExposureResult> {
  const result = await searchNaverBlogCards(keyword, device, maxRank, (url) => linkBelongsToBlog(url, blogId));
  return {
    provider: "naver_blog_screen",
    found: result.matchedUrl != null,
    rank: result.rank,
    page: result.page,
    resultLogNo: result.matchedUrl ? extractLogNoFromUrl(result.matchedUrl) : null,
    resultUrl: result.matchedUrl,
    checked_count: result.checked,
    collected_at: new Date().toISOString(),
  };
}

async function saveHistory(blogId: string, logNo: string, keyword: string, device: Device, result: RankResult) {
  const collectedDate = kstDateString();
  await db("blog_rank_history?on_conflict=blog_id,log_no,keyword,provider,device,collected_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      log_no: logNo,
      keyword,
      provider: result.provider,
      device,
      rank: result.rank,
      page: result.page,
      found: result.found,
      checked_count: result.checked_count,
      collected_date: collectedDate,
      collected_at: result.collected_at,
    }]),
  });
}

/* RSS는 최신 50개까지만 주기 때문에 그보다 오래된 포스팅이 검색에 걸리면 blog_rank_posts에 없어서
   제목을 못 찾는다. 그럴 땐 모바일 블로그 페이지(m.blog.naver.com)를 직접 열어 제목을 가져온다 —
   데스크톱 페이지(blog.naver.com)는 iframe 래퍼라 <title>이 블로그 이름만 나오고 실제 글 제목은 안 나온다.
   같은 페이지 안에 baParams.postWriteDate(= addDate, 에포크 ms)로 실제 발행일도 들어있어서 같이 뽑는다 —
   전에는 이 값을 안 읽어서 스텁으로 채운 포스팅은 발행일이 영원히 비어 있었다(전체 포스팅 목록에서
   "-"로 표시되던 문제). */
async function fetchPostMetaFallback(blogId: string, logNo: string): Promise<{ title: string | null; publishedAt: string | null }> {
  try {
    const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    });
    const text = await response.text();
    const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? stripTags(decodeHtml(titleMatch[1])).replace(/\s*:\s*네이버 블로그\s*$/, "").trim() || null
      : null;

    const dateMatch = text.match(/addDate="(\d+)"/);
    const publishedAtMs = dateMatch ? Number(dateMatch[1]) : NaN;
    const publishedAt = Number.isFinite(publishedAtMs) ? new Date(publishedAtMs).toISOString() : null;

    return { title, publishedAt };
  } catch {
    return { title: null, publishedAt: null };
  }
}

/* 사진 캡션(se-caption)과 인용구 출처(se-cite)도 본문과 똑같은 <p class="se-text-paragraph">를
   재사용해서, 이 두 래퍼를 먼저 통째로 잘라내지 않으면 본문이 아닌 텍스트까지 섞여 들어간다.
   char_count 집계와 AI 판정용 본문 텍스트 추출이 이 로직을 그대로 공유한다. */
function extractBodyParagraphs(rawHtml: string): string[] {
  const bodyOnlyHtml = rawHtml
    .replace(/<div class="se-module se-module-text se-caption">[\s\S]*?<\/div>/g, "")
    .replace(/<div class="se-module se-module-text se-cite">[\s\S]*?<\/div>/g, "");
  const zeroWidthSpace = String.fromCharCode(0x200b);
  return [...bodyOnlyHtml.matchAll(/<p class="se-text-paragraph[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(decodeHtml(m[1])).split(zeroWidthSpace).join("").trim())
    .filter(Boolean);
}

const COMPETITOR_KEYWORD_RULES: Array<{ label: string; aliases: string[] }> = [
  { label: "PF보드", aliases: ["pf보드", "피에프보드", "페놀폼보드"] },
  { label: "PF보드단열재", aliases: ["pf보드단열재", "pf 보드 단열재"] },
  { label: "심재준불연", aliases: ["심재준불연", "심재 준불연"] },
  { label: "심재준불연단열재", aliases: ["심재준불연단열재", "심재 준불연 단열재"] },
  { label: "준불연단열재", aliases: ["준불연단열재", "준불연 단열재"] },
  { label: "준불연비드법", aliases: ["준불연비드법", "준불연 비드법"] },
  { label: "불연단열재", aliases: ["불연단열재", "불연 단열재"] },
  { label: "열반사단열재", aliases: ["열반사단열재", "열반사 단열재", "열반사"] },
  { label: "저방사단열재", aliases: ["저방사단열재", "저방사 단열재"] },
  { label: "은박시트", aliases: ["은박시트", "은박 시트", "은박시트지"] },
  { label: "비드법단열재", aliases: ["비드법단열재", "비드법 단열재"] },
  { label: "비드법보온판", aliases: ["비드법보온판", "비드법 보온판"] },
  { label: "비드법1종", aliases: ["비드법1종", "비드법 1종"] },
  { label: "비드법2종", aliases: ["비드법2종", "비드법 2종"] },
  { label: "스티로폼단열재", aliases: ["스티로폼단열재", "스티로폼 단열재"] },
  { label: "스티로폼", aliases: ["스티로폼"] },
  { label: "압출법단열재", aliases: ["압출법단열재", "압출법 단열재"] },
  { label: "압출법보온판", aliases: ["압출법보온판", "압출법 보온판"] },
  { label: "아이소핑크단열재", aliases: ["아이소핑크단열재", "아이소핑크 단열재"] },
  { label: "아이소핑크", aliases: ["아이소핑크"] },
  { label: "아이소핑크가격", aliases: ["아이소핑크가격", "아이소핑크 가격", "아이소핑크단가", "아이소핑크 단가"] },
  { label: "경질우레탄보드", aliases: ["경질우레탄보드", "경질 우레탄 보드"] },
  { label: "경질우레탄단열재", aliases: ["경질우레탄단열재", "경질 우레탄 단열재"] },
  { label: "페놀폼단열재", aliases: ["페놀폼단열재", "페놀폼 단열재"] },
  { label: "페놀폼", aliases: ["페놀폼"] },
  { label: "글라스울단열재", aliases: ["글라스울단열재", "글라스울 단열재", "그라스울단열재", "그라스울 단열재"] },
  { label: "글라스울", aliases: ["글라스울", "그라스울"] },
  { label: "미네랄울", aliases: ["미네랄울", "미네랄 울"] },
  { label: "복합단열재", aliases: ["복합단열재", "복합 단열재"] },
  { label: "단열벽지", aliases: ["단열벽지", "단열 벽지"] },
  { label: "이보드", aliases: ["이보드"] },
  { label: "로이보드", aliases: ["로이보드"] },
  { label: "골드폭스보드", aliases: ["골드폭스보드", "골드 폭스 보드"] },
  { label: "뉴골드폭스보드", aliases: ["뉴골드폭스보드", "뉴 골드 폭스 보드"] },
  { label: "석고보드", aliases: ["석고보드", "석고 보드"] },
  { label: "건축외장재", aliases: ["건축외장재", "건축 외장재"] },
  { label: "외장재", aliases: ["외장재"] },
  { label: "알루미늄스펜드럴", aliases: ["알루미늄스펜드럴", "알루미늄 스펜드럴", "알루미늄스팬드럴", "알루미늄 스팬드럴"] },
  { label: "스펜드럴", aliases: ["스펜드럴", "스팬드럴"] },
  { label: "리빙보드", aliases: ["리빙보드", "리빙 보드"] },
  { label: "PVC천장", aliases: ["pvc천장", "pvc 천장", "pvc천장재", "pvc 천장재"] },
  { label: "욕실마감재", aliases: ["욕실마감재", "욕실 마감재", "욕실천장마감재", "욕실 천장 마감재"] },
  { label: "천장마감재", aliases: ["천장마감재", "천장 마감재", "천장재", "천장 마감"] },
  { label: "MLH합판", aliases: ["mlh합판", "mlh 합판", "hlh합판", "hlh 합판"] },
  { label: "콤비합판", aliases: ["콤비합판", "콤비 합판"] },
  { label: "합판", aliases: ["합판"] },
  { label: "층간차음재", aliases: ["층간차음재", "층간 차음재"] },
  { label: "보드매트", aliases: ["보드매트", "보드 매트"] },
  { label: "방수석고보드", aliases: ["방수석고보드", "방수 석고보드"] },
  { label: "천장텍스", aliases: ["천장텍스", "천장 텍스"] },
  { label: "합성데크", aliases: ["합성데크", "합성 데크"] },
  { label: "조립식판넬", aliases: ["조립식판넬", "조립식 판넬", "조립식패널"] },
  { label: "화스너", aliases: ["화스너", "파스너"] },
  { label: "폼본드", aliases: ["폼본드", "폼 본드"] },
  { label: "몰탈", aliases: ["몰탈", "모르타르"] },
  { label: "단열재시공", aliases: ["단열재시공", "단열재 시공", "단열공사", "단열 공사"] },
  { label: "단열재업체", aliases: ["단열재업체", "단열재 업체", "단열공사업체"] },
  { label: "단열재종류", aliases: ["단열재종류", "단열재 종류"] },
  { label: "단열효과", aliases: ["단열효과", "단열 효과"] },
  { label: "결로방지", aliases: ["결로방지", "결로 방지"] },
  { label: "천장단열", aliases: ["천장단열", "천장 단열"] },
  { label: "EPS", aliases: ["eps", "eps단열재", "eps 단열재"] },
  { label: "XPS", aliases: ["xps", "xps단열재", "xps 단열재"] },
  { label: "PUR", aliases: ["pur"] },
  { label: "LXPF보드", aliases: ["lxpf보드", "lx pf보드", "lx하우시스 pf보드"] },
  { label: "KCC", aliases: ["kcc"] },
];

const COMPETITOR_KEYWORD_NOISE = [
  "블루인슈텍", "태화단열", "하이홈테크", "바로상사", "가인산업", "한국산업단열",
  "알려드립니다", "알려드리겠습니다", "전문업체가", "전문업체", "구매하는법",
  "쉽게", "좋은부분", "확인해야", "가능합니다", "좋은가요", "있나요", "하나요",
];

function compactKeywordText(value: string) {
  return value.toLowerCase().replace(/[\s\-_/·.,()[\]{}'"“”‘’!?…:|]/g, "");
}

function keywordHitCount(compactText: string, alias: string) {
  const compactAlias = compactKeywordText(alias);
  if (!compactAlias) return 0;
  let count = 0;
  let index = compactText.indexOf(compactAlias);
  while (index !== -1) {
    count += 1;
    index = compactText.indexOf(compactAlias, index + compactAlias.length);
  }
  return count;
}

function addKeywordScore(scores: Map<string, number>, label: string, score: number) {
  const compact = compactKeywordText(label);
  if (!compact || COMPETITOR_KEYWORD_NOISE.some((noise) => compact.includes(compactKeywordText(noise)))) return;
  scores.set(label, Math.max(scores.get(label) || 0, score));
}

function extractCompetitorKeywords(title: string, bodyText: string) {
  const titleCompact = compactKeywordText(title);
  const bodyCompact = compactKeywordText(bodyText.slice(0, 6000));
  const scores = new Map<string, number>();
  const titleMatched = new Set<string>();

  for (const rule of COMPETITOR_KEYWORD_RULES) {
    let score = 0;
    let hasTitleHit = false;
    for (const alias of rule.aliases) {
      const titleHits = keywordHitCount(titleCompact, alias);
      const bodyHits = keywordHitCount(bodyCompact, alias);
      if (titleHits) {
        score += titleHits * 100;
        hasTitleHit = true;
      }
      if (bodyHits) score += Math.min(bodyHits, 3) * 2;
    }
    if (hasTitleHit) titleMatched.add(rule.label);
    if (score > 0) addKeywordScore(scores, rule.label, score);
  }

  const titleNoSpace = compactKeywordText(title);
  const regionMatch = title.match(/(서울|인천|용인|수원|경기|김포|부산|대구|대전|광주|천안|평택|화성|남양주)/);
  if (regionMatch && /(단열재|단열공사|단열업체|보온재)/.test(title)) {
    addKeywordScore(scores, `${regionMatch[1]}단열재업체`, 10);
  }
  if (/(가격|단가|저렴|싸게|구매|판매)/.test(title) && titleNoSpace.includes("단열재")) {
    addKeywordScore(scores, "단열재구매", 8);
  }

  let ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], "ko"));
  if (titleMatched.size >= 2) {
    const titleRows = ranked.filter(([keyword]) => titleMatched.has(keyword));
    ranked = titleRows;
  }

  const selected: string[] = [];
  for (const [keyword] of ranked) {
    const compact = compactKeywordText(keyword);
    if (selected.some((existing) => {
      const exist = compactKeywordText(existing);
      return exist.includes(compact) || compact.includes(exist);
    })) continue;
    selected.push(keyword);
    if (selected.length >= 5) break;
  }
  return selected;
}

/* 게시글 진단 모달용 — 모바일 페이지(m.blog.naver.com)를 열어 본문 분석 지표를 뽑는다.
   공감(좋아요) 수는 이 정적 페이지 안에 없어서(별도 API로 로드되는 것으로 보임) 제외했다. */
async function fetchPostContentAnalysis(blogId: string, logNo: string): Promise<PostContentAnalysisResult> {
  const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`포스팅 페이지 조회 실패 (${response.status})`);

  const commentMatch = text.match(/commentCount="(\d+)"/);

  // attachImagePathAndIdInfo는 실제로 삽입된 사진 중 일부만 담는다 — 2장 이상을 붙인
  // "이미지 스트립"(콜라주) 사진은 통째로 빠지고, 단일 사진도 위치에 따라 누락되는 경우가 있다.
  // path에 CDN 호스트가 없어 blogfiles.pstatic.net으로 고정 조립하면 실제 호스트(사진마다
  // mblogthumb-phinf/postfiles/blogfiles로 제각각)와 어긋나 썸네일이 깨지기도 한다.
  // 본문에 실제로 박힌 <img class="se-image-resource">를 직접 세는 게 더 정확하다 — data-lazy-src가
  // 있으면 그게 실제 로드되는 원본(예: w800)이고, 없으면 src를 그대로 쓴다.
  let imageCount: number | null = null;
  let thumbnailUrl: string | null = null;
  const imageResourceTags = [...text.matchAll(/<img\b[^>]*class=["'][^"']*\bse-image-resource\b[^"']*["'][^>]*>/gi)]
    .map((match) => match[0]);
  if (imageResourceTags.length) {
    imageCount = imageResourceTags.length;
    thumbnailUrl = extractThumbnailFromHtml(text);
  }

  if (!thumbnailUrl) {
    thumbnailUrl = extractThumbnailFromHtml(text);
  }

  // attachImagePathAndIdInfo와 같은 패턴의 메타 변수 — 동영상 개수를 그대로 담고 있다.
  let videoCount: number | null = null;
  const videoInfoMatch = text.match(/attachVideoInfo\s*=\s*'([^']*)'/);
  if (videoInfoMatch) {
    try {
      const decoded = videoInfoMatch[1].replace(/&#034;/g, "\"").replace(/&#039;/g, "'").replace(/&amp;/g, "&");
      videoCount = (JSON.parse(decoded) as unknown[]).length;
    } catch {
      // 동영상 정보 파싱 실패 시 무시하고 null로 둔다
    }
  }

  const bodyParagraphs = extractBodyParagraphs(text);
  const bodyText = bodyParagraphs.join("\n");
  const charCount = bodyParagraphs.length ? bodyParagraphs.join("").length : null;

  // 실제 마크업은 class="se-component se-quotation se-l-..."라 class="se-quotation"(값이 그것만
  // 있어야 매칭)은 절대 안 걸린다 — 컴포넌트 래퍼 자체를 세도록 좁힌다.
  const quoteCount = (text.match(/class="se-component se-quotation/g) || []).length;

  // 링크 미리보기(se-oglink)는 naver.com 도메인(스마트스토어 등)으로 거는 경우가 많아 "외부링크"로
  // 볼 수 없다 — 각 oglink 블록의 실제 href를 뽑아 naver.com이 아닌 것만 센다.
  const externalLinkCount = [...text.matchAll(/<a href="([^"]+)" class="se-oglink-thumbnail/g)]
    .filter((m) => !/^https?:\/\/([a-z0-9-]+\.)*naver\.com(\/|$|\?)/i.test(decodeHtml(m[1])))
    .length;

  // AI 인용 최적화 점수의 "목록화"/"비교표 배치" 판정용 — 다른 컴포넌트와 같은
  // class="se-component se-{type}" 명명 규칙을 따른다.
  const hasList = /<ul class="se-text-list|<ol class="se-text-list/.test(text);
  const hasTable = /class="se-component se-table/.test(text);

  return {
    thumbnail_url: thumbnailUrl,
    char_count: charCount,
    image_count: imageCount,
    video_count: videoCount,
    comment_count: commentMatch ? Number(commentMatch[1]) : null,
    quote_count: quoteCount,
    external_link_count: externalLinkCount,
    has_list: hasList,
    has_table: hasTable,
    body_text: bodyText,
  };
}

/* AI 인용 최적화 점수 중 스크래핑으로는 절대 판정 불가능한 항목(결론 우선 배치/본문 구조화/
   니치 소재/AI 기계생성 여부/과도한 홍보문구/채널 주제 일관성)을 LLM에게 맡긴다.
   item-draft-openai 함수와 같은 OPENAI_API_KEY Secret을 그대로 재사용한다 — 비용이 드는
   호출이라 자동 새로고침에는 절대 얹지 않고, 프론트의 수동 버튼에서만 호출된다. */
async function fetchPostAiJudgment(title: string, bodyText: string, siblingTitles: string[]): Promise<PostAiJudgment> {
  const apiKey = env("OPENAI_API_KEY");
  const model = env("OPENAI_MODEL") || "gpt-4o-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY Supabase Secret이 필요합니다.");

  const prompt = `다음은 네이버 블로그 포스팅이다. 생성형 AI 답변엔진(챗GPT/네이버 큐 등)이 이 글을 인용할 가능성을 판정하는 6가지 항목에 대해 각각 true/false로 답하라.

[제목]
${title}

[같은 블로그의 다른 포스팅 제목들 — 주제 일관성 판단용]
${siblingTitles.length ? siblingTitles.map((t) => `- ${t}`).join("\n") : "(없음)"}

[본문 일부]
${bodyText.slice(0, 6000)}

판정 항목:
1. conclusion_first: 서론 없이 글 초반에 핵심 결론/답을 바로 제시하는가
2. structured_flow: 결론 → 표/근거 → 목록 정리 → 상황별 가이드 순서로 구조화되어 있는가
3. niche_topic: 흔한 일반론이 아니라 경쟁 콘텐츠가 적을 법한 실무형·구체적 질문을 다루는가
4. ai_generated: 편집 없이 그대로 발행한 AI 기계생성 글처럼 보이는가(반복적 구조, 상투적 문구, 개인 경험·구체 수치 부재)
5. excessive_promo: 홍보·판매 문구가 1줄을 넘게 과도한가
6. channel_consistent: 이 글이 다른 포스팅들과 같은 전문 주제로 일관된 채널의 글로 보이는가

반드시 아래 JSON 형식으로만 답하라:
{"conclusion_first": boolean, "structured_flow": boolean, "niche_topic": boolean, "ai_generated": boolean, "excessive_promo": boolean, "channel_consistent": boolean, "reasoning": "6항목 판정 근거를 한국어 한두 문장으로 요약"}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "너는 블로그 글이 생성형 AI 답변엔진에 인용되기 좋은 형태인지 냉정하게 판정하는 콘텐츠 심사자다. 반드시 유효한 JSON만 반환한다.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  } catch {
    throw new Error("OpenAI 응답을 해석하지 못했습니다.");
  }

  const toBool = (v: unknown): boolean | null => typeof v === "boolean" ? v : null;
  return {
    conclusion_first: toBool(parsed.conclusion_first),
    structured_flow: toBool(parsed.structured_flow),
    niche_topic: toBool(parsed.niche_topic),
    ai_generated: toBool(parsed.ai_generated),
    excessive_promo: toBool(parsed.excessive_promo),
    channel_consistent: toBool(parsed.channel_consistent),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 2000) : null,
  };
}

async function savePostAiCheck(blogId: string, logNo: string) {
  const postRows = await db(
    `blog_rank_posts?select=title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}`,
  ) as Array<{ title: string }>;
  const title = postRows?.[0]?.title || logNo;

  const siblingRows = await db(
    `blog_rank_posts?select=title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=neq.${encodeURIComponent(logNo)}&order=published_at.desc.nullslast&limit=15`,
  ) as Array<{ title: string }>;
  const siblingTitles = (siblingRows || []).map((r) => r.title).filter(Boolean);

  const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`포스팅 페이지 조회 실패 (${response.status})`);
  const bodyText = extractBodyParagraphs(html).join("\n");

  const judgment = await fetchPostAiJudgment(title, bodyText, siblingTitles);

  await db("blog_rank_post_ai_check?on_conflict=blog_id,log_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      log_no: logNo,
      ...judgment,
      checked_at: new Date().toISOString(),
    }]),
  });
}

async function saveExposureHistory(blogId: string, keyword: string, device: Device, result: ExposureResult) {
  const collectedDate = kstDateString();
  let resultTitle: string | null = null;
  if (result.resultLogNo) {
    // 노출 진단이 찾아낸 포스팅이 RSS 최근 50개 밖의 오래된 글이면 blog_rank_posts에 행 자체가
    // 없어서 "키워드별 결과" 화면에서 발행일을 조회할 대상이 없었다 — 제목만 fallback으로 구해서
    // exposure_history에 채워 넣을 뿐 blog_rank_posts는 그대로 비어 있었다. ensurePostRowsExist로
    // 발행일까지 포함한 스텁 행을 먼저 채운다(이미 있으면 건드리지 않음).
    await ensurePostRowsExist(blogId, [result.resultLogNo]);
    const rows = await db(
      `blog_rank_posts?select=title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(result.resultLogNo)}`,
    ) as Array<{ title: string }>;
    resultTitle = rows?.[0]?.title || null;
  }
  await db("blog_rank_exposure_history?on_conflict=blog_id,keyword,provider,device,checked_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      keyword,
      provider: result.provider,
      device,
      found: result.found,
      rank: result.rank,
      page: result.page,
      result_log_no: result.resultLogNo,
      result_title: resultTitle,
      result_url: result.resultUrl,
      checked_count: result.checked_count,
      checked_date: collectedDate,
      collected_at: result.collected_at,
    }]),
  });
}

async function addTargetKeywords(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  if (!blogId) throw new Error("블로그를 확인할 수 없습니다.");
  const items = Array.isArray(body.keywords) ? body.keywords : [];
  const rows = items
    .map((item) => {
      const rec = item as Record<string, unknown>;
      const keyword = cleanText(typeof rec === "object" && rec !== null ? rec.keyword : item);
      const category = (typeof rec === "object" && rec !== null && rec.category === "메인") ? "메인" : "서브";
      return { blog_id: blogId, keyword, category, updated_at: new Date().toISOString() };
    })
    .filter((row) => row.keyword);
  if (!rows.length) throw new Error("추가할 키워드가 없습니다.");

  await db("blog_rank_target_keywords?on_conflict=blog_id,keyword", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  return listData();
}

async function removeTargetKeyword(id: number) {
  if (!id) throw new Error("삭제할 키워드가 없습니다.");
  await db(`blog_rank_target_keywords?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return listData();
}

async function collectExposure(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  if (!blogId) throw new Error("블로그를 확인할 수 없습니다.");
  const keyword = cleanText(body.keyword);
  const path = keyword
    ? `blog_rank_target_keywords?select=*&blog_id=eq.${encodeURIComponent(blogId)}&keyword=eq.${encodeURIComponent(keyword)}`
    : `blog_rank_target_keywords?select=*&blog_id=eq.${encodeURIComponent(blogId)}&active=eq.true`;
  const rows = await db(path) as TargetKeywordRow[];
  if (!rows?.length) throw new Error("등록된 진단 키워드가 없습니다.");

  const errors: Array<{ keyword: string; provider: string; message: string }> = [];
  let collected = 0;

  // naver_blog_api provider는 노출 진단 화면 어디서도 읽지 않는다(전부 naver_blog_screen만 조회) —
  // 예전엔 여기서도 둘 다 수집해서 매 키워드마다 요청이 2배였다. 화면 스크래핑 하나만 돈다.
  for (const row of (keyword ? rows : rows.slice(0, 60))) {
    try {
      const screen = await fetchNaverBlogScreenForKeyword(row.keyword, blogId, row.device, row.max_rank);
      await saveExposureHistory(blogId, row.keyword, row.device, screen);
      collected += 1;
    } catch (error) {
      errors.push({ keyword: row.keyword, provider: "naver_blog_screen", message: error instanceof Error ? error.message : String(error) });
    }
    await db(`blog_rank_target_keywords?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
  }

  return { ...(await listData()), collected, errors };
}

async function collectPostTitleCheck(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  if (!blogId) throw new Error("블로그를 확인할 수 없습니다.");
  const logNo = cleanText(body.logNo);
  const path = logNo
    ? `blog_rank_posts?select=log_no,title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}`
    : `blog_rank_posts?select=log_no,title&blog_id=eq.${encodeURIComponent(blogId)}&order=published_at.desc.nullslast&limit=50`;
  const posts = await db(path) as Array<{ log_no: string; title: string }>;
  if (!posts?.length) throw new Error("확인할 포스팅이 없습니다.");

  const errors: Array<{ logNo: string; message: string }> = [];
  let collected = 0;

  for (const post of posts) {
    try {
      const result = await fetchNaverBlogScreenForPost(post.title, blogId, post.log_no, "desktop", 100);
      await db("blog_rank_post_title_check?on_conflict=blog_id,log_no", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          blog_id: blogId,
          log_no: post.log_no,
          found: result.found,
          checked_at: new Date().toISOString(),
        }]),
      });
      collected += 1;
    } catch (error) {
      errors.push({ logNo: post.log_no, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { ...(await listData()), collected, errors };
}

async function savePostContentAnalysis(blogId: string, logNo: string) {
  const analysis = await fetchPostContentAnalysis(blogId, logNo);
  const { body_text: bodyText, ...contentAnalysis } = analysis;
  await db("blog_rank_post_content_check?on_conflict=blog_id,log_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      log_no: logNo,
      ...contentAnalysis,
      checked_at: new Date().toISOString(),
    }]),
  });

  const [blog] = await db(`blog_rank_blogs?select=is_mine&blog_id=eq.${encodeURIComponent(blogId)}&limit=1`) as Array<{ is_mine: boolean }>;
  if (blog && !blog.is_mine) {
    const [post] = await db(`blog_rank_posts?select=title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}&limit=1`) as Array<{ title: string | null }>;
    const keywords = extractCompetitorKeywords(post?.title || "", bodyText);
    await db(`blog_rank_post_keywords?blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}&source=eq.auto`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    await saveKeywordsForPost(blogId, logNo, keywords, "auto", "desktop", 300);
  }
}

async function fetchPostThumbnail(blogId: string, logNo: string): Promise<string | null> {
  const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`포스팅 페이지 조회 실패 (${response.status})`);
  return extractThumbnailFromHtml(text);
}

async function savePostThumbnail(blogId: string, logNo: string) {
  const thumbnailUrl = await fetchPostThumbnail(blogId, logNo);
  if (!thumbnailUrl) return;
  await db("blog_rank_post_content_check?on_conflict=blog_id,log_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      log_no: logNo,
      thumbnail_url: thumbnailUrl,
      checked_at: new Date().toISOString(),
    }]),
  });
}

async function collectPostContentCheck(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  if (!blogId) throw new Error("블로그를 확인할 수 없습니다.");
  const logNo = cleanText(body.logNo);
  const path = logNo
    ? `blog_rank_posts?select=log_no&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}`
    : `blog_rank_posts?select=log_no&blog_id=eq.${encodeURIComponent(blogId)}&order=published_at.desc.nullslast&limit=10`;
  const posts = await db(path) as Array<{ log_no: string }>;
  if (!posts?.length) throw new Error("확인할 포스팅이 없습니다.");

  const errors: Array<{ logNo: string; message: string }> = [];
  let collected = 0;

  for (const post of posts) {
    try {
      await savePostContentAnalysis(blogId, post.log_no);
      collected += 1;
    } catch (error) {
      errors.push({ logNo: post.log_no, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { ...(await listData()), collected, errors };
}

/* AI 인용 진단 — OpenAI 호출 비용이 들어서 collectPostContentCheck와 달리 "최근 10개 일괄"을
   기본으로 두지 않는다. logNo 없이 부르면 에러를 내서, 프론트가 항상 포스팅 하나를 골라 보내게 한다. */
async function collectPostAiCheck(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const logNo = cleanText(body.logNo);
  if (!blogId || !logNo) throw new Error("진단할 포스팅을 확인할 수 없습니다.");

  await savePostContentAnalysis(blogId, logNo);
  await savePostAiCheck(blogId, logNo);
  return listData();
}

async function listData() {
  const [blogs, posts, postKeywords, history, diagnosis, targetKeywords, exposureHistory, postTitleChecks, postContentChecks, postAiChecks] = await Promise.all([
    db("blog_rank_blogs?select=*&order=created_at.desc") as Promise<BlogRow[]>,
    db("blog_rank_posts?select=*&order=published_at.desc.nullslast&limit=500") as Promise<PostRow[]>,
    db("blog_rank_post_keywords?select=*&order=created_at.asc") as Promise<PostKeywordRow[]>,
    db("blog_rank_history?select=*&order=collected_at.desc&limit=3000") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_diagnosis?select=*&order=snapshot_date.desc&limit=400") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_target_keywords?select=*&order=created_at.asc") as Promise<TargetKeywordRow[]>,
    db("blog_rank_exposure_history?select=*&order=collected_at.desc&limit=2000") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_post_title_check?select=*") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_post_content_check?select=*") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_post_ai_check?select=*") as Promise<Array<Record<string, unknown>>>,
  ]);

  return {
    blogs: blogs || [],
    posts: posts || [],
    postKeywords: postKeywords || [],
    history: history || [],
    diagnosis: diagnosis || [],
    targetKeywords: targetKeywords || [],
    exposureHistory: exposureHistory || [],
    postTitleChecks: postTitleChecks || [],
    postContentChecks: postContentChecks || [],
    postAiChecks: postAiChecks || [],
    capabilities: {
      naverBlogScreen: true,
      naverBlogApi: !!env("NAVER_CLIENT_ID") && !!env("NAVER_CLIENT_SECRET"),
      searchVolume: !!env("NAVER_AD_CUSTOMER_ID") && !!env("NAVER_AD_ACCESS_LICENSE") && !!env("NAVER_AD_SECRET_KEY"),
      postAiCheck: !!env("OPENAI_API_KEY"),
    },
  };
}

async function addBlog(body: Record<string, unknown>) {
  const blogId = parseBlogId(body.blogUrl);
  const isMine = !!body.isMine;
  const now = new Date().toISOString();

  const { blogName, posts } = await fetchBlogRss(blogId);

  await db("blog_rank_blogs?on_conflict=blog_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      blog_name: blogName,
      is_mine: isMine,
      active: true,
      updated_at: now,
    }]),
  });

  if (posts.length) {
    await db("blog_rank_posts?on_conflict=blog_id,log_no", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(posts),
    });
  }

  return listData();
}

async function removeBlog(blogId: string) {
  if (!blogId) throw new Error("삭제할 블로그가 없습니다.");
  await db(`blog_rank_blogs?blog_id=eq.${encodeURIComponent(blogId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return listData();
}

async function refreshPosts(blogId: string) {
  if (!blogId) throw new Error("블로그가 없습니다.");
  // blog_name은 addBlog(최초 등록) 때만 RSS 채널 제목으로 채운다 — 새로고침마다 다시 덮어쓰면
  // 사용자가 보기 좋게 손봐둔 이름이 다음 새로고침에서 원래 RSS 제목(홍보문구 섞인 긴 이름)으로
  // 되돌아가 버린다.
  const { posts } = await fetchBlogRss(blogId);
  await db(`blog_rank_blogs?blog_id=eq.${encodeURIComponent(blogId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
  if (posts.length) {
    await db("blog_rank_posts?on_conflict=blog_id,log_no", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(posts),
    });
    await backfillThumbnailsForLogNos(blogId, posts.slice(0, 50).map((post) => post.log_no), Date.now() + 90_000);
  }
  return listData();
}

async function saveKeywordsForPost(
  blogId: string,
  logNo: string,
  keywords: string[],
  source: "manual" | "auto",
  device: Device,
  maxRank: number,
) {
  if (!keywords.length) return;
  const volumes = await fetchSearchVolumes(keywords);
  const now = new Date().toISOString();
  const rows = keywords.map((keyword) => ({
    blog_id: blogId,
    log_no: logNo,
    keyword,
    source,
    search_volume: volumes.has(keyword) ? volumes.get(keyword) : null,
    device,
    max_rank: maxRank,
    active: true,
    updated_at: now,
  }));
  await db("blog_rank_post_keywords?on_conflict=blog_id,log_no,keyword,device", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function addPostKeyword(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const logNo = cleanText(body.logNo);
  const keywords = Array.from(new Set(
    (Array.isArray(body.keywords) ? body.keywords : cleanText(body.keyword).split(","))
      .map(cleanText)
      .filter(Boolean),
  ));
  if (!blogId || !logNo) throw new Error("포스팅을 확인할 수 없습니다.");
  if (!keywords.length) throw new Error("추적할 키워드를 입력해 주세요.");

  const device: Device = body.device === "mobile" ? "mobile" : "desktop";
  const maxRank = [100, 300, 500, 1000].includes(Number(body.maxRank)) ? Number(body.maxRank) : 300;

  await saveKeywordsForPost(blogId, logNo, keywords, "manual", device, maxRank);
  return listData();
}

async function removePostKeyword(id: number) {
  if (!id) throw new Error("삭제할 키워드가 없습니다.");
  await db(`blog_rank_post_keywords?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return listData();
}

async function replacePostKeywords(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const logNo = cleanText(body.logNo);
  const keywords = Array.from(new Set(
    (Array.isArray(body.keywords) ? body.keywords : cleanText(body.keyword).split(","))
      .map(cleanText)
      .filter(Boolean),
  ));
  if (!blogId || !logNo) throw new Error("포스팅을 확인할 수 없습니다.");

  await db(`blog_rank_post_keywords?blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (keywords.length) {
    const device: Device = body.device === "mobile" ? "mobile" : "desktop";
    const maxRank = [100, 300, 500, 1000].includes(Number(body.maxRank)) ? Number(body.maxRank) : 300;
    await saveKeywordsForPost(blogId, logNo, keywords, "manual", device, maxRank);
  }
  return listData();
}

type RefreshError = { blogId: string; logNo: string; keyword: string; provider: string; message: string };

/* RSS 새로고침 — 네이버 "검색"이 아니라 블로그 자체 RSS 피드를 직접 열어보는 가벼운 요청이라
   collect()의 무거운 키워드 순위 루프와 분리해서 페이지 진입 시마다 자동으로 돌려도 부담이 없다. */
async function refreshRssForBlogs(targets: string[], deadline: number): Promise<RefreshError[]> {
  const errors: RefreshError[] = [];
  for (const target of targets) {
    if (Date.now() > deadline) break;
    try {
      // blog_name은 addBlog 때만 채운다 — 이유는 refreshPosts 쪽 주석 참고.
      const { posts } = await fetchBlogRss(target);
      await db(`blog_rank_blogs?blog_id=eq.${encodeURIComponent(target)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      if (posts.length) {
        await db("blog_rank_posts?on_conflict=blog_id,log_no", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(posts),
        });
      }
    } catch (error) {
      errors.push({ blogId: target, logNo: "-", keyword: "-", provider: "rss", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return errors;
}

/* blog_rank_post_content_check은 blog_rank_posts에 대한 외래키가 걸려 있는데, RSS는 최신 50개
   글만 주기 때문에 노출 결과가 가리키는 오래된 글은 blog_rank_posts에 행 자체가 없어 FK 위반(409)으로
   저장이 통째로 실패한다 — fetchPostMetaFallback(제목+발행일)으로 스텁 행을 먼저 채워서 이 실패를
   없앤다. saveExposureHistory도 노출 진단이 찾아낸 오래된 글의 발행일을 보여주려고 이걸 재사용한다. */
async function ensurePostRowsExist(blogId: string, logNos: string[]): Promise<void> {
  if (!logNos.length) return;
  const existing = await db(
    `blog_rank_posts?select=log_no&blog_id=eq.${encodeURIComponent(blogId)}&log_no=in.(${logNos.map(encodeURIComponent).join(",")})`,
  ) as Array<{ log_no: string }>;
  const existingSet = new Set((existing || []).map((r) => r.log_no));
  const missing = logNos.filter((logNo) => !existingSet.has(logNo));
  if (!missing.length) return;

  const now = new Date().toISOString();
  const rows: PostRow[] = [];
  for (const logNo of missing) {
    const meta = await fetchPostMetaFallback(blogId, logNo);
    rows.push({
      blog_id: blogId,
      log_no: logNo,
      title: meta.title || logNo,
      post_url: `https://blog.naver.com/${blogId}/${logNo}`,
      published_at: meta.publishedAt,
      first_seen_at: now,
    });
  }
  await db("blog_rank_posts?on_conflict=blog_id,log_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

/* 최근 포스팅 콘텐츠 분석(썸네일/글자수 등) — 모바일 글 페이지를 직접 열어보는 것도 검색이 아니라
   가벼운 요청이라 자동 새로고침 대상이다. staleHours 안에 이미 분석된 글은 건너뛴다 — 예전엔
   "최근 10개"는 열 때마다 무조건 재분석하고 "노출 결과가 가리키는 글"은 한 번 분석되면 영원히
   재분석 안 하는 식으로 둘이 따로 놀았는데, 하나로 합쳐서 둘 다 같은 신선도 기준을 쓰게 한다. */
async function analyzeContentIfStale(blogId: string, logNos: string[], deadline: number, staleHours: number): Promise<RefreshError[]> {
  const errors: RefreshError[] = [];
  if (!logNos.length) return errors;
  const existing = await db(
    `blog_rank_post_content_check?select=log_no,checked_at&blog_id=eq.${encodeURIComponent(blogId)}&log_no=in.(${logNos.map(encodeURIComponent).join(",")})`,
  ) as Array<{ log_no: string; checked_at: string }>;
  const freshCutoff = Date.now() - staleHours * 3600_000;
  const freshSet = new Set(
    (existing || []).filter((r) => new Date(r.checked_at).getTime() > freshCutoff).map((r) => r.log_no),
  );
  for (const logNo of logNos) {
    if (Date.now() > deadline) break;
    if (freshSet.has(logNo)) continue;
    try {
      await savePostContentAnalysis(blogId, logNo);
    } catch (error) {
      errors.push({ blogId, logNo, keyword: "-", provider: "postContent", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return errors;
}

async function refreshContentForBlogs(targets: string[], deadline: number): Promise<RefreshError[]> {
  const errors: RefreshError[] = [];
  for (const bid of targets) {
    if (Date.now() > deadline) break;
    const posts = await db(
      `blog_rank_posts?select=log_no&blog_id=eq.${encodeURIComponent(bid)}&order=published_at.desc.nullslast&limit=10`,
    ) as Array<{ log_no: string }>;
    errors.push(...(await analyzeContentIfStale(bid, (posts || []).map((p) => p.log_no), deadline, 24)));
  }
  return errors;
}

/* 노출 진단 카드의 급상승/급하락 키워드가 가리키는 포스팅은 "최근 발행 10개"가 아닌 경우가 흔하다
   (오래된 글이 특정 키워드에서 여전히 잘 노출되는 경우) — 그런 글은 refreshContentForBlogs가 절대
   못 건드려서 썸네일이 영영 안 채워진다. 노출 결과가 가리키는 글만 골라 채운다. */
async function backfillContentForLogNos(blogId: string, logNos: string[], deadline: number): Promise<RefreshError[]> {
  if (!logNos.length) return [];
  await ensurePostRowsExist(blogId, logNos);
  return analyzeContentIfStale(blogId, logNos, deadline, 24);
}

async function backfillThumbnailsForLogNos(blogId: string, logNos: string[], deadline: number): Promise<RefreshError[]> {
  const errors: RefreshError[] = [];
  if (!logNos.length) return errors;
  await ensurePostRowsExist(blogId, logNos);
  for (const logNo of [...new Set(logNos)]) {
    if (Date.now() > deadline) break;
    try {
      await savePostThumbnail(blogId, logNo);
    } catch (error) {
      errors.push({ blogId, logNo, keyword: "-", provider: "postThumbnail", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return errors;
}

/* 신규 포스팅 수집 — 등록된 블로그 RSS만 확인해서 새 글 목록을 추가한다.
   순위/썸네일/본문/AI 분석은 각각 카드 관리 아이콘에서 분리해서 실행한다. */
async function refreshRecent(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const scope = cleanText(body.scope);
  const mineFilter = scope === "competitor" ? "is_mine=eq.false" : "is_mine=eq.true";
  const refreshTargets = blogId
    ? [blogId]
    : ((await db(`blog_rank_blogs?select=blog_id&${mineFilter}&active=eq.true`)) as Array<{ blog_id: string }> || []).map((b) => b.blog_id);
  if (!refreshTargets.length) throw new Error("새로고침할 블로그가 없습니다.");

  const deadline = Date.now() + 60_000;
  const errors = await refreshRssForBlogs(refreshTargets, deadline);

  return { ...(await listData()), collected: refreshTargets.length, errors };
}

async function collectPostRank(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const logNo = cleanText(body.logNo);
  if (!blogId || !logNo) throw new Error("수집할 포스팅을 확인할 수 없습니다.");

  const deadline = Date.now() + 70_000;
  const errors: RefreshError[] = [];
  let collected = 0;

  const rows = await db(
    `blog_rank_post_keywords?select=*&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(logNo)}&active=eq.true&order=updated_at.asc`,
  ) as PostKeywordRow[];
  if (!rows?.length) throw new Error("이 포스팅에 등록된 추적 키워드가 없습니다.");

  for (const row of rows.slice(0, 20)) {
    if (Date.now() > deadline) break;
    try {
      const rankLimit = Number(row.max_rank) || 300;
      const actual = await fetchNaverBlogScreenForPost(row.keyword, row.blog_id, row.log_no, row.device, rankLimit);
      await saveHistory(row.blog_id, row.log_no, row.keyword, row.device, actual);
      collected += 1;
    } catch (error) {
      errors.push({
        blogId: row.blog_id,
        logNo: row.log_no,
        keyword: row.keyword,
        provider: "naver_blog_screen",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const rankLimit = Number(row.max_rank) || 300;
      const official = await fetchNaverBlogApiForPost(row.keyword, row.blog_id, row.log_no, rankLimit);
      await saveHistory(row.blog_id, row.log_no, row.keyword, row.device, official);
      collected += 1;
    } catch (error) {
      errors.push({
        blogId: row.blog_id,
        logNo: row.log_no,
        keyword: row.keyword,
        provider: "naver_blog_api",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    await db(`blog_rank_post_keywords?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
  }

  errors.push(...(await backfillThumbnailsForLogNos(blogId, [logNo], deadline)));
  return { ...(await listData()), collected, errors };
}

async function collect(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);

  // 순위/콘텐츠 수집 전에 RSS로 포스팅 목록부터 최신화한다 — 안 그러면 오늘 새로 쓴 글은
  // blog_rank_posts에 아예 없어서 "최근 게시글 진단"에 안 잡힌다(키워드 수집만으론 새 글이
  // 저절로 안 생김). 경쟁사 블로그까지 매번 RSS를 도는 건 과하니 내 블로그로만 한정한다.
  const refreshTargets = blogId
    ? [blogId]
    : ((await db("blog_rank_blogs?select=blog_id&is_mine=eq.true&active=eq.true")) as Array<{ blog_id: string }> || []).map((b) => b.blog_id);

  // Supabase Edge Function의 request idle timeout(150초, 넘기면 504) 대비 20초 여유 —
  // naver-rank/index.ts에서 쓰는 것과 동일한 예산. blogId 없이 부를 땐 updated_at 오래된
  // 순으로 이미 정렬돼 있어서, 예산 초과로 잘려도 매번 같은 키워드만 밀리진 않는다.
  const deadline = Date.now() + 130_000;
  const errors: RefreshError[] = await refreshRssForBlogs(refreshTargets, deadline);
  let collected = 0;

  const path = blogId
    ? `blog_rank_post_keywords?select=*&blog_id=eq.${encodeURIComponent(blogId)}&active=eq.true`
    : "blog_rank_post_keywords?select=*&active=eq.true&order=updated_at.asc";
  const rows = await db(path) as PostKeywordRow[];
  if (!rows?.length) throw new Error("수집할 키워드가 없습니다.");

  for (const row of rows.slice(0, 50)) {
    if (Date.now() > deadline) break;
    try {
      const actual = await fetchNaverBlogScreenForPost(row.keyword, row.blog_id, row.log_no, row.device, row.max_rank);
      await saveHistory(row.blog_id, row.log_no, row.keyword, row.device, actual);
      collected += 1;
    } catch (error) {
      errors.push({
        blogId: row.blog_id, logNo: row.log_no, keyword: row.keyword, provider: "naver_blog_screen",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const official = await fetchNaverBlogApiForPost(row.keyword, row.blog_id, row.log_no, row.max_rank);
      await saveHistory(row.blog_id, row.log_no, row.keyword, row.device, official);
      collected += 1;
    } catch (error) {
      errors.push({
        blogId: row.blog_id, logNo: row.log_no, keyword: row.keyword, provider: "naver_blog_api",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    await db(`blog_rank_post_keywords?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
  }

  return { ...(await listData()), collected, errors };
}

async function collectDiagnosis(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const path = blogId
    ? `blog_rank_blogs?select=blog_id&blog_id=eq.${encodeURIComponent(blogId)}`
    : "blog_rank_blogs?select=blog_id&is_mine=eq.true&active=eq.true";
  const blogs = await db(path) as Array<{ blog_id: string }>;
  if (!blogs?.length) throw new Error("진단할 블로그가 없습니다.");

  const today = kstDateString();
  const errors: Array<{ blogId: string; message: string }> = [];
  let collected = 0;

  // 블로그차트는 로그인한 계정 소유주의 블로그 1개만 보여주므로 매 블로그마다 다시 부르지 않고 한 번만 조회한다.
  let blogchartRank: Partial<DiagnosisSnapshot> = {};
  try {
    blogchartRank = await fetchBlogchartRank();
  } catch (error) {
    errors.push({ blogId: "blogchart", message: error instanceof Error ? error.message : String(error) });
  }

  for (const { blog_id } of blogs) {
    try {
      const snapshot = await fetchWhereIsPost(blog_id);
      await db("blog_rank_diagnosis?on_conflict=blog_id,snapshot_date", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          blog_id,
          snapshot_date: today,
          ...snapshot,
          ...blogchartRank,
          collected_at: new Date().toISOString(),
        }]),
      });
      collected += 1;
    } catch (error) {
      errors.push({ blogId: blog_id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { ...(await listData()), collected, errors };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = cleanText(body.action) || "list";

    if (action === "list") return json(await listData());
    if (action === "addBlog") return json(await addBlog(body));
    if (action === "removeBlog") return json(await removeBlog(cleanText(body.blogId)));
    if (action === "refreshPosts") return json(await refreshPosts(cleanText(body.blogId)));
    if (action === "addPostKeyword") return json(await addPostKeyword(body));
    if (action === "removePostKeyword") return json(await removePostKeyword(Number(body.id)));
    if (action === "replacePostKeywords") return json(await replacePostKeywords(body));
    if (action === "collect") return json(await collect(body));
    if (action === "collectPostRank") return json(await collectPostRank(body));
    if (action === "refreshRecent") return json(await refreshRecent(body));
    if (action === "collectDiagnosis") return json(await collectDiagnosis(body));
    if (action === "addTargetKeywords") return json(await addTargetKeywords(body));
    if (action === "removeTargetKeyword") return json(await removeTargetKeyword(Number(body.id)));
    if (action === "collectExposure") return json(await collectExposure(body));
    if (action === "collectPostTitleCheck") return json(await collectPostTitleCheck(body));
    if (action === "collectPostContentCheck") return json(await collectPostContentCheck(body));
    if (action === "collectPostAiCheck") return json(await collectPostAiCheck(body));
    return json({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
