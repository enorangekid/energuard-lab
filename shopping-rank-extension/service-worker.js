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
  return {
    storeName,
    keywords,
    pageCount: Math.min(5, Math.max(1, Number(raw?.pageCount) || 5)),
    pageDelay: Math.min(10000, Math.max(1500, Number(raw?.pageDelay) || 1500)),
    mode: raw?.mode === "analysis" ? "analysis" : "batch",
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
