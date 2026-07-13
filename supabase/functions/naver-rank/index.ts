// supabase/functions/naver-rank/index.ts  (v2 — 키워드 분석)
// 스토어 순위 + 시장 통계 + TOP10 + 검색광고 키워드도구(검색량·연관키워드)
//
// 시크릿 (기존):  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
// 시크릿 (추가):  NAVER_AD_CUSTOMER_ID / NAVER_AD_ACCESS_LICENSE / NAVER_AD_SECRET_KEY
//   → 검색광고 시크릿이 없으면 검색량 섹션만 null로 반환 (나머지 정상 동작)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ShopItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  mallName: string;
  productId: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

/* ── 월별 검색량 저장 (keyword_search_volume_monthly) ──
   키워드도구는 "최근 1개월" 롤링 값만 주므로, 매달 비슷한 시점에 스냅샷을 떠서
   그 달의 대표값으로 저장한다. 검색할 때마다 공짜로(추가 API 호출 없이) 쌓인다. */
const VOLUME_TABLE = "keyword_search_volume_monthly";

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
  if (!res.ok) throw new Error(`volume save ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function currentSnapshotMonth() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 실패해도 검색 자체는 계속 정상 동작해야 하므로 항상 조용히 무시한다.
async function saveMonthlyVolume(keyword: string, pc: number, mobile: number) {
  try {
    await supabaseRequest(`/rest/v1/${VOLUME_TABLE}?on_conflict=keyword,snapshot_month`, {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        keyword: norm(keyword).toLowerCase(),
        snapshot_month: currentSnapshotMonth(),
        pc, mobile, total: pc + mobile,
        captured_at: new Date().toISOString(),
      }]),
    });
  } catch (_) { /* 검색량 저장 실패는 무시 — 검색 결과 응답에 영향 없음 */ }
}

const norm = (s: string) => String(s).replace(/\s+/g, "");
const exactStoreName = (s: string) => String(s).trim().replace(/\s+/g, " ");
const isExactStore = (mallName: string, storeName: string) =>
  exactStoreName(mallName) === exactStoreName(storeName);

/* 오픈마켓/종합몰 — 판매자 점유율 집계에서 제외 */
const OPEN_MARKETS = [
  "G마켓", "지마켓", "옥션", "11번가", "위메프", "티몬", "인터파크",
  "인터파크쇼핑", "롯데ON", "롯데온", "롯데홈쇼핑", "롯데아이몰", "SSG닷컴",
  "신세계몰", "이마트몰", "홈플러스", "GS SHOP", "GSSHOP", "CJ온스타일",
  "현대Hmall", "현대홈쇼핑", "AK몰", "NS홈쇼핑", "하프클럽", "G9", "쿠팡",
].map((s) => norm(s).toLowerCase());

const isOpenMarket = (mall: string) =>
  OPEN_MARKETS.includes(norm(mall).toLowerCase());
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

/* ── 검색광고 API 서명 (HMAC-SHA256) ── */
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

/* "< 10" 같은 문자열 검색량 → 숫자 */
function adNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.includes("<")) return 5;
    const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* ── 검색광고 키워드도구 원시 호출 (힌트 최대 5개) ── */
async function fetchKeywordstool(hints: string[]) {
  const customerId = Deno.env.get("NAVER_AD_CUSTOMER_ID");
  const license = Deno.env.get("NAVER_AD_ACCESS_LICENSE");
  const secret = Deno.env.get("NAVER_AD_SECRET_KEY");
  if (!customerId || !license || !secret) {
    return { ok: false as const, reason: "검색광고 시크릿 미설정", list: [] };
  }

  const hint = hints.map((h) => norm(h)).filter(Boolean).slice(0, 5).join(","); // 공백 미허용
  const path = "/keywordstool";
  const timestamp = String(Date.now());
  const sig = await adSignature(secret, timestamp, "GET", path);

  const res = await fetch(
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
  if (!res.ok) {
    return { ok: false as const, reason: `검색광고 API ${res.status}: ${(await res.text()).slice(0, 120)}`, list: [] };
  }

  const data = await res.json();
  const list = ((data.keywordList ?? []) as Array<Record<string, unknown>>).map((k) => {
    const pc = adNum(k.monthlyPcQcCnt);
    const mobile = adNum(k.monthlyMobileQcCnt);
    return {
      keyword: String(k.relKeyword ?? ""),
      pc, mobile, total: pc + mobile,
      compIdx: String(k.compIdx ?? ""),
    };
  });
  return { ok: true as const, list };
}

/* ── 검색광고 키워드도구 조회 ── */
async function fetchAdStats(keyword: string) {
  const res = await fetchKeywordstool([keyword]);
  if (!res.ok) return { ok: false as const, reason: res.reason };

  const target = norm(keyword).toUpperCase();
  let main: { pc: number; mobile: number; total: number } | null = null;
  const related: Array<{ keyword: string; pc: number; mobile: number; total: number; compIdx: string }> = [];

  for (const item of res.list) {
    if (norm(item.keyword).toUpperCase() === target) {
      main = { pc: item.pc, mobile: item.mobile, total: item.total };
    } else {
      related.push(item);
    }
  }
  related.sort((a, b) => b.total - a.total);

  // 전체 후보를 반환 (최대 300개) — 텍스트 매칭·카테고리 필터·최종 15개 선별은 호출부에서.
  // 상위 30개만 자르면 대형 헤드 키워드만 남고 상품명에 쓸 롱테일 변형이 다 잘려나간다.
  return { ok: true as const, main, related: related.slice(0, 300) };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* 연관키워드 배열에 상품수·경쟁강도·카테고리(1위 상품 기준)를 채운다 — 키워드당 쇼핑 API 1콜, 5개 병렬.
   후보가 50개까지 늘면서 호출이 몰리면 네이버가 간헐적으로 429를 던지므로
   실패 시 잠깐 쉬고 최대 3회 재시도하고, 배치 사이에도 짧게 쉬어 폭주를 완화한다. */
async function enrichRelatedKeywords(rel: Array<Record<string, unknown>>, clientId: string, clientSecret: string) {
  const targets = rel.filter((k) => k.products == null); // 이미 채워진 항목(leftovers 재활용)은 재조회하지 않음
  for (let i = 0; i < targets.length; i += 8) { // 8개 병렬 — 429는 아래 재시도가 흡수한다
    await Promise.all(targets.slice(i, i + 8).map(async (k) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetch(
            `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(String(k.keyword))}&display=1`,
            { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
          );
          if (r.status === 429) { await sleep(400 * (attempt + 1)); continue; } // 호출 한도 — 쉬었다 재시도
          if (!r.ok) return;
          const j = await r.json();
          const products = j.total ?? 0;
          k.products = products;
          const vol = Number(k.total) || 0;
          k.compRatio = vol > 0 ? Math.round(products / vol * 1000) / 1000 : null;
          const it = (j.items ?? [])[0];
          if (it) {
            k.category = [it.category3, it.category4].filter(Boolean).join(" > ") ||
                         [it.category1, it.category2].filter(Boolean).join(" > ");
          }
          return;
        } catch (_) { await sleep(300); /* 네트워크 오류 — 재시도 */ }
      }
    }));
  }
}

/* 키워드 하나의 대표 상품(정확도 1위)만 가볍게 조회 — 홈 화면 TOP 노출 상품용 배치 모드에서 사용 */
async function fetchTopOne(keyword: string, clientId: string, clientSecret: string) {
  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=1&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    });
    if (!res.ok) return { keyword, product: null };
    const data = await res.json();
    const item: ShopItem | undefined = (data.items ?? [])[0];
    if (!item) return { keyword, product: null };
    return {
      keyword,
      product: {
        rank: 1,
        title: stripTags(item.title),
        price: Number(item.lprice) || 0,
        mall: item.mallName,
        image: item.image || "",
        link: item.link,
      },
    };
  } catch (e) {
    return { keyword, product: null };
  }
}

/* ── 쇼핑 검색 페이지 병렬 수집 ──
   1페이지를 먼저 받아 전체 결과 수를 확인한 뒤, 필요한 나머지 페이지를 동시에 요청한다.
   순차 호출(페이지당 0.3~0.5초 × 10) 대비 스캔 시간이 1/4 수준으로 줄어든다.
   결과 배열은 페이지 순서대로 이어붙이므로 순위 집계 로직은 그대로 쓸 수 있다. */
async function fetchShopPageRaw(keyword: string, start: number, clientId: string, clientSecret: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=100&start=${start}&sort=sim`,
      { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
    );
    if (res.status === 429) { await sleep(300 * (attempt + 1)); continue; } // 호출 한도 — 쉬었다 재시도
    if (!res.ok) throw new Error(`네이버 API 오류 (${res.status}): ${(await res.text()).slice(0, 120)}`);
    return await res.json();
  }
  throw new Error("네이버 API 오류 (429 반복)");
}

