const CONFIG_KEY = "energuardShoppingRankConfig";
const PENDING_KEY = "shoppingRankPendingConfig";
const PROGRESS_KEY = "shoppingRankProgress";
const SMARTSTORE_IMPORT_KEY = "smartstoreRankImportJob";
const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";

const sbHeaders = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});

function todayKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function fetchSupabase(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: sbHeaders() });
  if (!response.ok) throw new Error(`기존 순위 조회 실패: ${await response.text()}`);
  return response.json();
}

async function postSupabaseRows(table, rows, conflictKey) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictKey)}`,
    {
      method: "POST",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
    }
  );
  if (!response.ok) throw new Error(`순위 저장 실패: ${await response.text()}`);
}

async function saveSmartstoreRanks(storeName, products) {
  const encodedStore = encodeURIComponent(storeName);
  // 이 스캔이 직접 넘겨준 productCode(관리자 화면 "채널 상품 번호")를 그대로 신뢰해서 저장한다.
  // 예전엔 기존 keyword_rank_history 이력에 상품명/코드가 매칭이 안 되면(신상품 등) 통째로
  // 스킵했는데, 그러면 실제로 존재하는 데이터가 조용히 사라졌다. 기존 이력은 이제 오직
  // main_keyword/is_sub 분류와 product_link/가격을 물려받는 "보강" 용도로만 쓴다.
  const history = await fetchSupabase(
    `/rest/v1/keyword_rank_history?store_name=eq.${encodedStore}` +
    "&product_code=neq.&select=keyword,main_keyword,is_sub,product_code,product_name,product_link,product_price,checked_at" +
    "&order=checked_at.desc&limit=10000"
  );

  const latestByCodeKeyword = new Map();
  const latestByCode = new Map();
  history.forEach((row) => {
    const code = String(row.product_code || "").trim();
    if (!code) return;
    if (!latestByCode.has(code)) latestByCode.set(code, row);
    const pairKey = `${code}\n${row.keyword || ""}`;
    if (row.keyword && !latestByCodeKeyword.has(pairKey)) latestByCodeKeyword.set(pairKey, row);
  });

  const now = new Date().toISOString();
  const collectedDate = todayKst();
  const payloadByKey = new Map();
  const savedProductCodes = new Set();
  let scannedProducts = 0;
  let noRankProducts = 0;
  let skipped = 0;

  (Array.isArray(products) ? products : []).forEach((product) => {
    const productCode = String(product?.productCode || "").trim();
    if (!productCode) { skipped += 1; return; } // 상품코드가 없으면 이력으로 식별할 방법이 없다
    scannedProducts += 1;

    const linkFallback = latestByCode.get(productCode);
    const productKeywords = Array.isArray(product.keywords) ? product.keywords : [];
    let hasValidRank = false;
    productKeywords.forEach((item) => {
      const keyword = String(item?.keyword || "").trim();
      const rank = Number(item?.rank);
      // 화면 파싱이 "N위" 순위 요약 텍스트를 키워드로 잘못 넘기는 경우를 마지막 방어선에서 걸러낸다.
      if (!keyword || /^[\d,]+\s*위$/.test(keyword) || !Number.isFinite(rank) || rank < 1) {
        skipped += 1;
        return;
      }
      hasValidRank = true;
      savedProductCodes.add(productCode);
      const previous = latestByCodeKeyword.get(`${productCode}\n${keyword}`);
      const key = `${storeName}\n${keyword}\n${productCode}\n${collectedDate}`;
      payloadByKey.set(key, {
        store_name: storeName,
        keyword,
        // 이 키워드가 예전에 큐레이션 트리(메인/보조 직접크롤링)에 이미 있었으면 그 분류를
        // 물려받고, 없으면 자기 자신을 메인으로 하는 독립 키워드로 저장한다.
        main_keyword: previous?.main_keyword || keyword,
        is_sub: previous ? !!previous.is_sub : false,
        rank,
        max_rank: 4000,
        checked_at: now,
        product_code: productCode,
        product_name: product.productName || linkFallback?.product_name || "",
        product_image: product.productImage || "",
        product_link: linkFallback?.product_link || "",
        product_price: Number(linkFallback?.product_price) || 0,
        collected_date: collectedDate,
        source: "naver_diagnosis",
      });
    });
    if (!hasValidRank) noRankProducts += 1;
  });

  const rows = [...payloadByKey.values()];
  if (!rows.length) {
    throw new Error(`저장할 순위를 찾지 못했습니다. 순위 미확인 상품 ${noRankProducts}개 · 스킵 ${skipped}개`);
  }
  for (let index = 0; index < rows.length; index += 100) {
    await postSupabaseRows(
      "keyword_rank_history",
      rows.slice(index, index + 100),
      "store_name,keyword,product_code,collected_date,source"
    );
  }
  return {
    saved: rows.length,
    scannedProducts,
    savedProducts: savedProductCodes.size,
    noRankProducts,
    skipped,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSmartstoreRanks(tabId) {
  let lastError = "상품 목록을 기다리고 있습니다.";
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_SMARTSTORE_RANKS" });
      if (result?.ok && result.products?.length) return result;
      lastError = result?.error || lastError;
    } catch (error) {
      lastError = error?.message || lastError;
    }
    await sleep(1000);
  }
  throw new Error(`검색 순위 진단 화면을 읽지 못했습니다. ${lastError}`);
}

async function runSmartstoreImport(storeName) {
  const rankingUrl = "https://sell.smartstore.naver.com/#/product/ranking-diagnosis";
  await chrome.storage.local.set({
    [SMARTSTORE_IMPORT_KEY]: {
      status: "pending",
      storeName,
      startedAt: Date.now(),
    },
  });
  const tabs = await chrome.tabs.query({ url: "https://sell.smartstore.naver.com/*" });
  let tab = tabs.find((item) => String(item.url || "").includes("/product/ranking-diagnosis"));

  if (tab) {
    await chrome.tabs.update(tab.id, { active: true, url: rankingUrl });
    await chrome.tabs.reload(tab.id, { bypassCache: false });
  } else {
    tab = await chrome.tabs.create({ active: true, url: rankingUrl });
  }

  return { started: true, saved: 0, skipped: 0 };
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
    pageDelay: Math.min(10000, Math.max(1500, Number(raw?.pageDelay) || 2500)),
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_SMARTSTORE_IMPORT") {
    (async () => {
      try {
        const storeName = String(message.storeName || "").trim();
        if (!storeName) throw new Error("스토어를 선택하세요.");
        const result = await runSmartstoreImport(storeName);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "스마트스토어 순위를 가져오지 못했습니다." });
      }
    })();
    return true;
  }
  if (message?.type === "SAVE_SMARTSTORE_RANKS") {
    (async () => {
      try {
        const storeName = String(message.storeName || "").trim();
        if (!storeName) throw new Error("스토어를 선택하세요.");
        const result = await saveSmartstoreRanks(storeName, message.products);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "스마트스토어 순위를 저장하지 못했습니다." });
      }
    })();
    return true;
  }
  if (message?.type !== "START_COLLECTION_FROM_APP") return false;
  (async () => {
    try {
      const config = validateConfig(message.config);
      const tabId = await openRunner(config);
      sendResponse({ ok: true, tabId, keywordCount: config.keywords.length });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "수집을 시작하지 못했습니다." });
    }
  })();
  return true;
});
