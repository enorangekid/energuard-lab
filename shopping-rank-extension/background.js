const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const PROGRESS_KEY = "shoppingRankProgress";
const PENDING_KEY = "shoppingRankPendingConfig";

let activeRun = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
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

async function updateProgress(patch) {
  if (!activeRun && patch.status === "running") return;
  const stored = await chrome.storage.local.get(PROGRESS_KEY);
  const state = { ...(stored[PROGRESS_KEY] || {}), ...patch };
  await chrome.storage.local.set({ [PROGRESS_KEY]: state });
  chrome.runtime.sendMessage({ type: "PROGRESS", state }).catch(() => {});
  const title = document.getElementById("runnerTitle");
  const message = document.getElementById("runnerMessage");
  const count = document.getElementById("runnerCount");
  const bar = document.getElementById("runnerBar");
  if (title) title.textContent = state.title || "순위 수집";
  if (message) message.textContent = state.error || state.message || "";
  if (count) count.textContent = `${state.completed || 0}/${state.total || 0}`;
  if (bar) bar.style.width = `${state.total ? Math.min(100, (state.completed || 0) / state.total * 100) : 0}%`;
}

async function fetchJsonRows(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: sbHeaders() });
  if (!response.ok) throw new Error(`상품번호 조회 실패: ${await response.text()}`);
  return response.json();
}

async function fetchKnownProducts(storeName) {
  const products = new Map();

  // 한국 단열 상품 마스터는 company_name이 비어 있는 자사 상품으로 관리됩니다.
  if (compact(storeName) === compact("한국 단열")) {
    const masters = await fetchJsonRows(
      "/rest/v1/product_rankings?select=code,name,image_url,price,alt_codes,company_name&limit=1000"
    );
    masters.filter((row) => !compact(row.company_name)).forEach((row) => {
      const canonicalCode = String(row.code || "").trim();
      if (!canonicalCode) return;
      const metadata = {
        canonicalCode,
        name: row.name || "",
        image: row.image_url || "",
        price: Number(row.price) || 0,
      };
      products.set(canonicalCode, metadata);
      (Array.isArray(row.alt_codes) ? row.alt_codes : []).forEach((alt) => {
        const code = String(alt || "").trim();
        if (code) products.set(code, metadata);
      });
    });
  }

  const trackedItems = await fetchJsonRows(
    `/rest/v1/tracked_items?mall_name=eq.${encodeURIComponent(storeName)}` +
    "&select=product_code,product_name,product_image,alt_codes&limit=1000"
  );
  trackedItems.forEach((row) => {
    const canonicalCode = String(row.product_code || "").trim();
    if (!canonicalCode) return;
    const metadata = products.get(canonicalCode) || {
      canonicalCode,
      name: row.product_name || "",
      image: row.product_image || "",
      price: 0,
    };
    products.set(canonicalCode, metadata);
    (Array.isArray(row.alt_codes) ? row.alt_codes : []).forEach((alt) => {
      const code = String(alt || "").trim();
      if (code) products.set(code, metadata);
    });
  });

  // 키워드/날짜 중복 행 때문에 최근 5,000행만 읽으면 일부 상품이 누락됩니다.
  // 충분한 범위를 페이지로 읽고 상품번호 기준으로 합칩니다.
  for (let offset = 0; offset < 20000; offset += 1000) {
    const rows = await fetchJsonRows(
      `/rest/v1/keyword_rank_history?store_name=eq.${encodeURIComponent(storeName)}` +
      `&select=product_code,product_name,product_image,product_price&order=checked_at.desc&offset=${offset}&limit=1000`
    );
    rows.forEach((row) => {
      const code = String(row.product_code || "").trim();
      if (!code || products.has(code)) return;
      products.set(code, {
        canonicalCode: code,
        name: row.product_name || "",
        image: row.product_image || "",
        price: Number(row.product_price) || 0,
      });
    });
    if (rows.length < 1000) break;
  }
  return products;
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("네이버 쇼핑 페이지 로딩 시간이 초과되었습니다."));
    }, timeoutMs);
    function listener(updatedId, info) {
      if (updatedId !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function extractPage(tabId, pageIndex) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE", pageIndex });
    } catch (error) {
      lastError = error;
      await sleep(700);
    }
  }
  throw new Error(`페이지 수집 스크립트 연결 실패: ${lastError?.message || "알 수 없는 오류"}`);
}

function matchesTarget(product, knownProducts, storeName, knownChannelNos) {
  if (product.isAd) return false;
  if (product.productCode && knownProducts.has(product.productCode)) return true;
  if (product.channelNo && knownChannelNos.has(product.channelNo)) return true;
  const store = compact(storeName);
  return !!store && compact(product.cardText).includes(store);
}

