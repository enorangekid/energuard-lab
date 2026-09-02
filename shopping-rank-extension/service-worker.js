importScripts("parser-core.js");

const CONFIG_KEY = "energuardShoppingRankConfig";
const PENDING_KEY = "shoppingRankPendingConfig";
const PROGRESS_KEY = "shoppingRankProgress";
const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const AUTH_KEY = "energuardSupabaseAuthSession";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeAuthSession(raw) {
  if (!raw?.accessToken || !raw?.refreshToken) return null;
  return {
    accessToken: String(raw.accessToken),
    refreshToken: String(raw.refreshToken),
    expiresAt: Number(raw.expiresAt) || 0,
    userId: String(raw.userId || ""),
  };
}

async function saveAuthSession(raw) {
  const session = normalizeAuthSession(raw);
  if (!session) throw new Error("에너가드랩에 다시 로그인해 주세요.");
  await chrome.storage.local.set({ [AUTH_KEY]: session });
  return session;
}

async function getAuthSession() {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  let session = normalizeAuthSession(stored[AUTH_KEY]);
  if (!session) throw new Error("에너가드랩 로그인 정보가 필요합니다.");
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt > now + 90) return session;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    await chrome.storage.local.remove(AUTH_KEY);
    throw new Error("로그인 세션이 만료되었습니다. 에너가드랩에 다시 로그인해 주세요.");
  }
  const refreshed = await response.json();
  session = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || session.refreshToken,
    expiresAt: Number(refreshed.expires_at) || now + Number(refreshed.expires_in || 3600),
    userId: String(refreshed.user?.id || session.userId || ""),
  };
  await chrome.storage.local.set({ [AUTH_KEY]: session });
  return session;
}

