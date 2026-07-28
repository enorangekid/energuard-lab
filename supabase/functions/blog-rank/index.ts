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
  comment_count: number | null;
  quote_count: number | null;
  external_link_count: number | null;
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
   데스크톱 페이지(blog.naver.com)는 iframe 래퍼라 <title>이 블로그 이름만 나오고 실제 글 제목은 안 나온다. */
async function fetchPostTitleFallback(blogId: string, logNo: string): Promise<string | null> {
  try {
    const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    });
    const text = await response.text();
    const match = text.match(/<title>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    return stripTags(decodeHtml(match[1])).replace(/\s*:\s*네이버 블로그\s*$/, "").trim() || null;
  } catch {
    return null;
  }
}

/* 게시글 진단 모달용 — 모바일 페이지(m.blog.naver.com)를 열어 본문 분석 지표를 뽑는다.
   공감(좋아요) 수는 이 정적 페이지 안에 없어서(별도 API로 로드되는 것으로 보임) 제외했다. */
async function fetchPostContentAnalysis(blogId: string, logNo: string): Promise<PostContentAnalysis> {
  const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`포스팅 페이지 조회 실패 (${response.status})`);

  const commentMatch = text.match(/commentCount="(\d+)"/);

  let imageCount: number | null = null;
  let thumbnailUrl: string | null = null;
  const imageInfoMatch = text.match(/attachImagePathAndIdInfo\s*=\s*'([^']*)'/);
  if (imageInfoMatch) {
    try {
      const decoded = imageInfoMatch[1].replace(/&#034;/g, "\"").replace(/&#039;/g, "'").replace(/&amp;/g, "&");
      const images = JSON.parse(decoded) as Array<{ path?: string }>;
      imageCount = images.length;
      if (images[0]?.path) thumbnailUrl = `https://blogfiles.pstatic.net${images[0].path}`;
    } catch {
      // 이미지 정보 파싱 실패 시 무시하고 null로 둔다
    }
  }

  const paragraphMatches = [...text.matchAll(/<p class="se-text-paragraph[^>]*>([\s\S]*?)<\/p>/g)];
  const charCount = paragraphMatches.length
    ? paragraphMatches.map((m) => stripTags(decodeHtml(m[1]))).join("").length
    : null;

  const quoteCount = (text.match(/class="se-quotation"/g) || []).length;
  const externalLinkCount = (text.match(/se-oglink/g) || []).length;

  return {
    thumbnail_url: thumbnailUrl,
    char_count: charCount,
    image_count: imageCount,
    comment_count: commentMatch ? Number(commentMatch[1]) : null,
    quote_count: quoteCount,
    external_link_count: externalLinkCount,
  };
}

async function saveExposureHistory(blogId: string, keyword: string, device: Device, result: ExposureResult) {
  const collectedDate = kstDateString();
  let resultTitle: string | null = null;
  if (result.resultLogNo) {
    const rows = await db(
      `blog_rank_posts?select=title&blog_id=eq.${encodeURIComponent(blogId)}&log_no=eq.${encodeURIComponent(result.resultLogNo)}`,
    ) as Array<{ title: string }>;
    resultTitle = rows?.[0]?.title || null;
    if (!resultTitle) resultTitle = await fetchPostTitleFallback(blogId, result.resultLogNo);
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
  await db("blog_rank_post_content_check?on_conflict=blog_id,log_no", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      blog_id: blogId,
      log_no: logNo,
      ...analysis,
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

async function listData() {
  const [blogs, posts, postKeywords, history, diagnosis, targetKeywords, exposureHistory, postTitleChecks, postContentChecks] = await Promise.all([
    db("blog_rank_blogs?select=*&order=created_at.desc") as Promise<BlogRow[]>,
    db("blog_rank_posts?select=*&order=published_at.desc.nullslast&limit=500") as Promise<PostRow[]>,
    db("blog_rank_post_keywords?select=*&order=created_at.asc") as Promise<PostKeywordRow[]>,
    db("blog_rank_history?select=*&order=collected_at.desc&limit=3000") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_diagnosis?select=*&order=snapshot_date.desc&limit=400") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_target_keywords?select=*&order=created_at.asc") as Promise<TargetKeywordRow[]>,
    db("blog_rank_exposure_history?select=*&order=collected_at.desc&limit=2000") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_post_title_check?select=*") as Promise<Array<Record<string, unknown>>>,
    db("blog_rank_post_content_check?select=*") as Promise<Array<Record<string, unknown>>>,
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
    capabilities: {
      naverBlogScreen: true,
      naverBlogApi: !!env("NAVER_CLIENT_ID") && !!env("NAVER_CLIENT_SECRET"),
      searchVolume: !!env("NAVER_AD_CUSTOMER_ID") && !!env("NAVER_AD_ACCESS_LICENSE") && !!env("NAVER_AD_SECRET_KEY"),
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
  const { blogName, posts } = await fetchBlogRss(blogId);
  await db(`blog_rank_blogs?blog_id=eq.${encodeURIComponent(blogId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ blog_name: blogName, updated_at: new Date().toISOString() }),
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

type RefreshError = { blogId: string; logNo: string; keyword: string; provider: string; message: string };

/* RSS 새로고침 — 네이버 "검색"이 아니라 블로그 자체 RSS 피드를 직접 열어보는 가벼운 요청이라
   collect()의 무거운 키워드 순위 루프와 분리해서 페이지 진입 시마다 자동으로 돌려도 부담이 없다. */
async function refreshRssForBlogs(targets: string[], deadline: number): Promise<RefreshError[]> {
  const errors: RefreshError[] = [];
  for (const target of targets) {
    if (Date.now() > deadline) break;
    try {
      const { blogName, posts } = await fetchBlogRss(target);
      await db(`blog_rank_blogs?blog_id=eq.${encodeURIComponent(target)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ blog_name: blogName, updated_at: new Date().toISOString() }),
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
   저장이 통째로 실패한다 — 제목을 못 구했을 때 쓰는 fetchPostTitleFallback으로 스텁 행을 먼저
   채워서 이 실패를 없앤다. */
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
    const title = (await fetchPostTitleFallback(blogId, logNo)) || logNo;
    rows.push({
      blog_id: blogId,
      log_no: logNo,
      title,
      post_url: `https://blog.naver.com/${blogId}/${logNo}`,
      published_at: null,
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

/* 노출 진단(collectExposure)이나 페이지 진입 시 자동 호출용 — 무거운 키워드 순위 수집 없이
   포스팅 목록(RSS)과 최근 글 콘텐츠 분석(썸네일 등)만 가볍게 새로고침한다. */
async function refreshRecent(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const refreshTargets = blogId
    ? [blogId]
    : ((await db("blog_rank_blogs?select=blog_id&is_mine=eq.true&active=eq.true")) as Array<{ blog_id: string }> || []).map((b) => b.blog_id);
  if (!refreshTargets.length) throw new Error("새로고침할 블로그가 없습니다.");

  const deadline = Date.now() + 60_000;
  const errors = [
    ...(await refreshRssForBlogs(refreshTargets, deadline)),
    ...(await refreshContentForBlogs(refreshTargets, deadline)),
  ];

  for (const bid of refreshTargets) {
    if (Date.now() > deadline) break;
    const exposureRows = await db(
      `blog_rank_exposure_history?select=result_log_no&blog_id=eq.${encodeURIComponent(bid)}&provider=eq.naver_blog_screen&found=eq.true&result_log_no=not.is.null&order=collected_at.desc&limit=300`,
    ) as Array<{ result_log_no: string }>;
    const logNos = [...new Set((exposureRows || []).map((r) => r.result_log_no).filter(Boolean))].slice(0, 40);
    errors.push(...(await backfillContentForLogNos(bid, logNos, deadline)));
  }

  return { ...(await listData()), collected: refreshTargets.length, errors };
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

  // "최근 게시글 진단"(썸네일/글자수/사진/댓글 등)도 순위 수집할 때 같이 채운다 — 모달에서
  // 포스팅 하나씩 "분석 새로고침"을 눌러야만 채워지던 걸, 이 블로그별 최근 10개 포스팅에 한해
  // 자동으로 같이 돌게 한다.
  const touchedBlogIds = [...new Set([...refreshTargets, ...rows.slice(0, 50).map((r) => r.blog_id)])];
  errors.push(...(await refreshContentForBlogs(touchedBlogIds, deadline)));

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
    if (action === "collect") return json(await collect(body));
    if (action === "refreshRecent") return json(await refreshRecent(body));
    if (action === "collectDiagnosis") return json(await collectDiagnosis(body));
    if (action === "addTargetKeywords") return json(await addTargetKeywords(body));
    if (action === "removeTargetKeyword") return json(await removeTargetKeyword(Number(body.id)));
    if (action === "collectExposure") return json(await collectExposure(body));
    if (action === "collectPostTitleCheck") return json(await collectPostTitleCheck(body));
    if (action === "collectPostContentCheck") return json(await collectPostContentCheck(body));
    return json({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
