const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Device = "desktop" | "mobile";
type Provider = "naver_blog_api" | "serpapi_nexearch";

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

async function fetchSerpApiNexearch(target: BlogTarget): Promise<RankResult | null> {
  const apiKey = env("SERPAPI_API_KEY");
  if (!apiKey) return null;

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "naver");
  url.searchParams.set("query", target.keyword);
  url.searchParams.set("where", "nexearch");
  url.searchParams.set("device", target.device);
  url.searchParams.set("no_cache", "true");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`실제 통합검색 API ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  if (data.error) throw new Error(`실제 통합검색 API: ${data.error}`);

  const items = Array.isArray(data.view_results) ? data.view_results : [];
  for (let index = 0; index < items.length; index += 1) {
    if (samePost(items[index]?.link, target)) {
      const rank = Number(items[index]?.position) || index + 1;
      return {
        provider: "serpapi_nexearch",
        rank,
        page: 1,
        found: true,
        checked_count: items.length,
        result_title: stripTags(items[index]?.title),
        result_url: cleanText(items[index]?.link),
        collected_at: new Date().toISOString(),
      };
    }
  }

  return {
    provider: "serpapi_nexearch",
    rank: null,
    page: null,
    found: false,
    checked_count: items.length,
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
      naverBlogApi: !!env("NAVER_CLIENT_ID") && !!env("NAVER_CLIENT_SECRET"),
      serpApiNexearch: !!env("SERPAPI_API_KEY"),
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

    try {
      const actual = await fetchSerpApiNexearch(target);
      if (actual) {
        await saveHistory(target.id, actual);
        collected += 1;
      }
    } catch (error) {
      errors.push({
        targetId: target.id,
        provider: "serpapi_nexearch",
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