async function authenticatedHeaders(extra = {}) {
  const session = await getAuthSession();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.accessToken}`,
    ...extra,
  };
}

// ═══ 단발성 키워드 분석용 빠른 스캔(백그라운드 fetch, 탭 없음) ═══
// background.js(runner.html 안에서 돌던 배치 수집)의 fast-fetch 로직을 그대로 옮겨왔다.
// 키워드 분석은 한두 페이지만 훑고 바로 끝나서, 탭을 열어 화면을 뺏어가는 배치 수집용 UX가
// 필요 없다 — 서비스워커 안에서 조용히 끝내고 결과만 돌려준다(2026-08-06).
const FAST_FETCH_RULE_ID = 90002; // background.js(90001)와 겹치지 않게 별도 id

// background.js와 동일 — 판다랭크 확장프로그램을 직접 압축 해제해서 확인한 결과, User-Agent/
// sec-ch-ua* Client Hints를 실제 브라우저 값 그대로 채워 넣는 게 우리와의 결정적 차이였다
// (2026-08-06). 자세한 이유는 background.js의 buildBrowserHeaderHints 주석 참고.
async function buildBrowserHeaderHints() {
  const ua = navigator.userAgent;
  const uaData = navigator.userAgentData;
  const brands = uaData?.brands ?? [];
  let secChUa = brands.length
    ? brands.map((b) => `"${b.brand}";v="${b.version}"`).join(", ")
    : (() => {
        const m = ua.match(/Chrome\/(\d+)/);
        const v = m ? m[1] : "144";
        return `"Not(A:Brand";v="8", "Chromium";v="${v}", "Google Chrome";v="${v}"`;
      })();
  let arch = '"arm"', bitness = '"64"', formFactors = '"Desktop"', fullVersionList = secChUa,
    model = '""', platformVersion = '"12.5.0"', wow64 = "?0";
  if (uaData) {
    try {
      const h = await uaData.getHighEntropyValues([
        "architecture", "bitness", "formFactors", "fullVersionList", "model", "platformVersion", "wow64",
      ]);
      if (h.fullVersionList?.length) fullVersionList = h.fullVersionList.map((b) => `"${b.brand}";v="${b.version}"`).join(", ");
      if (h.architecture) arch = `"${h.architecture}"`;
      if (h.bitness) bitness = `"${h.bitness}"`;
      if (h.formFactors?.length) formFactors = h.formFactors.map((f) => `"${f}"`).join(", ");
      if (h.model !== undefined) model = `"${h.model}"`;
      if (h.platformVersion) platformVersion = `"${h.platformVersion}"`;
      wow64 = h.wow64 ? "?1" : "?0";
    } catch (_) {}
  }
  let platform;
  if (ua.includes("Windows")) platform = '"Windows"';
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) platform = '"macOS"';
  else if (ua.includes("Linux")) platform = '"Linux"';
  else platform = '"Unknown"';
  const mobile = uaData?.mobile ? "?1" : "?0";
  return {
    ua, secChUa, secChUaArch: arch, secChUaBitness: bitness, secChUaFormFactors: formFactors,
    secChUaFullVersionList: fullVersionList, secChUaModel: model, secChUaPlatformVersion: platformVersion,
    secChUaWow64: wow64, platform, mobile,
  };
}

async function withFastFetchHeaders(referer, fn) {
  const SET = chrome.declarativeNetRequest.HeaderOperation.SET;
  const REMOVE = chrome.declarativeNetRequest.HeaderOperation.REMOVE;
  const hints = await buildBrowserHeaderHints();
  const rule = {
    id: FAST_FETCH_RULE_ID,
    priority: 1,
    condition: {
      urlFilter: "https://search.shopping.naver.com/search/*",
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        chrome.declarativeNetRequest.ResourceType.OTHER,
      ],
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        { header: "accept", operation: SET, value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" },
        { header: "accept-language", operation: SET, value: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7" },
        { header: "cache-control", operation: SET, value: "max-age=0" },
        { header: "priority", operation: SET, value: "u=0, i" },
        { header: "referer", operation: SET, value: referer },
        { header: "sec-ch-ua", operation: SET, value: hints.secChUa },
        { header: "sec-ch-ua-arch", operation: SET, value: hints.secChUaArch },
        { header: "sec-ch-ua-bitness", operation: SET, value: hints.secChUaBitness },
        { header: "sec-ch-ua-form-factors", operation: SET, value: hints.secChUaFormFactors },
        { header: "sec-ch-ua-full-version-list", operation: SET, value: hints.secChUaFullVersionList },
        { header: "sec-ch-ua-mobile", operation: SET, value: hints.mobile },
        { header: "sec-ch-ua-model", operation: SET, value: hints.secChUaModel },
        { header: "sec-ch-ua-platform", operation: SET, value: hints.platform },
        { header: "sec-ch-ua-platform-version", operation: SET, value: hints.secChUaPlatformVersion },
        { header: "sec-ch-ua-wow64", operation: SET, value: hints.secChUaWow64 },
        { header: "sec-fetch-dest", operation: SET, value: "document" },
        { header: "sec-fetch-mode", operation: SET, value: "navigate" },
        { header: "sec-fetch-site", operation: SET, value: "same-origin" },
        { header: "sec-fetch-user", operation: SET, value: "?1" },
        { header: "upgrade-insecure-requests", operation: SET, value: "1" },
        { header: "user-agent", operation: SET, value: hints.ua },
        // background.js와 동일 — 아이템스카우트 확장프로그램 코드에서 확인(2026-08-07).
        { header: "sec-fetch-storage-access", operation: REMOVE },
      ],
    },
  };
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [FAST_FETCH_RULE_ID], addRules: [rule] });
  try {
    return await fn();
  } finally {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [FAST_FETCH_RULE_ID] }).catch(() => {});
  }
}

function extractNextDataFromHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (_) { return null; }
}

function isBlockedHtml(html) {
  return /보안\s*확인을\s*완료|WtmCaptcha|접속이 일시적으로 제한|서비스 이용이 제한/.test(html || "");
}

async function fastFetchSearchPage(keyword, pageIndex) {
  const q = encodeURIComponent(keyword);
  const url = `https://search.shopping.naver.com/search/all?` +
    `query=${q}&pagingIndex=${pageIndex}&pagingSize=40&viewType=list`;
  const referer = `https://search.shopping.naver.com/ns/search?query=${q}`;
  return withFastFetchHeaders(referer, async () => {
    let res;
    try {
      res = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(15000) });
    } catch (error) {
      return { blockedReason: `네트워크 오류: ${error?.message || "알 수 없는 오류"}` };
    }
    if (res.status === 418 || res.status === 403) {
      return { blockedReason: "네이버 쇼핑 접속이 제한되었습니다(캡차)." };
    }
    if (!res.ok) return { blockedReason: `네이버 응답 오류 (${res.status})` };
    const html = await res.text();
    if (isBlockedHtml(html)) return { blockedReason: "네이버 쇼핑 접속이 제한되었습니다(캡차)." };
    const nextData = extractNextDataFromHtml(html);
    if (!nextData) return { blockedReason: "상품 데이터를 찾지 못했습니다(페이지 구조 변경 가능성)." };
    const parsed = RankParser.parseNextDataProducts(nextData, pageIndex);
    if (!parsed.products.length) return { blockedReason: "상품 카드를 찾지 못했습니다." };
    const products = parsed.products.map((p) => {
      if (p.productCode) return p;
      const linkId = (String(p.link || "").match(/\/products\/(\d+)/) || [])[1] || "";
      return linkId ? { ...p, productCode: linkId } : p;
    });
    return { products };
  });
}

