const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Device = "desktop" | "mobile";
type Provider = "naver_blog_screen" | "naver_blog_api" | "serpapi_nexearch";

interface BlogTarget {
  id: string;
  post_url: string;
  blog_id: string;
  log_no: string;
  post_title: string;
  keyword: string;
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
  result_title: string;
  result_url: string;
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

function normalizeBlogUrl(value: unknown) {
  const decoded = decodeHtml(value);
  try {
    const url = new URL(decoded.startsWith("http") ? decoded : `https://${decoded}`);
    const host = url.hostname.toLowerCase();
    if (host === "m.blog.naver.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        return `https://blog.naver.com/${parts[0]}/${parts[1]}`;
      }
    }
    if (host === "blog.naver.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        return `https://blog.naver.com/${parts[0]}/${parts[1]}`;
      }
      const blogId = url.searchParams.get("blogId") || url.searchParams.get("blogid") || "";
      const logNo = url.searchParams.get("logNo") || url.searchParams.get("logno") || "";
      if (blogId && /^\d+$/.test(logNo)) return `https://blog.naver.com/${blogId}/${logNo}`;
    }
  } catch {
    // Fall through to the raw value; non-Naver blog cards still need a stable key.
  }
  return decoded.split(/[?#]/)[0];
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
}

function targetNeedle(target: BlogTarget) {
  return `https://blog.naver.com/${target.blog_id}/${target.log_no}`.toLowerCase();
}

function cardContainsTarget(card: string, target: BlogTarget) {
  const normalized = decodeHtml(card).toLowerCase();
  return normalized.includes(targetNeedle(target)) ||
    normalized.includes(`m.blog.naver.com/${target.blog_id.toLowerCase()}/${target.log_no}`);
}

function extractTitleFromCard(card: string) {
  const anchor = card.match(/<a[^>]+class=["'][^"']*(?:title|link_tit|name)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  if (anchor) return stripTags(decodeHtml(anchor[1]));
  const firstAnchor = card.match(/<a[^>]*>([\s\S]{1,300}?)<\/a>/i);
  return firstAnchor ? stripTags(decodeHtml(firstAnchor[1])) : "";
}

function extractMainUrlFromCard(card: string) {
  const normalized = decodeHtml(card);
  const canonical = normalized.match(/https?:\/\/m?\.?blog\.naver\.com\/[A-Za-z0-9_.-]+\/\d+/i);
  if (canonical) return normalizeBlogUrl(canonical[0]);

  const postView = normalized.match(/https?:\/\/blog\.naver\.com\/PostView\.naver\?[^"'<>\s]+/i);
  if (postView) return normalizeBlogUrl(postView[0]);

  const hrefs = [...normalized.matchAll(/href=["']([^"']+)["']/gi)]
    .map(match => decodeHtml(match[1]))
    .filter(url => /^https?:\/\//i.test(url))
    .filter(url => !/search\.naver\.com|ssl\.pstatic\.net|static\.naver\./i.test(url));
  return hrefs[0] ? normalizeBlogUrl(hrefs[0]) : "";
}

function extractBlogCards(html: string) {
  const normalized = decodeHtml(html);
  return normalized
    .split(/data-template-id=["']ugcItem["']/i)
    .slice(1)
    .map(card => card.slice(0, 24000));
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

function parsePostUrl(value: unknown) {
  const raw = cleanText(value);
  if (!raw) throw new Error("블로그 포스팅 URL을 입력해 주세요.");

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error("올바른 블로그 포스팅 URL이 아닙니다.");
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("blog.naver.com") && host !== "m.blog.naver.com") {
    throw new Error("네이버 블로그 포스팅 URL만 등록할 수 있습니다.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  let blogId = "";
  let logNo = "";

  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    [blogId, logNo] = parts;
  } else {
    blogId = url.searchParams.get("blogId") || url.searchParams.get("blogid") || "";
    logNo = url.searchParams.get("logNo") || url.searchParams.get("logno") || "";
  }

  if (!blogId || !/^\d+$/.test(logNo)) {
    throw new Error("URL에서 블로그 ID와 포스팅 번호를 확인할 수 없습니다.");
  }

  return {
    blogId,
    logNo,
    canonicalUrl: `https://blog.naver.com/${blogId}/${logNo}`,
  };
}

function samePost(link: unknown, target: BlogTarget) {
  try {
    const parsed = parsePostUrl(link);
    return parsed.blogId.toLowerCase() === target.blog_id.toLowerCase() &&
      parsed.logNo === target.log_no;
  } catch {
    return false;
  }
}

async function fetchNaverBlogApi(target: BlogTarget): Promise<RankResult> {
  const clientId = env("NAVER_CLIENT_ID");
  const clientSecret = env("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("네이버 검색 API 키가 없습니다.");

  const limit = Math.min(1000, Math.max(100, target.max_rank || 300));
  let checked = 0;

  for (let start = 1; start <= limit; start += 100) {
    const url = new URL("https://openapi.naver.com/v1/search/blog.json");
    url.searchParams.set("query", target.keyword);
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
      if (samePost(items[index]?.link, target)) {
        const rank = start + index;
        return {
          provider: "naver_blog_api",
          rank,
          page: Math.ceil(rank / 10),
          found: true,
          checked_count: checked,
          result_title: stripTags(items[index]?.title),
          result_url: cleanText(items[index]?.link),
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
    result_title: "",
    result_url: "",
    collected_at: new Date().toISOString(),
  };
}

async function fetchNaverBlogScreen(target: BlogTarget): Promise<RankResult> {
  const limit = Math.min(1000, Math.max(30, target.max_rank || 300));
  const firstUrl = new URL("https://search.naver.com/search.naver");
  firstUrl.searchParams.set("ssc", "tab.blog.all");
  firstUrl.searchParams.set("sm", "tab_jum");
  firstUrl.searchParams.set("query", target.keyword);

  let html = await fetchNaverText(firstUrl.toString(), target.device);
  let next = extractNextRequest(html);
  const seen = new Set<string>();
  let checked = 0;

  for (let pageLoop = 0; pageLoop < 40 && checked < limit; pageLoop += 1) {
    const cards = extractBlogCards(html);

    for (const card of cards) {
      const mainUrl = extractMainUrlFromCard(card);
      const key = mainUrl || `card:${simpleHash(stripTags(card).slice(0, 800))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checked += 1;

      if (cardContainsTarget(card, target)) {
        return {
          provider: "naver_blog_screen",
          rank: checked,
          page: Math.ceil(checked / 30),
          found: true,
          checked_count: checked,
          result_title: extractTitleFromCard(card),
          result_url: target.post_url,
          collected_at: new Date().toISOString(),
        };
      }

      if (checked >= limit) break;
    }

    if (checked >= limit || !next?.url) break;

    const jsonText = await fetchNaverText(next.url, target.device, next.queryInfo);
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
    result_title: "",
    result_url: "",
    collected_at: new Date().toISOString(),
  };
}

async function saveHistory(targetId: string, result: RankResult) {
  await db("blog_rank_history", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{
      target_id: targetId,
      provider: result.provider,
      rank: result.rank,
      page: result.page,
      found: result.found,
      checked_count: result.checked_count,
      result_title: result.result_title,
      result_url: result.result_url,
      collected_at: result.collected_at,
    }]),
  });
}

async function listData() {
  const targets = await db(
    "blog_rank_targets?select=*&order=created_at.desc",
  ) as BlogTarget[];
  const history = await db(
    "blog_rank_history?select=*&order=collected_at.desc&limit=2000",
  ) as Array<Record<string, unknown>>;

  return {
    targets: targets || [],
    history: history || [],
    capabilities: {
      naverBlogScreen: true,
      naverBlogApi: !!env("NAVER_CLIENT_ID") && !!env("NAVER_CLIENT_SECRET"),
    },
  };
}

async function addTargets(body: Record<string, unknown>) {
  const parsed = parsePostUrl(body.postUrl);
  const keywords = Array.from(new Set(
    (Array.isArray(body.keywords) ? body.keywords : cleanText(body.keywords).split(","))
      .map(cleanText)
      .filter(Boolean),
  ));
  if (!keywords.length) throw new Error("추적할 검색 키워드를 입력해 주세요.");
  if (keywords.length > 20) throw new Error("한 번에 최대 20개 키워드까지 등록할 수 있습니다.");

  const device: Device = body.device === "mobile" ? "mobile" : "desktop";
  const maxRank = [100, 300, 500, 1000].includes(Number(body.maxRank))
    ? Number(body.maxRank)
    : 300;
  const now = new Date().toISOString();
  const rows = keywords.map((keyword) => ({
    post_url: parsed.canonicalUrl,
    blog_id: parsed.blogId,
    log_no: parsed.logNo,
    post_title: cleanText(body.postTitle),
    keyword,
    device,
    max_rank: maxRank,
    active: true,
    updated_at: now,
  }));

  await db(
    "blog_rank_targets?on_conflict=blog_id,log_no,keyword,device",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows),
    },
  );
  return listData();
}

async function removeTarget(id: string) {
  if (!id) throw new Error("삭제할 추적 대상이 없습니다.");
  await db(`blog_rank_targets?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return listData();
}

async function collect(body: Record<string, unknown>) {
  const targetId = cleanText(body.targetId);
  const path = targetId
    ? `blog_rank_targets?select=*&id=eq.${encodeURIComponent(targetId)}`
    : "blog_rank_targets?select=*&active=eq.true&order=updated_at.asc";
  const targets = await db(path) as BlogTarget[];
  if (!targets?.length) throw new Error("수집할 블로그 순위가 없습니다.");

  const errors: Array<{ targetId: string; provider: string; message: string }> = [];
  let collected = 0;

  for (const target of targets.slice(0, 50)) {
    try {
      const actual = await fetchNaverBlogScreen(target);
      await saveHistory(target.id, actual);
      collected += 1;
    } catch (error) {
      errors.push({
        targetId: target.id,
        provider: "naver_blog_screen",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const official = await fetchNaverBlogApi(target);
      await saveHistory(target.id, official);
      collected += 1;
    } catch (error) {
      errors.push({
        targetId: target.id,
        provider: "naver_blog_api",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    await db(`blog_rank_targets?id=eq.${encodeURIComponent(target.id)}`, {
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
    if (action === "add") return json(await addTargets(body));
    if (action === "delete") return json(await removeTarget(cleanText(body.targetId)));
    if (action === "collect") return json(await collect(body));
    return json({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
