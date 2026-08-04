const CONFIG_KEY = "energuardShoppingRankConfig";
const PENDING_KEY = "shoppingRankPendingConfig";

const $ = (id) => document.getElementById(id);
const fields = {
  storeName: $("storeName"),
  keywords: $("keywords"),
  pageCount: $("pageCount"),
  pageDelay: $("pageDelay"),
};

function parseProductCode(value) {
  const text = String(value || "").trim();
  return text.match(/\/products\/(\d+)/)?.[1] || (/^\d+$/.test(text) ? text : "");
}

async function openRunner(runConfig) {
  await chrome.storage.local.set({ [PENDING_KEY]: runConfig });
  const runnerUrl = chrome.runtime.getURL("runner.html");
  const existing = await chrome.tabs.query({ url: `${runnerUrl}*` });
  if (existing[0]) {
    await chrome.tabs.reload(existing[0].id);
    await chrome.tabs.update(existing[0].id, { active: true });
  } else {
    await chrome.tabs.create({ active: true, url: runnerUrl });
  }
}

function parseKeywords(value) {
  const seen = new Set();
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean);
      const keyword = parts.length > 1 ? parts.at(-1) : parts[0];
      const mainKeyword = parts.length > 1 ? parts[0] : keyword;
      return { keyword, mainKeyword, isSub: parts.length > 1 };
    })
    .filter((item) => {
      const key = `${item.mainKeyword}\n${item.keyword}`;
      if (!item.keyword || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function setRunning(running) {
  $("startButton").disabled = running;
  $("singleLookupButton").disabled = running;
  $("singleProductUrl").disabled = running;
  $("stopButton").hidden = !running;
  $("statusDot").classList.toggle("running", running);
  Object.values(fields).forEach((field) => { field.disabled = running; });
}

$("singleLookupButton").addEventListener("click", async () => {
  const productUrl = $("singleProductUrl").value.trim();
  const productCode = parseProductCode(productUrl);
  if (!productCode) {
    $("notice").className = "notice error";
    $("notice").textContent = "스마트스토어 상품 URL을 확인하세요.";
    return;
  }
  $("notice").className = "notice";
  $("notice").textContent = "등록된 추적 키워드를 찾아 1페이지만 확인합니다.";
  setRunning(true);
  await openRunner({
    mode: "singleProduct",
    targetProductUrl: productUrl,
    targetProductCode: productCode,
    pageCount: 1,
    pageDelay: Number(fields.pageDelay.value) || 2500,
    openReport: false,
  });
});

function renderProgress(state) {
  if (!state) return;
  const running = state.status === "running";
  setRunning(running);
  $("progressBox").hidden = false;
  $("progressTitle").textContent = state.title || (running ? "수집 중" : "수집 완료");
  $("progressCount").textContent = `${state.completed || 0}/${state.total || 0}`;
  const ratio = state.total ? Math.min(100, Math.round((state.completed || 0) / state.total * 100)) : 0;
  $("progressBar").style.width = `${ratio}%`;
  $("progressMessage").textContent = state.message || "";
  $("statusDot").classList.toggle("done", state.status === "done");
  if (state.status === "error") {
    $("notice").className = "notice error";
    $("notice").textContent = state.error || "수집 중 오류가 발생했습니다.";
  } else if (state.status === "done") {
    $("notice").className = "notice success";
    $("notice").textContent = `${state.saved || 0}개 순위 행을 에너가드랩에 저장했습니다.`;
  }
}

async function loadConfig() {
  const stored = await chrome.storage.local.get([CONFIG_KEY, "shoppingRankProgress"]);
  const config = stored[CONFIG_KEY] || {};
  Object.entries(fields).forEach(([key, field]) => {
    if (key === "pageCount") {
      field.value = "5";
    } else if (config[key] != null) {
      field.value = config[key];
    }
  });
  if (stored.shoppingRankProgress) renderProgress(stored.shoppingRankProgress);
}

async function saveConfig() {
  const config = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  return config;
}

$("startButton").addEventListener("click", async () => {
  const config = await saveConfig();
  const keywords = parseKeywords(config.keywords);
  if (!keywords.length) {
    $("notice").className = "notice error";
    $("notice").textContent = "수집할 키워드를 한 개 이상 입력하세요.";
    return;
  }
  $("notice").className = "notice";
  $("notice").textContent = "네이버 쇼핑 탭을 열고 순차 수집을 시작합니다.";
  setRunning(true);
  const runConfig = {
    storeName: config.storeName,
    keywords,
    pageCount: 5,
    pageDelay: Number(config.pageDelay) || 2500,
  };
  await openRunner(runConfig);
});

$("stopButton").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CANCEL_COLLECTION" });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PROGRESS") renderProgress(message.state);
});

loadConfig();