async function fastFetchSearchPages(keyword, maxRank) {
  const pageSize = 40;
  const maxPages = Math.max(1, Math.ceil(maxRank / pageSize));
  const allProducts = [];
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    const result = await fastFetchSearchPage(keyword, pageIndex);
    if (result.blockedReason) {
      if (pageIndex === 1) return { blockedReason: result.blockedReason };
      break;
    }
    allProducts.push(...result.products);
    const organicCount = result.products.filter((p) => !p.isAd).length;
    if (organicCount < 20) break;
    if (pageIndex < maxPages) await sleep(400 + Math.random() * 400);
  }
  return { products: allProducts };
}

function cleanKeyword(item) {
  const keyword = String(item?.keyword || "").trim();
  const mainKeyword = String(item?.mainKeyword || keyword).trim() || keyword;
  if (!keyword) return null;
  return { keyword, mainKeyword, isSub: !!item?.isSub };
}

function validateConfig(raw) {
  const storeName = String(raw?.storeName || "").trim();
  const seen = new Set();
  const keywords = (Array.isArray(raw?.keywords) ? raw.keywords : [])
    .map(cleanKeyword)
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.mainKeyword}\n${item.keyword}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!storeName) throw new Error("스토어를 선택하세요.");
  if (!keywords.length) throw new Error("수집할 키워드를 선택하세요.");
  if (keywords.length > 200) throw new Error("한 번에 수집할 수 있는 키워드는 200개까지입니다.");
  const mode = raw?.mode === "analysis" ? "analysis"
    : raw?.mode === "nplusStore" ? "nplusStore"
    : raw?.mode === "nplusAdsOnly" ? "nplusAdsOnly"
    : "batch";
  return {
    storeName,
    keywords,
    pageCount: Math.min(5, Math.max(1, Number(raw?.pageCount) || 5)),
    pageDelay: Math.min(10000, Math.max(1500, Number(raw?.pageDelay) || 1500)),
    mode,
    // N+스토어는 페이지 이동이 아니라 무한스크롤이라 pageCount 개념이 없고, 대신 몇 위까지
    // 볼지(targetRank)만 쓴다 — runNplusStoreCollection(background.js)가 이 필드를 읽는다.
    targetRank: Math.min(1000, Math.max(40, Number(raw?.targetRank) || 200)),
    requestToken: String(raw?.requestToken || ""),
    openReport: raw?.openReport !== false,
  };
}

