const CONFIG_KEY = "energuardShoppingRankConfig";
const PENDING_KEY = "shoppingRankPendingConfig";
const PROGRESS_KEY = "shoppingRankProgress";
const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";

const sbHeaders = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});

function compactProductName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase("ko-KR");
}

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
  const history = await fetchSupabase(
    `/rest/v1/keyword_rank_history?store_name=eq.${encodedStore}` +
    "&product_code=neq.&select=keyword,main_keyword,is_sub,product_code,product_name,product_image,product_link,product_price,checked_at,collected_date" +
    "&order=checked_at.desc&limit=10000"
  );

  const latestByCode = new Map();
  const latestByName = new Map();
  const latestByCodeKeyword = new Map();
  history.forEach((row) => {
    const code = String(row.product_code || "").trim();
    const name = compactProductName(row.product_name);
    if (code && !latestByCode.has(code)) latestByCode.set(code, row);
    if (name && !latestByName.has(name)) latestByName.set(name, row);
    const pairKey = `${code}\n${row.keyword || ""}`;
    if (code && row.keyword && !latestByCodeKeyword.has(pairKey)) latestByCodeKeyword.set(pairKey, row);
  });

  const now = new Date().toISOString();
  const collectedDate = todayKst();
  const payloadByKey = new Map();
  let unmatched = 0;
  let skipped = 0;

  (Array.isArray(products) ? products : []).forEach((product) => {
    const extractedCode = String(product?.productCode || "").trim();
    const extractedName = compactProductName(product?.productName);
    let known = extractedCode ? latestByCode.get(extractedCode) : null;
    if (!known && extractedName) known = latestByName.get(extractedName);
    if (!known && extractedName.length >= 12) {
      const candidates = [...latestByName.entries()].filter(([name]) =>
        name.length >= 12 && (name.includes(extractedName) || extractedName.includes(name))
      );
      if (candidates.length === 1) known = candidates[0][1];
    }
    if (!known) {
      unmatched += 1;
      return;
    }

    const productCode = String(known.product_code || extractedCode).trim();
    (Array.isArray(product.keywords) ? product.keywords : []).forEach((item) => {
      const keyword = String(item?.keyword || "").trim();
      const rank = Number(item?.rank);
      if (!keyword || !Number.isFinite(rank) || rank < 1) {
        skipped += 1;
        return;
      }
      const previous = latestByCodeKeyword.get(`${productCode}\n${keyword}`);
      const key = `${storeName}\n${keyword}\n${productCode}\n${collectedDate}`;
      payloadByKey.set(key, {
        store_name: storeName,
        keyword,
        main_keyword: previous?.main_keyword || keyword,
        is_sub: previous ? !!previous.is_sub : false,
        rank,
        max_rank: 4000,
        checked_at: now,
        product_code: productCode,
        product_name: known.product_name || product.productName || "",
        product_image: product.productImage || known.product_image || "",
        product_link: known.product_link || "",
        product_price: Number(known.product_price) || 0,
        collected_date: collectedDate,
      });
    });
  });

  const rows = [...payloadByKey.values()];
  if (!rows.length) {
    throw new Error(`저장할 순위를 찾지 못했습니다. 상품 대조 실패 ${unmatched}개 · 순위 미확인 ${skipped}개`);
  }
  for (let index = 0; index < rows.length; index += 100) {
    await postSupabaseRows(
      "keyword_rank_history",
      rows.slice(index, index + 100),
      "store_name,keyword,product_code,collected_date"
    );
  }
  return { saved: rows.length, unmatched, skipped };
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
  const tabs = await chrome.tabs.query({ url: "https://sell.smartstore.naver.com/*" });
  let tab = tabs.find((item) => String(item.url || "").includes("/product/ranking-diagnosis"));

  if (tab) {
    await chrome.tabs.update(tab.id, { active: true, url: rankingUrl });
    await chrome.tabs.reload(tab.id, { bypassCache: false });
  } else {
    tab = await chrome.tabs.create({ active: true, url: rankingUrl });
  }

  try {
    await sleep(1500);
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_SMARTSTORE_IMPORT_STATUS",
      message: "관리자 검색 순위 화면을 읽고 있습니다.",
    }).catch(() => {});
    const extracted = await waitForSmartstoreRanks(tab.id);
    const saved = await saveSmartstoreRanks(storeName, extracted.products);
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_SMARTSTORE_IMPORT_RESULT",
      result: saved,
    }).catch(() => {});
    return saved;
  } catch (error) {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_SMARTSTORE_IMPORT_RESULT",
      result: { error: error?.message || "순위를 가져오지 못했습니다." },
    }).catch(() => {});
    throw error;
  }
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
