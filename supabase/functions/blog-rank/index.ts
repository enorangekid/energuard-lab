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

async function fetchNaverBlogScreenForPost(
  keyword: string,
  blogId: string,
  logNo: string,
  device: Device,
  maxRank: number,
): Promise<RankResult> {
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

      if (mainUrl && isSamePost(mainUrl, blogId, logNo)) {
        return {
          provider: "naver_blog_screen",
          rank: checked,
          page: Math.ceil(checked / 30),
          found: true,
          checked_count: checked,
          collected_at: new Date().toISOString(),
        };
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

  return {
    provider: "naver_blog_screen",
    rank: null,
    page: null,
    found: false,
    checked_count: checked,
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

async function saveHistory(blogId: string, logNo: string, keyword: string, device: Device, result: RankResult) {
  const collectedDate = new Date().toISOString().slice(0, 10);
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

async function listData() {
  const [blogs, posts, postKeywords, history] = await Promise.all([
    db("blog_rank_blogs?select=*&order=created_at.desc") as Promise<BlogRow[]>,
    db("blog_rank_posts?select=*&order=published_at.desc.nullslast&limit=500") as Promise<PostRow[]>,
    db("blog_rank_post_keywords?select=*&order=created_at.asc") as Promise<PostKeywordRow[]>,
    db("blog_rank_history?select=*&order=collected_at.desc&limit=3000") as Promise<Array<Record<string, unknown>>>,
  ]);

  return {
    blogs: blogs || [],
    posts: posts || [],
    postKeywords: postKeywords || [],
    history: history || [],
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

async function collect(body: Record<string, unknown>) {
  const blogId = cleanText(body.blogId);
  const path = blogId
    ? `blog_rank_post_keywords?select=*&blog_id=eq.${encodeURIComponent(blogId)}&active=eq.true`
    : "blog_rank_post_keywords?select=*&active=eq.true&order=updated_at.asc";
  const rows = await db(path) as PostKeywordRow[];
  if (!rows?.length) throw new Error("수집할 키워드가 없습니다.");

  const errors: Array<{ blogId: string; logNo: string; keyword: string; provider: string; message: string }> = [];
  let collected = 0;

  for (const row of rows.slice(0, 50)) {
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
    return json({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