async function fetchShopItems(keyword: string, limit: number, clientId: string, clientSecret: string) {
  const first = await fetchShopPageRaw(keyword, 1, clientId, clientSecret);
  const total = first.total ?? 0;
  const items: ShopItem[] = first.items ?? [];
  const pages = Math.min(Math.ceil(limit / 100), Math.ceil(total / 100));
  if (pages > 1 && items.length === 100) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetchShopPageRaw(keyword, 1 + (i + 1) * 100, clientId, clientSecret)),
    );
    rest.forEach((p) => items.push(...((p.items ?? []) as ShopItem[])));
  }
  return { total, items };
}

/* ═══ 아이템 추적 서버 수집 (cron용) ═══
   tracked_items의 모든 상품·키워드를 서버 혼자 수집한다.
   pg_cron이 매일 { action: "collectTracked" }로 호출 — 브라우저를 열 필요가 없다. */

async function scanKeywordForWatch(
  keyword: string,
  watchSet: Set<string>,
  clientId: string,
  clientSecret: string,
) {
  const watched: Array<{ productId: string; rank: number; title: string; price: number; mallName: string; image: string; link: string }> = [];
  let counted = 0;
  const { items } = await fetchShopItems(keyword, 1000, clientId, clientSecret); // 페이지 병렬 수집
  for (const item of items) {
    if (item.mallName === "네이버") continue; // 카탈로그 — 본 스캔과 동일하게 순위에서 제외
    counted++;
    if (counted > 1000) break;
    const apiId = String(item.productId).trim();
    const linkId = (String(item.link).match(/\/products\/(\d+)/) || [])[1] || "";
    const matchedCode = watchSet.has(apiId) ? apiId : (linkId && watchSet.has(linkId) ? linkId : "");
    if (matchedCode) {
      watched.push({
        productId: matchedCode,
        rank: counted,
        title: stripTags(item.title),
        price: Number(item.lprice) || 0,
        mallName: item.mallName,
        image: item.image || "",
        link: item.link,
      });
    }
  }
  return watched;
}