async function openRunner(config) {
  const current = await chrome.storage.local.get(PROGRESS_KEY);
  const runnerUrl = chrome.runtime.getURL("runner.html");
  const existing = await chrome.tabs.query({ url: `${runnerUrl}*` });
  if (current[PROGRESS_KEY]?.status === "running" && existing[0]) {
    throw new Error("이미 쇼핑 순위를 수집하고 있습니다.");
  }

  const keywordText = config.keywords
    .map((item) => item.isSub ? `${item.mainKeyword} > ${item.keyword}` : item.keyword)
    .join("\n");
  await chrome.storage.local.set({
    [PENDING_KEY]: config,
    [CONFIG_KEY]: {
      storeName: config.storeName,
      keywords: keywordText,
      pageCount: String(config.pageCount),
      pageDelay: String(config.pageDelay),
    },
  });

  if (existing[0]) {
    await chrome.tabs.reload(existing[0].id);
    await chrome.tabs.update(existing[0].id, { active: true });
    return existing[0].id;
  }
  const tab = await chrome.tabs.create({ active: true, url: runnerUrl });
  return tab.id;
}

// 아이템 추적 일괄 수집 전용 — 키워드 선택 UI가 없으니 validateConfig(키워드 필수)를 안 거치고
// 바로 runner.html을 연다. 실제 수집 로직(runTrackedItemsBatchLookup)이 등록된 추적 상품에서
// 알아서 키워드를 모은다.
async function openTrackedItemsRunner(pageDelay) {
  const current = await chrome.storage.local.get(PROGRESS_KEY);
  const runnerUrl = chrome.runtime.getURL("runner.html");
  const existing = await chrome.tabs.query({ url: `${runnerUrl}*` });
  if (current[PROGRESS_KEY]?.status === "running" && existing[0]) {
    throw new Error("이미 수집을 진행하고 있습니다.");
  }
  await chrome.storage.local.set({
    [PENDING_KEY]: {
      mode: "trackedItems",
      pageDelay: Math.min(10000, Math.max(1500, Number(pageDelay) || 1500)),
    },
  });
  if (existing[0]) {
    await chrome.tabs.reload(existing[0].id);
    await chrome.tabs.update(existing[0].id, { active: true });
    return existing[0].id;
  }
  const tab = await chrome.tabs.create({ active: true, url: runnerUrl });
  return tab.id;
}

// 쿠팡 순위 재검색 전용 — 아이템 추적과 마찬가지로 등록 UI가 이 서비스워커 밖(coupang-rank.html)에
// 있으니, 여기서는 재검색할 상품 id 목록만 그대로 PENDING_KEY에 실어서 runner.html을 연다.
async function openCoupangRecheckRunner(itemIds) {
  const current = await chrome.storage.local.get(PROGRESS_KEY);
  const runnerUrl = chrome.runtime.getURL("runner.html");
  const existing = await chrome.tabs.query({ url: `${runnerUrl}*` });
  if (current[PROGRESS_KEY]?.status === "running" && existing[0]) {
    throw new Error("이미 수집을 진행하고 있습니다.");
  }
  await chrome.storage.local.set({
    [PENDING_KEY]: {
      mode: "coupangRecheck",
      itemIds: Array.isArray(itemIds) ? itemIds.map(String).filter(Boolean) : [],
    },
  });
  if (existing[0]) {
    await chrome.tabs.reload(existing[0].id);
    await chrome.tabs.update(existing[0].id, { active: true });
    return existing[0].id;
  }
  const tab = await chrome.tabs.create({ active: true, url: runnerUrl });
  return tab.id;
}

