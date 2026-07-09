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

/* ── 검색광고 키워드도구 조회 ── */
async function fetchAdStats(keyword: string) {
  const customerId = Deno.env.get("NAVER_AD_CUSTOMER_ID");
  const license = Deno.env.get("NAVER_AD_ACCESS_LICENSE");
  const secret = Deno.env.get("NAVER_AD_SECRET_KEY");
  if (!customerId || !license || !secret) {
    return { ok: false, reason: "검색광고 시크릿 미설정" };
  }

  const hint = norm(keyword); // 키워드도구는 공백 미허용
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
    return { ok: false, reason: `검색광고 API ${res.status}: ${(await res.text()).slice(0, 120)}` };
  }

  const data = await res.json();
  const list: Array<Record<string, unknown>> = data.keywordList ?? [];
  const target = norm(keyword).toUpperCase();

  let main: { pc: number; mobile: number; total: number } | null = null;
  const related: Array<{ keyword: string; pc: number; mobile: number; total: number; compIdx: string }> = [];

  for (const k of list) {
    const rel = String(k.relKeyword ?? "");
    const pc = adNum(k.monthlyPcQcCnt);
    const mobile = adNum(k.monthlyMobileQcCnt);
    const item = { keyword: rel, pc, mobile, total: pc + mobile, compIdx: String(k.compIdx ?? "") };
    if (norm(rel).toUpperCase() === target) {
      main = { pc, mobile, total: pc + mobile };
    } else {
      related.push(item);
    }
  }
  related.sort((a, b) => b.total - a.total);

  return { ok: true, main, related: related.slice(0, 15) };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { storeName, keyword, keywords, maxRank = 400, withInsight = true, withVolume = false } = body;

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

    /* ── 쇼핑 API 스캔 ── */
    const found: Array<Record<string, unknown>> = [];
    const top: Array<Record<string, unknown>> = [];
    let counted = 0;
    let catalogCount = 0;
    let scannedItems = 0;
    let total = 0;
    const prices: number[] = [];
    const catCount = new Map<string, number>();
    const mallAgg = new Map<string, { count: number; best: number; sum: number; link: string; points: number }>();

    for (let start = 1; start <= limit; start += 100) {
      const url =
        `https://openapi.naver.com/v1/search/shop.json` +
        `?query=${encodeURIComponent(keyword)}&display=100&start=${start}&sort=sim`;
      const res = await fetch(url, {
        headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      });
      if (!res.ok) {
        return json({ error: `네이버 API 오류 (${res.status})`, detail: await res.text() }, 502);
      }
      const data = await res.json();
      total = data.total ?? 0;
      const items: ShopItem[] = data.items ?? [];

      for (const item of items) {
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
      }
      if (items.length < 100 || counted >= limit) break;
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
        const volRes = await fetchAdStats(keyword);
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
        const adRes = await fetchAdStats(keyword);
        if (adRes.ok) {
          const volume = adRes.main?.total || 0;
          ad = {
            monthlyPc: adRes.main?.pc ?? null,
            monthlyMobile: adRes.main?.mobile ?? null,
            monthlyTotal: adRes.main ? volume : null,
            // 경쟁강도 = 상품수 ÷ 월간 검색량 (bbdb와 동일 산식)
            compRatio: volume > 0 ? Math.round(total / volume * 1000) / 1000 : null,
            related: adRes.related,
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

      // 연관 키워드별 상품수 조회 → 경쟁강도 계산 (키워드당 1콜, 5개씩 병렬)
      if (ad && ad.related.length) {
        const rel = ad.related as Array<Record<string, unknown>>;
        for (let i = 0; i < rel.length; i += 5) {
          await Promise.all(rel.slice(i, i + 5).map(async (k) => {
            try {
              const r = await fetch(
                `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(String(k.keyword))}&display=1`,
                { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
              );
              if (r.ok) {
                const j = await r.json();
                const products = j.total ?? 0;
                k.products = products;
                const vol = Number(k.total) || 0;
                k.compRatio = vol > 0 ? Math.round(products / vol * 1000) / 1000 : null;
              }
            } catch (_) { /* 개별 실패 무시 */ }
          }));
        }
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