async function collectTrackedItems() {
  const clientId = Deno.env.get("NAVER_CLIENT_ID");
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요");

  const items: Array<Record<string, unknown>> = await supabaseRequest(
    `/rest/v1/tracked_items?select=product_code,product_name,product_image,product_link,mall_name,keywords`,
  ) || [];
  if (!items.length) return { ok: true, message: "추적 아이템 없음", keywords: 0, rowsSaved: 0 };

  const keywordMap = new Map<string, Set<string>>();
  items.forEach((it) => {
    const kws = Array.isArray(it.keywords) ? it.keywords : [];
    kws.forEach((kw) => {
      const k = String(kw).trim();
      if (!k) return;
      if (!keywordMap.has(k)) keywordMap.set(k, new Set());
      keywordMap.get(k)!.add(String(it.product_code));
    });
  });
  const allCodes = new Set(items.map((i) => String(i.product_code)));
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const collectedDate = kst.toISOString().slice(0, 10);
  const deadline = Date.now() + 100_000; // Edge Function 실행시간 한도 대비 100초 예산
  let keywordsDone = 0;
  let rowsSaved = 0;

  for (const [keyword, codes] of keywordMap) {
    if (Date.now() > deadline) break; // 남은 키워드는 다음 실행에서 (하루 1회라 이월돼도 무방)
    try {
      const watched = await scanKeywordForWatch(keyword, allCodes, clientId, clientSecret);
      const foundByCode = new Map(watched.map((w) => [w.productId, w]));

      const rows: Array<Record<string, unknown>> = [];
      const seen = new Set<string>();
      codes.forEach((code) => {
        const w = foundByCode.get(code);
        rows.push({
          product_code: code, keyword,
          rank: w ? w.rank : null,
          price: w ? w.price : 0,
          mall_name: w ? w.mallName : "",
          collected_date: collectedDate,
          checked_at: new Date().toISOString(),
        });
        seen.add(code);
      });
      watched.forEach((w) => { // 이 키워드를 추적하지 않는 감시 상품도 걸리면 보너스 저장
        if (seen.has(w.productId)) return;
        rows.push({
          product_code: w.productId, keyword,
          rank: w.rank, price: w.price, mall_name: w.mallName,
          collected_date: collectedDate, checked_at: new Date().toISOString(),
        });
      });
      if (rows.length) {
        await supabaseRequest(`/rest/v1/tracked_item_history?on_conflict=product_code,keyword,collected_date`, {
          method: "POST",
          headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        });
        rowsSaved += rows.length;
      }

      // 상품명/이미지/판매처 메타 자동 갱신
      for (const w of watched) {
        const item = items.find((i) => String(i.product_code) === w.productId);
        if (!item) continue;
        const patch: Record<string, unknown> = {};
        if (w.title && w.title !== item.product_name) patch.product_name = w.title;
        if (w.image && w.image !== item.product_image) patch.product_image = w.image;
        if (w.mallName && w.mallName !== item.mall_name) patch.mall_name = w.mallName;
        if (w.link && !item.product_link) patch.product_link = w.link;
        if (Object.keys(patch).length) {
          patch.updated_at = new Date().toISOString();
          await supabaseRequest(`/rest/v1/tracked_items?product_code=eq.${encodeURIComponent(w.productId)}`, {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify(patch),
          });
          Object.assign(item, patch);
        }
      }
      keywordsDone++;
    } catch (_) { /* 개별 키워드 실패는 건너뛰고 계속 */ }
  }

  return { ok: true, collectedDate, keywords: keywordMap.size, keywordsDone, rowsSaved };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { storeName, keyword, keywords, maxRank = 400, withInsight = true, withVolume = false, watchProductIds } = body;

    /* cron 일괄 수집: 추적 아이템 전체의 순위·가격 스냅샷 (pg_cron이 매일 호출) */
    if (body.action === "collectTracked") {
      return json(await collectTrackedItems());
    }

    const clientId = Deno.env.get("NAVER_CLIENT_ID");
    const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json({ error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 설정되지 않았습니다." }, 500);
    }

    /* 배치 모드: 여러 키워드의 대표 상품만 한 번의 호출로 병렬 조회 (TOP 노출 상품 카드용) */
    if (Array.isArray(keywords)) {
      const list = keywords.slice(0, 20).map((k: unknown) => String(k)).filter(Boolean);
      const results = await Promise.all(list.map((kw) => fetchTopOne(kw, clientId, clientSecret)));
      return json({ results });
    }

    if (!keyword) {
      return json({ error: "keyword는 필수입니다." }, 400);
    }

    const limit = Math.min(Number(maxRank) || 400, 1000);
    const store = String(storeName || "").trim();

    /* 아이템 추적: 이미 돌고 있는 스캔에서 감시 대상 상품코드의 순위·가격을 공짜로 건져낸다.
       (별도 API 호출 없음 — 스캔 결과에 안 나타나면 이탈로 판단) */
    const watchSet = new Set(
      Array.isArray(watchProductIds)
        ? watchProductIds.map((v: unknown) => String(v).trim()).filter(Boolean)
        : [],
    );
    const watched: Array<Record<string, unknown>> = [];

    /* ── 쇼핑 API 스캔 + 검색광고 조회 동시 시작 ──
       키워드도구 조회는 스캔 결과와 무관하므로 미리 던져두고 나중에 기다린다 (0.5~1초 절약).
       withVolume 경로와 withInsight 경로가 같은 호출을 쓰므로 한 번만 실행된다. */
    const adStatsPromise = (withInsight || withVolume) ? fetchAdStats(keyword) : null;

    const found: Array<Record<string, unknown>> = [];
    const top: Array<Record<string, unknown>> = [];
    let counted = 0;
    let catalogCount = 0;
    let scannedItems = 0;
    let total = 0;
    const prices: number[] = [];
    const catCount = new Map<string, number>();
    const mallAgg = new Map<string, { count: number; best: number; sum: number; link: string; points: number }>();

    let scanItems: ShopItem[] = [];
    try {
      const scanRes = await fetchShopItems(keyword, limit, clientId, clientSecret); // 페이지 병렬 수집
      total = scanRes.total;
      scanItems = scanRes.items;
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }

    {
      for (const item of scanItems) {
        scannedItems++;
        // 가격비교(카탈로그)
        if (item.mallName === "네이버") { catalogCount++; continue; }

        counted++;
        if (counted > limit) break;

        const price = Number(item.lprice) || 0;
        if (price > 0) prices.push(price);
        const cat = [item.category3, item.category4].filter(Boolean).join(" > ") ||
                    [item.category1, item.category2].filter(Boolean).join(" > ");
        if (cat) catCount.set(cat, (catCount.get(cat) || 0) + 1);

        if (counted <= 200) { // 노출 분석은 상위 200위(5페이지) 고정 기준
          const agg = mallAgg.get(item.mallName) ?? { count: 0, best: counted, sum: 0, link: item.link, points: 0 };
          agg.count += 1;
          if (counted <= agg.best) { agg.best = counted; agg.link = item.link; }
          agg.sum += price;
          // 순위 가중치: TOP10은 100÷순위로 급격히 차등(1위100·5위20·10위10 — 노출 체감이 큰 첫 페이지를 강하게 반영)
          // 11위부터는 100÷(순위+9)로 완만한 감쇠(11위≈5·40위≈2·200위≈0.5)
          agg.points += counted <= 10 ? 100 / counted : 100 / (counted + 9);
          mallAgg.set(item.mallName, agg);
        }

        if (top.length < 10) {
          top.push({
            rank: counted,
            title: stripTags(item.title),
            price,
            mall: item.mallName,
            image: item.image || "",
            link: item.link,
            productId: item.productId, // 아이템 추적 등록용
          });
        }

        if (store && isExactStore(item.mallName, store)) {
          found.push({
            rank: counted,
            page: Math.ceil(counted / 40),
            title: stripTags(item.title),
            price,
            link: item.link,
            productId: item.productId,
            mallName: item.mallName,
            image: item.image || "",
          });
        }

        if (watchSet.size) {
          // 스마트스토어 링크의 상품번호(/products/{id})와 API productId(네이버쇼핑 ID)가
          // 다른 상품이 있어 둘 다 대조한다. 응답의 productId는 "등록된 코드"로 돌려줘야
          // tracked_items/tracked_item_history와 조인이 맞는다.
          const apiId = String(item.productId).trim();
          const linkId = (String(item.link).match(/\/products\/(\d+)/) || [])[1] || "";
          const matchedCode = watchSet.has(apiId) ? apiId : (linkId && watchSet.has(linkId) ? linkId : "");
          if (matchedCode) {
            watched.push({
              productId: matchedCode,
              rank: counted,
              page: Math.ceil(counted / 40),
              title: stripTags(item.title),
              price,
              mallName: item.mallName,
              image: item.image || "",
              link: item.link,
            });
          }
        }
      }
    }

    /* ── 시장 통계 ── */
    let stats = null;
    if (withInsight) {
      prices.sort((a, b) => a - b);
      const avg = prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : 0;
      const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0];
      stats = {
        totalProducts: total,
        scanned: Math.min(counted, limit),
        catalogRatio: scannedItems ? Math.round(catalogCount / scannedItems * 1000) / 10 : 0, // %
        priceMin: prices[0] || 0,
        priceMax: prices[prices.length - 1] || 0,
        priceAvg: avg,
        topCategory: topCat ? topCat[0] : "",
      };
    }

    /* ── 판매자 점유율 — 상위 200위 고정, 오픈마켓 제외, 전문셀러 기준 비율 ── */
    let sellers = null;
    let sellerMeta = null;
    if (withInsight && counted > 0) {
      const base = Math.min(counted, 200);
      const entries = [...mallAgg.entries()];
      const openCount = entries.filter(([m]) => isOpenMarket(m))
        .reduce((s, [, a]) => s + a.count, 0);
      const specialty = entries.filter(([m]) => !isOpenMarket(m));
      const specialtyTotal = specialty.reduce((s, [, a]) => s + a.count, 0);

      const specialtyPoints = specialty.reduce((s, [, a]) => s + a.points, 0);

      sellers = specialty
        .map(([mall, a]) => ({
          mall,
          count: a.count,
          share: specialtyTotal ? Math.round(a.count / specialtyTotal * 1000) / 10 : 0,       // 노출 점유율 (개수 비중)
          influence: specialtyPoints ? Math.round(a.points / specialtyPoints * 1000) / 10 : 0, // 노출 영향력 (순위 가중 비중)
          bestRank: a.best,
          avgPrice: a.count ? Math.round(a.sum / a.count) : 0,
          link: a.link,
        }))
        .sort((x, y) => y.influence - x.influence || x.bestRank - y.bestRank)
        .slice(0, 12);

      sellerMeta = {
        base,                                                        // 집계 대상 순위 범위
        specialtyTotal,                                              // 전문셀러 상품 수
        openMarketShare: base ? Math.round(openCount / base * 1000) / 10 : 0, // 오픈마켓 비중 %
      };
    }

    /* ── 배치 수집용 경량 검색량 (연관키워드 확장 없이 keywordstool 1콜만) ──
       withInsight는 무겁고(연관키워드별 상품수까지 조회) 배치에는 과함.
       withVolume은 이 키워드 자체의 월간 검색량만 받아 저장한다. */
    let volume = null;
    if (withVolume && !withInsight) {
      try {
        const volRes = await adStatsPromise!; // 스캔과 동시에 시작해둔 조회
        if (volRes.ok && volRes.main) {
          volume = { pc: volRes.main.pc, mobile: volRes.main.mobile, total: volRes.main.total };
          await saveMonthlyVolume(keyword, volRes.main.pc, volRes.main.mobile);
        }
      } catch (_) { /* 검색량 조회 실패는 무시 — 순위 수집은 계속 진행 */ }
    }

    /* ── 검색광고: 검색량 + 연관키워드 + 경쟁강도 ── */
    let ad = null;
    let adError = null;
    if (withInsight) {
      try {
        const adRes = await adStatsPromise!; // 스캔과 동시에 시작해둔 조회
        if (adRes.ok) {
          const volume = adRes.main?.total || 0;
          ad = {
            monthlyPc: adRes.main?.pc ?? null,
            monthlyMobile: adRes.main?.mobile ?? null,
            monthlyTotal: adRes.main ? volume : null,
            // 경쟁강도 = 상품수 ÷ 월간 검색량 (bbdb와 동일 산식)
            compRatio: volume > 0 ? Math.round(total / volume * 1000) / 1000 : null,
            // 아래에서 카테고리 필터·2차 확장으로 재할당되므로 넓은 타입으로 둔다
            related: adRes.related as Array<Record<string, unknown>>,
          };
        } else {
          adError = adRes.reason;
        }
        // 이미 받아온 검색량을 그대로 "이번 달" 스냅샷으로 저장 — 추가 API 호출 없음
        if (adRes.ok && adRes.main) {
          await saveMonthlyVolume(keyword, adRes.main.pc, adRes.main.mobile);
        }
      } catch (e) {
        adError = String(e);
      }

      /* ── 연관키워드 선별 ──
         목적이 "상품명 개선"이므로 검색량 큰 헤드 키워드(단열재, 벽지…)보다
         검색 키워드와 텍스트로 얽힌 롱테일이 훨씬 가치 있다. 3계층 + 확장:
         ① 검색 키워드를 통째로 포함하는 변형 (아이소핑크특호, 접착식단열벽지…)
         ② 검색 키워드의 부분 토큰(2글자 조각)을 포함 + 같은 카테고리 (붙이는벽지, 단열시트…)
            — 시드가 복합어(단열벽지, 스티로폼단열재)면 ①이 거의 없으므로 이 계층이 주력
         ③ 같은 카테고리의 나머지 키워드 (벽지, 실크벽지 같은 헤드)
         ④ 그래도 부족하면 생존 키워드를 힌트로 키워드도구 2차 호출
         ※ 캠핑단열재 같은 초저볼륨 키워드는 키워드도구가 연관을 0개 주므로,
           related가 비어 있어도 이 블록에 들어와 ④ 확장(카테고리명·복합어 분해 힌트)으로 채운다 */
      if (ad) {
        const all = ad.related as Array<Record<string, unknown>>; // 검색량순 전체 후보 (최대 300)
        const seedN = norm(keyword).toUpperCase();
        const refCat = stats && typeof stats.topCategory === "string" ? stats.topCategory : "";
        const prefix = refCat.split(" > ")[0];
        const sameCat = (k: Record<string, unknown>) =>
          !refCat || String(k.category || "").split(" > ")[0] === prefix;
        const catSorted = (arr: Array<Record<string, unknown>>) =>
          arr.sort((a, b) =>
            Number(b.category === refCat) - Number(a.category === refCat) ||
            (Number(b.total) || 0) - (Number(a.total) || 0));

        // 시드의 2글자 조각들 — "단열벽지" → [단열, 열벽, 벽지]. 이 조각을 포함하면 관련 후보로 본다.
        const seedGrams: string[] = [];
        for (let i = 0; i + 2 <= seedN.length; i++) seedGrams.push(seedN.slice(i, i + 2));
        const kwNorm = (k: Record<string, unknown>) => norm(String(k.keyword)).toUpperCase();
        const used = new Set<string>();
        const take = (arr: Array<Record<string, unknown>>) => {
          arr.forEach((k) => used.add(String(k.keyword)));
          return arr;
        };

        // 계층에서 카테고리 불일치로 탈락한 후보 — 이미 상품수까지 조회돼 있으므로
        // "더보기" 영역(카테고리 불문)에 재활용한다. 얻어걸리는 발견용.
        const leftovers: Array<Record<string, unknown>> = [];
        const TARGET_TOTAL = 50; // 화면에는 10개 먼저, 나머지는 더보기로

        // ① 통째 포함 변형 + ② 부분 토큰 후보를 함께 뽑아 한 번에 병렬 조회 (단계 대기 제거)
        const tier1 = take(all.filter((k) => kwNorm(k).includes(seedN)).slice(0, 15));
        const tier2Cands = take(all
          .filter((k) => !used.has(String(k.keyword)) && seedGrams.some((g) => kwNorm(k).includes(g)))
          .slice(0, 30));
        await enrichRelatedKeywords([...tier1, ...tier2Cands], clientId, clientSecret);
        let pool = [...tier1];

        // ② 부분 토큰 포함 + 같은 카테고리
        pool = [...pool, ...catSorted(tier2Cands.filter(sameCat))];
        leftovers.push(...tier2Cands.filter((k) => !sameCat(k)));

        // ③ 같은 카테고리 나머지 (헤드 포함)
        if (pool.length < 15) {
          const cands = take(all.filter((k) => !used.has(String(k.keyword))).slice(0, 20));
          await enrichRelatedKeywords(cands, clientId, clientSecret);
          pool = [...pool, ...catSorted(cands.filter(sameCat))];
          leftovers.push(...cands.filter((k) => !sameCat(k)));
        }

        // ④ 키워드도구 2차 확장 (생존 키워드를 힌트로)
        if (pool.length < 15 && refCat) {
          const seeds = pool.map((k) => String(k.keyword)).slice(0, 5);
          if (!seeds.length) {
            // 생존 키워드가 하나도 없으면(연관 0개인 초저볼륨 키워드) 카테고리명과
            // 복합어 분해 추정(캠핑단열재 → 캠핑+단열재)을 힌트로 사용.
            // 잘못 쪼개진 조각은 키워드도구가 알아서 무시하므로 부담 없다.
            seeds.push(refCat.split(" > ").pop() || "", prefix);
            const raw = norm(keyword);
            for (const cut of [2, 3]) {
              if (raw.length >= cut + 2) seeds.push(raw.slice(0, cut), raw.slice(cut));
            }
          }
          const extraRes = await fetchKeywordstool(seeds);
          if (extraRes.ok) {
            /* 힌트 확장분은 원래 검색어의 연관 목록이 아니라 힌트("캠핑" 등)의 연관 목록이라
               자연휴양림·슬리퍼 같은 무관한 헤드가 잔뜩 섞여 온다. 원래 목록의 "얻어걸리기"와 달리
               여기서는 관련성 검증 필수: 검색어 조각 포함 후보를 우선 조회하고,
               같은 카테고리이거나 검색어 조각을 포함하는 것만 남긴다. */
            const gramHit = (k: Record<string, unknown>) => seedGrams.some((g) => kwNorm(k).includes(g));
            const seen = new Set([seedN, ...all.map(kwNorm)]);
            const extraCands: Array<Record<string, unknown>> = extraRes.list
              .filter((k) => k.keyword && !seen.has(norm(k.keyword).toUpperCase()))
              .sort((a, b) => Number(gramHit(b)) - Number(gramHit(a)) || b.total - a.total)
              .slice(0, 30);
            await enrichRelatedKeywords(extraCands, clientId, clientSecret);
            pool = [...pool, ...catSorted(extraCands.filter(sameCat))];
            leftovers.push(...extraCands.filter((k) => !sameCat(k) && gramHit(k)));
          }
        }

        // ⑤ 더보기 채우기: 카테고리 불문 — 탈락 후보 재활용 + 미확인 후보 추가 조회 (검색량순)
        if (pool.length < TARGET_TOTAL) {
          const restRaw = all.filter((k) => !used.has(String(k.keyword)))
            .slice(0, Math.max(0, TARGET_TOTAL - pool.length - leftovers.length));
          await enrichRelatedKeywords(restRaw, clientId, clientSecret);
          const rest = [...leftovers, ...restRaw]
            .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
          pool = [...pool, ...rest];
        }

        ad.related = pool.length ? pool.slice(0, TARGET_TOTAL) : all.slice(0, 15);
      }
    }

    return json({
      keyword,
      storeName: store,
      maxRank: limit,
      totalResults: total,
      matchCount: found.length,
      results: found,
      top,
      stats,
      sellers,
      sellerMeta,
      ad,
      adError,
      volume,
      watched,
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