// 네이버 가격비교 검색 페이지에 띄우는 키워드 분석 패널(keyword-insight-panel.js)용 데이터 조회.
// 콘텐츠 스크립트가 직접 fetch하면 네이버 페이지의 CSP에 걸릴 수 있어, 이 서비스워커가 대신
// Supabase를 호출해 결과만 돌려준다(기존 확장프로그램의 다른 Supabase 호출도 전부 이 방식).
async function fetchKeywordInsight(keyword) {
  const headers = await authenticatedHeaders({ "Content-Type": "application/json" });
  const normalized = keyword.replace(/\s+/g, "").toLowerCase();
  // keywordInsight 호출이 내부에서 이번 달 검색량을 keyword_search_volume_monthly에 먼저 저장한
  // 뒤에야 그 값이 존재한다. 두 요청을 Promise.all로 동시에 쏘면, 이번 달 그 키워드를 처음 조회할
  // 때 저장이 끝나기 전에 추이 조회가 먼저 도착해서 방금 만든 값을 자기가 못 보는 경우가 있었다
  // (2026-08-06 실측). 순서를 강제해서 저장이 끝난 뒤에 추이를 읽는다.
  const insightRes = await fetch(`${SUPABASE_URL}/functions/v1/naver-rank`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "keywordInsight", keyword }),
  });
  const trendRes = await fetch(
    `${SUPABASE_URL}/rest/v1/keyword_search_volume_monthly?keyword=eq.${encodeURIComponent(normalized)}` +
    `&select=snapshot_month,total&order=snapshot_month.desc&limit=36`,
    { headers },
  );
  const insight = insightRes.ok ? await insightRes.json() : null;
  const trendRows = trendRes.ok ? await trendRes.json() : [];
  return { insight, trendRows };
}

// ═══ 경쟁사 상품 옵션가 수집 (smartstore-product-collector.js) ═══
// [Supabase 테이블 DDL — 최초 1회 실행]
// -- 원본 그대로 다 쌓아두는 테이블(감사/엑셀 검토용) — 매칭 성공 여부와 무관하게 스캔할
// -- 때마다 전부 기록됨.
// CREATE TABLE IF NOT EXISTS competitor_price_scans (
//   id                bigserial PRIMARY KEY,
//   product_url       text NOT NULL,
//   product_name      text,
//   store_name        text,
//   option_label      text,
//   option_delta      integer,
//   final_price       integer,
//   prev_final_price  integer,  -- 같은 상품+옵션의 직전 스캔 가격(없으면 NULL = 첫 수집)
//   price_diff        integer,  -- final_price - prev_final_price (변동 없으면 0)
//   stock_quantity    integer,
//   sold_out          boolean DEFAULT false,
//   collected_at      timestamptz DEFAULT now()
// );
// ALTER TABLE competitor_price_scans DISABLE ROW LEVEL SECURITY;
// -- 이미 테이블이 있다면(2026-09-02 이전 버전) 이 두 컬럼만 추가:
// -- ALTER TABLE competitor_price_scans ADD COLUMN IF NOT EXISTS prev_final_price integer;
// -- ALTER TABLE competitor_price_scans ADD COLUMN IF NOT EXISTS price_diff integer;
//
// 2026-09-02: 스캔한 상품 URL이 이미 competitor_prices의 comp1_link/comp2_link/comp3_link로
// 등록돼있는 (tab_id, grade_id, thickness) 행이 있으면, 그 두께에 해당하는 옵션 라벨(예:
// "50T")을 찾아 comp{n}_price에 자동 반영한다 — 사용자가 단가표에서 이미 "이 URL = 이 두께"
// 라고 직접 등록해둔 정보를 거꾸로 활용하는 것(관리자 지시). 매칭 안 되는 건 원본만 남기고
// 나중에 엑셀로 검토.
function extractThicknessMm(label) {
  const m = String(label || "").match(/(\d+)\s*T\b/i);
  return m ? Number(m[1]) : null;
}

