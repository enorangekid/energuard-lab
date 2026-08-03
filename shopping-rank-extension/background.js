const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const PROGRESS_KEY = "shoppingRankProgress";
const PENDING_KEY = "shoppingRankPendingConfig";
const STORE_IDENTITIES = {
  ["\uD55C\uAD6D\uB2E8\uC5F4"]: {
    channelNos: ["500128955"],
    providerIds: ["329308"],
  },
};

let activeRun = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N}]/gu, "")
  .toLocaleLowerCase("ko-KR");
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

async function extractPage(tabId, pageIndex, storeName) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE", pageIndex, storeName });
    } catch (error) {
      lastError = error;
      await sleep(700);
    }
  }
  throw new Error(`페이지 수집 스크립트 연결 실패: ${lastError?.message || "알 수 없는 오류"}`);
}

async function showCollectionStatus(tabId, state) {
  if (!tabId) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_COLLECTION_STATUS", state });
      return;
    } catch (_) {
      await sleep(350);
    }
  }
}

function matchesStore(product, storeName, knownChannelNos, knownProviderIds) {
  if (product.isAd) return false;
  if (product.storeMatched) return true;
  if (product.mallName && compact(product.mallName) === compact(storeName)) return true;
  if (product.channelNo && knownChannelNos.has(product.channelNo)) return true;
  if (product.providerId && knownProviderIds.has(product.providerId)) return true;
  return false;
}

async function fetchPreviousProductCount(config, keywordMeta, collectedDate) {
  const url = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&product_code=neq.` +
    `&collected_date=lt.${encodeURIComponent(collectedDate)}` +
    `&select=product_code,collected_date` +
    `&order=collected_date.desc` +
    `&limit=500`;
  const response = await fetch(url, { headers: sbHeaders() });
  if (!response.ok) return 0;
  const rows = await response.json();
  const latestDate = rows[0]?.collected_date;
  if (!latestDate) return 0;
  return new Set(
    rows
      .filter((row) => row.collected_date === latestDate && row.product_code)
      .map((row) => String(row.product_code))
  ).size;
}

async function saveKeywordRows(config, keywordMeta, products) {
  const collectedDate = todayKst();
  const now = new Date().toISOString();
  const unique = new Map();
  products
    .filter((product) => !product.isAd && product.productCode && Number.isFinite(product.rank))
    .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
    .forEach((product) => {
      const canonicalCode = String(product.productCode).trim();
      if (!unique.has(canonicalCode)) unique.set(canonicalCode, { ...product, canonicalCode });
    });

  const previousCount = await fetchPreviousProductCount(config, keywordMeta, collectedDate);
  const minimumSafeCount = previousCount >= 5 ? Math.max(3, Math.ceil(previousCount * 0.6)) : 0;
  if (minimumSafeCount && unique.size < minimumSafeCount) {
    throw new Error(
      `${keywordMeta.keyword} 수집 결과가 비정상적으로 적습니다 ` +
      `(이번 ${unique.size}개 / 이전 ${previousCount}개). 기존 순위는 유지했습니다.`
    );
  }

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
        product_name: product.title || "",
        product_image: product.image || "",
        product_link: product.link || "",
        product_price: product.price || 0,
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
    message: `${config.storeName} 상품을 검색 결과에서 확인할 준비를 하고 있습니다.`, error: "",
  });

  let saved = 0;
  let finishedSuccessfully = false;
  try {
    const tab = await chrome.tabs.create({ active: true, url: "about:blank" });
    activeRun.tabId = tab.id;
    let completed = 0;

    for (const keywordMeta of config.keywords) {
      const found = [];
      const identity = STORE_IDENTITIES[compact(config.storeName)] || {};
      const knownChannelNos = new Set(identity.channelNos || []);
      const knownProviderIds = new Set(identity.providerIds || []);
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
        await showCollectionStatus(tab.id, {
          status: "running",
          keyword: keywordMeta.keyword,
          message: `${config.storeName} 상품을 확인하고 있습니다.`,
          pageIndex,
          pageCount: config.pageCount,
          completed: completed + 1,
          total,
        });
        await sleep(config.pageDelay);
        const result = await extractPage(tab.id, pageIndex, config.storeName);
        if (result.blockedReason) throw new Error(result.blockedReason);
        result.products.forEach((product) => {
          if ((product.storeMatched || compact(product.mallName) === compact(config.storeName)) && product.channelNo) {
            knownChannelNos.add(product.channelNo);
          }
          if ((product.storeMatched || compact(product.mallName) === compact(config.storeName)) && product.providerId) {
            knownProviderIds.add(product.providerId);
          }
        });
        result.products.forEach((product) => {
          if (matchesStore(product, config.storeName, knownChannelNos, knownProviderIds)) found.push(product);
        });
        completed += 1;
        const sourceLabel = String(result.extractionSource || "dom").includes("next-data")
          ? "NEXT_DATA"
          : "DOM";
        await showCollectionStatus(tab.id, {
          status: "running",
          keyword: keywordMeta.keyword,
          message: `${config.storeName} 상품 누적 ${found.length}개 · 일반상품 ${result.products.filter((item) => !item.isAd).length}개`,
          source: sourceLabel,
          pageIndex,
          pageCount: config.pageCount,
          completed,
          total,
        });
        await updateProgress({
          completed,
          message: `${keywordMeta.keyword} ${pageIndex}/${config.pageCount}페이지 · ${sourceLabel} 일반상품 ${result.products.filter((item) => !item.isAd).length}개 · ${config.storeName} 누적 ${found.length}개`,
        });
      }
      saved += await saveKeywordRows(config, keywordMeta, found);
      await updateProgress({ saved });
    }

    await updateProgress({
      status: "done", title: "수집 완료", completed: total, total, saved,
      message: `${config.keywords.length}개 키워드의 일반 검색 순위 저장을 마쳤습니다.`,
    });
    finishedSuccessfully = true;
  } catch (error) {
    const cancelled = /중단/.test(error?.message || "");
    if (activeRun?.tabId) {
      await showCollectionStatus(activeRun.tabId, {
        status: "error",
        keyword: cancelled ? "수집이 중단되었습니다." : "수집 결과를 확인하세요.",
        message: error?.message || "수집 중 오류가 발생했습니다.",
      });
    }
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