async function saveKeywordRows(config, keywordMeta, products, knownProducts) {
  const collectedDate = todayKst();
  const now = new Date().toISOString();
  const unique = new Map();
  products
    .filter((product) => !product.isAd && product.productCode)
    .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
    .forEach((product) => {
      const master = knownProducts.get(product.productCode);
      const canonicalCode = master?.canonicalCode || product.productCode;
      if (!unique.has(canonicalCode)) unique.set(canonicalCode, { ...product, canonicalCode, master });
    });

  const payload = unique.size
    ? [...unique.values()].map((product) => ({
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: product.rank,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: product.canonicalCode,
        product_name: product.title || product.master?.name || "",
        product_image: product.image || product.master?.image || "",
        product_link: product.link || "",
        product_price: product.price || product.master?.price || 0,
        collected_date: collectedDate,
      }))
    : [{
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: null,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: "",
        product_name: "",
        product_image: "",
        product_link: "",
        product_price: 0,
        collected_date: collectedDate,
      }];

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/keyword_rank_history?on_conflict=store_name,keyword,product_code,collected_date`,
    {
      method: "POST",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) throw new Error(`순위 저장 실패: ${await response.text()}`);

  // 같은 날 다시 수집하면 이번 배치에 없는 예전 오탐 행이 남지 않게 정리합니다.
  const cleanupUrl = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&checked_at=neq.${encodeURIComponent(now)}`;
  const cleanup = await fetch(cleanupUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanup.ok) throw new Error(`이전 오탐 행 정리 실패: ${await cleanup.text()}`);
  return unique.size;
}

async function runCollection(config) {
  const runId = crypto.randomUUID();
  const total = config.keywords.length * config.pageCount;
  activeRun = { id: runId, cancelled: false, tabId: null };
  await updateProgress({
    status: "running", title: "수집 중", completed: 0, total, saved: 0,
    message: "기존 추적 상품번호를 불러오는 중입니다.", error: "",
  });

  let saved = 0;
  let finishedSuccessfully = false;
  try {
    const knownProducts = await fetchKnownProducts(config.storeName);
    config.productCodes.forEach((code) => {
      if (!knownProducts.has(code)) {
        knownProducts.set(code, { canonicalCode: code, name: "", image: "", price: 0 });
      }
    });
    if (!knownProducts.size) {
      throw new Error("저장된 상품번호가 없습니다. 추가 상품번호를 한 개 이상 입력하세요.");
    }

    const tab = await chrome.tabs.create({ active: true, url: "about:blank" });
    activeRun.tabId = tab.id;
    let completed = 0;

    for (const keywordMeta of config.keywords) {
      const found = [];
      const knownChannelNos = new Set();
      for (let pageIndex = 1; pageIndex <= config.pageCount; pageIndex += 1) {
        if (!activeRun || activeRun.id !== runId || activeRun.cancelled) throw new Error("사용자가 수집을 중단했습니다.");
        const url = "https://search.shopping.naver.com/search/all?" + new URLSearchParams({
          query: keywordMeta.keyword,
          pagingIndex: String(pageIndex),
          pagingSize: "40",
          viewType: "list",
        });
        await updateProgress({
          completed,
          message: `“${keywordMeta.keyword}” ${pageIndex}/${config.pageCount}페이지를 확인하고 있습니다.`,
        });
        await chrome.tabs.update(tab.id, { url });
        await waitForTabComplete(tab.id);
        await sleep(config.pageDelay);
        const result = await extractPage(tab.id, pageIndex);
        if (result.blockedReason) throw new Error(result.blockedReason);
        result.products.forEach((product) => {
          const directMatch = product.productCode && knownProducts.has(product.productCode);
          const storeMatch = compact(product.cardText).includes(compact(config.storeName));
          if ((directMatch || storeMatch) && product.channelNo) knownChannelNos.add(product.channelNo);
        });
        result.products.forEach((product) => {
          if (matchesTarget(product, knownProducts, config.storeName, knownChannelNos)) found.push(product);
        });
        completed += 1;
        await updateProgress({ completed });
      }
      saved += await saveKeywordRows(config, keywordMeta, found, knownProducts);
      await updateProgress({ saved });
    }

    await updateProgress({
      status: "done", title: "수집 완료", completed: total, total, saved,
      message: `${config.keywords.length}개 키워드의 일반 검색 순위 저장을 마쳤습니다.`,
    });
    finishedSuccessfully = true;
  } catch (error) {
    const cancelled = /중단/.test(error?.message || "");
    await updateProgress({
      status: cancelled ? "cancelled" : "error",
      title: cancelled ? "수집 중단" : "수집 실패",
      message: error?.message || "수집 중 오류가 발생했습니다.",
      error: cancelled ? "" : (error?.message || "수집 중 오류가 발생했습니다."),
      saved,
    });
  } finally {
    if (finishedSuccessfully && activeRun?.tabId) {
      chrome.tabs.remove(activeRun.tabId).catch(() => {});
    }
    activeRun = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CANCEL_COLLECTION") {
    if (activeRun) activeRun.cancelled = true;
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

document.getElementById("runnerStop")?.addEventListener("click", () => {
  if (activeRun) activeRun.cancelled = true;
});

(async function startPendingCollection() {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const config = stored[PENDING_KEY];
  if (!config) {
    await updateProgress({
      status: "error", title: "수집 설정 없음", error: "확장프로그램 팝업에서 수집을 다시 시작하세요.",
    });
    return;
  }
  await chrome.storage.local.remove(PENDING_KEY);
  await runCollection(config);
})();