// 2026-09-02 버그 수정: 두께 하나에 규격(사이즈) 옵션까지 겹쳐 있는 상품(예: 심재준불연
// 비드법 모음전은 같은 URL 안에 900x1800/600x1200 두 규격이 같이 있음)에서, 두께만 보고
// 매칭하면 같은 두께의 두 규격 중 하나가 다른 하나를 덮어써 버리는 문제가 있었다.
// grade_id별로 "이 등급은 어느 규격에 해당하는지" 표를 두고, 후보가 여러 개일 때만 규격으로
// 한 번 더 걸러낸다(후보가 하나뿐인 단일 옵션 등급은 기존처럼 두께만으로 매칭 — 그대로 둠).
// 2026-09-02(2차): 처음엔 "900x1800"/"600x1200" 문자열을 정확히 일치시키려 했는데, 실제
// 경쟁사 상품은 판매자가 규격을 자유 입력하는 옵션값이라 구분자가 x/×/X/* 등 제각각이고
// 스캔해도 여전히 덮어써지는 문제가 계속 나서, 구분자에 상관없이 숫자 두 개(가로x세로)만
// 뽑아서 값 범위로 판정하도록 바꿈(더 관대함).
function sizeCategoryOf(s) {
  const str = String(s || "");
  const m = str.match(/(\d{3,4})\s*[x×X*]\s*(\d{3,4})/);
  if (!m) return null;
  const lo = Math.min(Number(m[1]), Number(m[2]));
  const hi = Math.max(Number(m[1]), Number(m[2]));
  if (lo <= 650 && hi <= 1300) return "small";                                  // 600x1200 근방(비드법 준불연/PF보드 소형)
  if (lo >= 850 && lo <= 950 && hi >= 1700 && hi <= 1900) return "bead_l";       // 900x1800 근방(비드법 준불연 큰 규격)
  return "large";                                                               // 그 외(PF보드 1.2x2, 1x1.2 등) 큰 규격
}
const GRADE_SIZE_CATEGORY = {
  ib_09: "bead_l", ib_06: "small",
  lxo_s: "small", lxo_l: "large", lxi_s: "small", lxi_l: "large",
  kdo_s: "small", kdo_l: "large", kdi_s: "small", kdi_l: "large",
  imo_s: "small", imo_l: "large", imi_s: "small", imi_l: "large",
};
function rowSizeCategory(row) {
  return sizeCategoryOf(row.optionName1) || sizeCategoryOf(row.optionName2) || sizeCategoryOf(row.optionName3);
}

