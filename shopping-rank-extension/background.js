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

function kstDateDaysAgo(days) {
  const date = new Date(Date.now() - Math.max(0, Number(days) || 0) * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
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

function productKey(product) {
  const identity = String(product.productCode || product.naverProductId || "").trim();
  if (!identity) return "";
  return `${product.isAd ? "ad" : "prod"}:${identity}`;
}

function matchesStore(product, storeName, knownChannelNos, knownProviderIds, knownProductCodes = new Set()) {
  if (product.isAd) return false;
  if (product.storeMatched) return true;
  if (product.mallName && compact(product.mallName) === compact(storeName)) return true;
  if (product.channelNo && knownChannelNos.has(product.channelNo)) return true;
  if (product.providerId && knownProviderIds.has(product.providerId)) return true;
  const hasCurrentStoreIdentity = !!(product.mallName || product.channelNo || product.providerId);
  if (!hasCurrentStoreIdentity && product.productCode && knownProductCodes.has(String(product.productCode))) return true;
  return false;
}

async function fetchJson(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: sbHeaders() });
  if (!response.ok) throw new Error(`저장 데이터 조회 실패: ${await response.text()}`);
  return response.json();
}

async function fetchCollectionContext(config) {
  const encodedStore = encodeURIComponent(config.storeName);
  const [historyRows, trackedItems] = await Promise.all([
    fetchJson(`/rest/v1/keyword_rank_history?store_name=eq.${encodedStore}&product_code=neq.&select=keyword,product_code,product_name,product_image,product_link,product_price,collected_date,checked_at&order=collected_date.desc,checked_at.desc&limit=10000`),
    fetchJson("/rest/v1/tracked_items?select=product_code,product_name,product_image,product_link,mall_name,keywords&limit=5000"),
  ]);
  const knownProducts = new Map();
  const keywordProducts = new Map();
  const latestDateByKeyword = new Map();
  historyRows.forEach((row) => {
    const code = String(row.product_code || "").trim();
    if (!code) return;
    if (!knownProducts.has(code)) knownProducts.set(code, row);
    if (!latestDateByKeyword.has(row.keyword)) latestDateByKeyword.set(row.keyword, row.collected_date);
    if (row.collected_date !== latestDateByKeyword.get(row.keyword)) return;
    if (!keywordProducts.has(row.keyword)) keywordProducts.set(row.keyword, new Map());
    if (!keywordProducts.get(row.keyword).has(code)) keywordProducts.get(row.keyword).set(code, row);
  });
  return {
    knownProducts,
    keywordProducts,
    trackedItems: trackedItems.map((item) => ({
      ...item,
      product_code: String(item.product_code || "").trim(),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
    })),
  };
}

async function postRows(table, rows, onConflict, chunkSize = 100) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const suffix = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${suffix}`, {
      method: "POST",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
      }),
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`${table} 저장 실패: ${await response.text()}`);
  }
}

async function cleanupOldSnapshots(retentionDays = 8) {
  const cutoff = kstDateDaysAgo(retentionDays);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopping_search_snapshots?collected_date=lt.${encodeURIComponent(cutoff)}`,
    { method: "DELETE", headers: sbHeaders() }
  );
  if (!response.ok) throw new Error(`오래된 검색 스냅샷 정리 실패: ${await response.text()}`);
}

function normalizePageProducts(products, pageIndex) {
  const unique = new Map();
  (products || []).forEach((product) => {
    const key = productKey(product);
    if (!key || unique.has(key)) return;
    unique.set(key, { ...product });
  });
  let organicIndex = 0;
  return [...unique.values()].map((product, index) => {
    if (!product.isAd) organicIndex += 1;
    const extractedRank = Number(product.rank);
    return {
      ...product,
      pageIndex,
      pagePosition: Number(product.pagePosition) || index + 1,
      rank: product.isAd
        ? null
        : (Number.isFinite(extractedRank) && extractedRank > 0
          ? extractedRank
          : (pageIndex - 1) * 40 + organicIndex),
    };
  });
}

function validatePage(products, pageIndex, previousFingerprint) {
  const organic = products.filter((product) => !product.isAd);
  if (pageIndex === 1 && organic.length < 20) {
    throw new Error(`${pageIndex}페이지 일반상품이 ${organic.length}개만 확인되어 저장하지 않았습니다.`);
  }
  const fingerprint = organic.slice(0, 8).map(productKey).join("|");
  if (pageIndex > 1 && fingerprint && fingerprint === previousFingerprint) {
    throw new Error(`${pageIndex}페이지가 이전 페이지와 동일합니다. 페이지 이동 결과를 확인하세요.`);
  }
  return fingerprint;
}

