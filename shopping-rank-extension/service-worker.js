const CONFIG_KEY = "energuardShoppingRankConfig";
const PENDING_KEY = "shoppingRankPendingConfig";
const PROGRESS_KEY = "shoppingRankProgress";

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