async function saveCompetitorPriceScan(payload) {
  const headers = await authenticatedHeaders({ "Content-Type": "application/json" });
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const productUrl = String(payload?.productUrl || "");
  if (!productUrl || !rows.length) throw new Error("수집된 데이터가 없습니다.");

  // 0) 같은 상품 URL의 "직전" 스캔값을 옵션 라벨별로 하나씩 조회해서 변동을 계산한다.
  // 한 상품에 옵션이 여러 개라 라벨별로 따로 쿼리하지 않고, 최근 것들을 한 번에 받아와
  // JS에서 라벨별 "가장 최근 것" 하나만 골라 쓴다(2026-09-02, 가격 변동 확인 요청 반영).
  const prevRes = await fetch(
    `${SUPABASE_URL}/rest/v1/competitor_price_scans?product_url=eq.${encodeURIComponent(productUrl)}` +
    `&select=option_label,final_price,collected_at&order=collected_at.desc&limit=500`,
    { headers }
  );
  const prevRows = prevRes.ok ? await prevRes.json() : [];
  const latestByLabel = new Map();
  for (const r of prevRows) {
    if (!latestByLabel.has(r.option_label)) latestByLabel.set(r.option_label, r.final_price);
  }

  // 1) 원본 전부 저장(항상) — 이전값/변동폭 같이 기록
  const scanRows = rows.map((r) => {
    const prevPrice = latestByLabel.has(r.label) ? latestByLabel.get(r.label) : null;
    const finalPrice = Number.isFinite(r.finalPrice) ? r.finalPrice : null;
    const priceDiff = (prevPrice != null && finalPrice != null) ? finalPrice - prevPrice : null;
    return {
      product_url: productUrl,
      product_name: payload.productName || null,
      store_name: payload.storeName || null,
      option_label: r.label || null,
      option_delta: Number.isFinite(r.delta) ? r.delta : null,
      final_price: finalPrice,
      prev_final_price: prevPrice,
      price_diff: priceDiff,
      stock_quantity: Number.isFinite(r.stockQuantity) ? r.stockQuantity : null,
      sold_out: !!r.soldOut,
    };
  });
  const scanRes = await fetch(`${SUPABASE_URL}/rest/v1/competitor_price_scans`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(scanRows),
  });
  if (!scanRes.ok) throw new Error(`원본 저장 실패 (${scanRes.status})`);
  const changed = scanRows.filter((r) => r.price_diff);

  // 2) 이미 이 URL을 comp{n}_link로 등록해둔 행 찾기
  const orExpr = [1, 2, 3].map((n) => `comp${n}_link.eq.${encodeURIComponent(productUrl)}`).join(",");
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/competitor_prices?or=(${orExpr})&select=id,grade_id,thickness,comp1_link,comp2_link,comp3_link`,
    { headers }
  );
  const registered = lookupRes.ok ? await lookupRes.json() : [];

  let matched = 0, ambiguous = 0;
  for (const reg of registered) {
    for (const idx of [1, 2, 3]) {
      if (reg[`comp${idx}_link`] !== productUrl) continue;
      const candidates = rows.filter((r) => extractThicknessMm(r.label) === reg.thickness && !r.soldOut);
      let hit = null;
      if (candidates.length <= 1) {
        hit = candidates[0] || null;
      } else {
        // 같은 두께에 규격(사이즈) 옵션이 겹치는 경우 — grade_id로 어느 규격인지 알면 그것만 채택,
        // 모르면 잘못 덮어쓰느니 이번엔 건너뛰고 나중에 엑셀 원본(competitor_price_scans)으로 확인.
        const cat = GRADE_SIZE_CATEGORY[reg.grade_id];
        if (cat) hit = candidates.find((r) => rowSizeCategory(r) === cat) || null;
        if (!hit) { ambiguous++; continue; }
      }
      if (!hit) continue;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/competitor_prices?id=eq.${reg.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ [`comp${idx}_price`]: hit.finalPrice, updated_at: new Date().toISOString() }),
      });
      if (patchRes.ok) matched++;
    }
  }

  return {
    savedRaw: scanRows.length,
    matched,
    ambiguous,
    changes: changed.map((r) => ({ label: r.option_label, prev: r.prev_final_price, curr: r.final_price, diff: r.price_diff })),
  };
}

// ═══ 내 상품 가격 체커 (구 energuard-checker, 2026-09-02 이 확장으로 통합) ═══
// 예전엔 popup.js가 anon key를 수동으로 받아 pricing_costs/product_mapping을 직접
// REST 호출했는데, anon 권한이 잠긴 뒤로 계속 조용히 실패하고 있었다(사용자가 그 이후
// 안 고쳤다고 확인함). 이제 이 확장이 이미 갖고 있는 로그인 세션(authenticatedHeaders)
// 으로 대신 조회한다 — 설정 화면(Supabase URL/Key 입력)도 더 이상 필요 없어졌다.
async function fetchPricingCheckData() {
  const headers = await authenticatedHeaders();
  const [pricingRes, mappingRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/pricing_costs?product_type=eq.all&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/product_mapping?select=*&limit=5000`, { headers }),
  ]);
  if (!pricingRes.ok) throw new Error(`단가 데이터 조회 실패 (${pricingRes.status})`);
  const pricingRows = await pricingRes.json();
  const mappingRows = mappingRes.ok ? await mappingRes.json() : [];
  return {
    pricingData: pricingRows?.[0] || null,
    mappingData: Object.fromEntries((Array.isArray(mappingRows) ? mappingRows : []).map((r) => [r.product_id, r])),
  };
}