async function saveSearchSnapshot(config, keywordMeta, products, runId, context) {
  const collectedDate = todayKst();
  const now = new Date().toISOString();
  const identity = STORE_IDENTITIES[compact(config.storeName)] || {};
  const knownChannelNos = new Set(identity.channelNos || []);
  const knownProviderIds = new Set(identity.providerIds || []);
  const knownProductCodes = new Set(context.knownProducts.keys());
  const trackedCodes = new Set(context.trackedItems.map((item) => item.product_code));

  products.forEach((product) => {
    if (product.mallName && compact(product.mallName) === compact(config.storeName)) {
      if (product.channelNo) knownChannelNos.add(product.channelNo);
      if (product.providerId) knownProviderIds.add(product.providerId);
    }
  });

  const snapshotByKey = new Map();
  products.forEach((product) => {
    const isTargetStore = matchesStore(
      product, config.storeName, knownChannelNos, knownProviderIds, knownProductCodes
    );
    const row = {
      run_id: runId,
      store_name: config.storeName,
      keyword: keywordMeta.keyword,
      main_keyword: keywordMeta.mainKeyword,
      is_sub: keywordMeta.isSub,
      collected_date: collectedDate,
      collected_at: now,
      page_index: product.pageIndex,
      page_position: product.pagePosition,
      organic_rank: product.rank,
      slot_rank: product.slotRank || null,
      is_ad: !!product.isAd,
      product_key: productKey(product),
      product_code: String(product.productCode || ""),
      naver_product_id: String(product.naverProductId || ""),
      product_name: product.title || "",
      mall_name: product.mallName || "",
      channel_no: product.channelNo || "",
      provider_id: product.providerId || "",
      product_image: product.image || "",
      product_link: product.link || "",
      product_price: Number(product.price) || 0,
      shipping_fee: Number(product.shippingFee) || 0,
      purchase_count: Number(product.purchaseCount) || 0,
      review_count: Number(product.reviewCount) || 0,
      registration_date: product.registrationDate || "",
      brand: product.brand || "",
      maker: product.maker || "",
      category_path: product.categoryPath || "",
      specs: Array.isArray(product.specs) ? product.specs : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      attributes: {},
      is_target_store: isTargetStore,
      is_tracked: !!product.productCode && trackedCodes.has(String(product.productCode)),
      extraction_source: product.extractionSource || "",
    };
    const conflictKey = `${row.is_ad ? "ad" : "prod"}:${row.product_key}`;
    const current = snapshotByKey.get(conflictKey);
    const currentRank = Number(current?.organic_rank) || Number.MAX_SAFE_INTEGER;
    const nextRank = Number(row.organic_rank) || Number.MAX_SAFE_INTEGER;
    const preferred = !current || nextRank < currentRank ? row : current;
    const fallback = preferred === row ? current : row;
    snapshotByKey.set(conflictKey, {
      ...fallback,
      ...preferred,
      product_name: preferred.product_name || fallback?.product_name || "",
      mall_name: preferred.mall_name || fallback?.mall_name || "",
      product_image: preferred.product_image || fallback?.product_image || "",
      product_link: preferred.product_link || fallback?.product_link || "",
      is_target_store: !!(preferred.is_target_store || fallback?.is_target_store),
      is_tracked: !!(preferred.is_tracked || fallback?.is_tracked),
    });
  });
  const snapshotRows = [...snapshotByKey.values()];

  await postRows(
    "shopping_search_snapshots",
    snapshotRows,
    "store_name,keyword,collected_date,is_ad,product_key"
  );
  const cleanupSnapshotUrl = `${SUPABASE_URL}/rest/v1/shopping_search_snapshots` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&run_id=neq.${encodeURIComponent(runId)}`;
  const cleanupSnapshot = await fetch(cleanupSnapshotUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanupSnapshot.ok) throw new Error(`이전 검색 스냅샷 정리 실패: ${await cleanupSnapshot.text()}`);

  const targetProducts = snapshotRows
    .filter((product) => !product.is_ad && product.is_target_store && product.product_code)
    .sort((a, b) => a.organic_rank - b.organic_rank);
  const targetByCode = new Map();
  targetProducts.forEach((product) => {
    if (!targetByCode.has(product.product_code)) targetByCode.set(product.product_code, product);
  });
  const previousKeywordProducts = context.keywordProducts.get(keywordMeta.keyword) || new Map();
  const targetPayload = [...targetByCode.values()].map((product) => ({
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: product.organic_rank,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: product.product_code,
        product_name: product.product_name,
        product_image: product.product_image,
        product_link: product.product_link,
        product_price: product.product_price,
        collected_date: collectedDate,
  }));
  previousKeywordProducts.forEach((previous, code) => {
    if (targetByCode.has(code)) return;
    targetPayload.push({
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: null,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: code,
        product_name: previous.product_name || "",
        product_image: previous.product_image || "",
        product_link: previous.product_link || "",
        product_price: Number(previous.product_price) || 0,
        collected_date: collectedDate,
    });
  });
  if (!targetPayload.length) {
    targetPayload.push({
      store_name: config.storeName, keyword: keywordMeta.keyword,
      main_keyword: keywordMeta.mainKeyword, is_sub: keywordMeta.isSub,
      rank: null, max_rank: config.pageCount * 40, checked_at: now,
      product_code: "", product_name: "", product_image: "", product_link: "",
      product_price: 0, collected_date: collectedDate,
    });
  }
  await postRows(
    "keyword_rank_history",
    targetPayload,
    "store_name,keyword,product_code,collected_date"
  );

  // 같은 날 다시 수집하면 이번 배치에 없는 예전 오탐 행이 남지 않게 정리합니다.
  const cleanupUrl = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&checked_at=neq.${encodeURIComponent(now)}`;
  const cleanup = await fetch(cleanupUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanup.ok) throw new Error(`이전 오탐 행 정리 실패: ${await cleanup.text()}`);
  const trackedPayload = [];
  context.trackedItems.forEach((item) => {
    if (item.keywords.length && !item.keywords.includes(keywordMeta.keyword)) return;
    const found = snapshotRows.find((row) => !row.is_ad && row.product_code === item.product_code);
    if (!found && !item.keywords.includes(keywordMeta.keyword)) return;
    trackedPayload.push({
      product_code: item.product_code,
      keyword: keywordMeta.keyword,
      rank: found?.organic_rank ?? null,
      price: found?.product_price || 0,
      mall_name: found?.mall_name || item.mall_name || "",
      collected_date: collectedDate,
      checked_at: now,
    });
  });
  if (trackedPayload.length) {
    await postRows(
      "tracked_item_history",
      trackedPayload,
      "product_code,keyword,collected_date"
    );
  }
  return { targetCount: targetByCode.size, snapshotCount: snapshotRows.filter((row) => !row.is_ad).length };
}

async function runCollection(config) {
  const runId = crypto.randomUUID();
  const total = config.keywords.length * config.pageCount;
  activeRun = { id: runId, cancelled: false, tabId: null };
  await updateProgress({
    status: "running", title: "수집 중", completed: 0, total, saved: 0,
    message: `선택한 키워드의 네이버 쇼핑 검색결과를 수집할 준비를 하고 있습니다.`, error: "",
  });

  let saved = 0;
  let snapshotSaved = 0;
  let finishedSuccessfully = false;
  try {
    const tab = await chrome.tabs.create({ active: true, url: "about:blank" });
    activeRun.tabId = tab.id;
    let completed = 0;
    const context = await fetchCollectionContext(config);
    await cleanupOldSnapshots();

    for (const keywordMeta of config.keywords) {
      const allProducts = [];
      let previousFingerprint = "";
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
          message: `검색결과 원본을 수집하고 있습니다.`,
          pageIndex,
          pageCount: config.pageCount,
          completed: completed + 1,
          total,
        });
        await sleep(config.pageDelay);
        const result = await extractPage(tab.id, pageIndex, config.storeName);
        if (result.blockedReason) throw new Error(result.blockedReason);
        const pageProducts = normalizePageProducts(result.products, pageIndex).map((product) => ({
          ...product,
          extractionSource: result.extractionSource || "dom",
        }));
        const organicCount = pageProducts.filter((item) => !item.isAd).length;
        previousFingerprint = validatePage(pageProducts, pageIndex, previousFingerprint);
        if (pageIndex > 1 && organicCount === 0) {
          completed += config.pageCount - pageIndex + 1;
          await updateProgress({ completed, message: `${keywordMeta.keyword} 검색결과의 마지막 페이지까지 확인했습니다.` });
          break;
        }
        allProducts.push(...pageProducts);
        completed += 1;
        const sourceLabel = String(result.extractionSource || "dom").includes("next-data")
          ? "NEXT_DATA"
          : "DOM";
        await showCollectionStatus(tab.id, {
          status: "running",
          keyword: keywordMeta.keyword,
          message: `검색결과 원본 누적 ${allProducts.filter((item) => !item.isAd).length}개를 수집했습니다.`,
          source: sourceLabel,
          pageIndex,
          pageCount: config.pageCount,
          completed,
          total,
        });
        await updateProgress({
          completed,
          message: `${keywordMeta.keyword} ${pageIndex}/${config.pageCount}페이지 · ${sourceLabel} 일반상품 ${organicCount}개 · 원본 누적 ${allProducts.filter((item) => !item.isAd).length}개`,
        });
        if (pageIndex > 1 && organicCount < 20) {
          completed += config.pageCount - pageIndex;
          await updateProgress({ completed, message: `${keywordMeta.keyword} 검색결과의 마지막 페이지까지 확인했습니다.` });
          break;
        }
      }
      const result = await saveSearchSnapshot(config, keywordMeta, allProducts, runId, context);
      saved += result.targetCount;
      snapshotSaved += result.snapshotCount;
      await updateProgress({ saved, snapshotSaved });
    }

    await updateProgress({
      status: "done", title: "수집 완료", completed: total, total, saved,
      message: `${config.keywords.length}개 키워드의 검색결과 ${snapshotSaved}개를 저장하고 자사·추적 상품을 분류했습니다.`,
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