// ═══ 경쟁사 가격 수집 이력(팝업에서 최근 스캔 조회용) ═══
async function fetchCompetitorScanHistory(limit = 20) {
  const headers = await authenticatedHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competitor_price_scans?select=product_url,product_name,store_name,option_label,final_price,price_diff,collected_at&order=collected_at.desc&limit=${Math.min(200, Number(limit) || 20)}`,
    { headers }
  );
  if (!res.ok) throw new Error(`수집 이력 조회 실패 (${res.status})`);
  return res.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC_AUTH_SESSION") {
    // 에너가드랩 페이지를 열 때마다 app-bridge.js가 조용히 보내는 세션 동기화(2026-09-02) —
    // 팝업 전용 기능(내 상품 체커/경쟁사 이력)이 에너가드랩 자체 기능을 안 써도 항상 최신
    // 세션을 쓰게 하기 위함.
    saveAuthSession(message.authSession)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message }));
    return true;
  }
  if (message?.type === "FETCH_PRICING_CHECK_DATA") {
    fetchPricingCheckData()
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "조회 실패" }));
    return true;
  }
  if (message?.type === "FETCH_COMPETITOR_SCAN_HISTORY") {
    fetchCompetitorScanHistory(message.limit)
      .then((rows) => sendResponse({ ok: true, rows }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "조회 실패" }));
    return true;
  }
  if (message?.type === "SAVE_COMPETITOR_SCAN") {
    saveCompetitorPriceScan(message.payload)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "저장 실패" }));
    return true;
  }
  if (message?.type === "FETCH_KEYWORD_ANALYSIS") {
    const keyword = String(message.keyword || "").trim();
    const maxRank = Math.min(1000, Math.max(40, Number(message.maxRank) || 200));
    if (!keyword) {
      sendResponse({ ok: false, error: "키워드 없음" });
      return false;
    }
    saveAuthSession(message.authSession)
      .then(() => fastFetchSearchPages(keyword, maxRank))
      .then((result) => {
        if (result.blockedReason) sendResponse({ ok: false, error: result.blockedReason });
        else sendResponse({ ok: true, products: result.products });
      })
      .catch((error) => sendResponse({ ok: false, error: error?.message || "분석 실패" }));
    return true;
  }
  if (message?.type === "FETCH_KEYWORD_INSIGHT") {
    const keyword = String(message.keyword || "").trim();
    if (!keyword) {
      sendResponse({ ok: false, error: "키워드 없음" });
      return false;
    }
    fetchKeywordInsight(keyword)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "조회 실패" }));
    return true;
  }
  if (message?.type === "START_TRACKED_ITEMS_COLLECTION") {
    (async () => {
      try {
        await saveAuthSession(message.authSession);
        const tabId = await openTrackedItemsRunner(message.pageDelay);
        sendResponse({ ok: true, tabId });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "아이템 추적 수집을 시작하지 못했습니다." });
      }
    })();
    return true;
  }
  if (message?.type === "START_COUPANG_RECHECK") {
    (async () => {
      try {
        await saveAuthSession(message.authSession);
        const tabId = await openCoupangRecheckRunner(message.itemIds);
        sendResponse({ ok: true, tabId });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "쿠팡 재검색을 시작하지 못했습니다." });
      }
    })();
    return true;
  }
  if (message?.type !== "START_COLLECTION_FROM_APP") return false;
  (async () => {
    try {
      await saveAuthSession(message.authSession);
      const config = validateConfig(message.config);
      const tabId = await openRunner(config);
      sendResponse({ ok: true, tabId, keywordCount: config.keywords.length });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "수집을 시작하지 못했습니다." });
    }
  })();
  return true;
});
