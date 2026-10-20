/* ─────────────────────────────────────────
   ENERGUARD LAB — 공통 상단바 (여기 한 곳에서만 수정)
   각 페이지에는 <header class="topbar" data-topbar></header> 셸 한 줄만 두면
   common.js가 메뉴를 채우고, 현재 페이지에 active를 자동 표시합니다.
   <base href="..."> 가 걸린 페이지(utility.html)는 ../ 접두어를 자동 적용합니다.
   ───────────────────────────────────────── */
const TOPBAR_MENU = [
  { label: "랭킹추적",   href: "rank-tracker.html" },
  { label: "키워드분석", href: "naver-rank.html" },
  { label: "블로그분석", href: "blog-rank.html" },
  { label: "매출분석",   href: "sales-analysis.html" },
  { label: "아이템발굴", href: "item-discovery.html" },
  { label: "유틸리티",   href: "utility.html" },
];

function renderTopbarActions(bar) {
  const actions = bar.querySelector(".topbar-actions");
  if (!actions) return;

  actions.removeAttribute("aria-hidden");
  actions.innerHTML = `
    <button type="button" class="topbar-icon-btn" data-history-button aria-label="분석 내역" title="분석 내역">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M13.507 12.324a7 7 0 0 0 .065-8.56A7 7 0 0 0 2 4.393V2H1v3.5l.5.5H5V5H2.811a6.008 6.008 0 1 1-.135 5.77l-.887.462a7 7 0 0 0 11.718 1.092zm-3.361-.97l.708-.707L8 7.792V4H7v4l.146.354 3 3z"></path>
      </svg>
    </button>
    <button type="button" class="topbar-icon-btn" data-logout-button aria-label="로그아웃" title="로그아웃">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 17l5-5-5-5"></path>
        <path d="M15 12H3"></path>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
      </svg>
    </button>`;

  actions.querySelector("[data-logout-button]")?.addEventListener("click", async () => {
    const button = actions.querySelector("[data-logout-button]");
    if (button) button.disabled = true;
    try {
      if (window.energuardAuth?.signOut) {
        await window.energuardAuth.signOut();
        return;
      }
      location.href = "login.html";
    } catch (error) {
      console.error("로그아웃 실패:", error);
      if (button) button.disabled = false;
    }
  });
}

function initTopbar() {
  let bar = document.querySelector("header.topbar[data-topbar]");
  if (!bar) {
    // 아직 구버전(하드코딩) 상단바가 남아 있는 페이지는 건드리지 않음
    if (document.querySelector("header.topbar")) return;
    // 셸조차 없는 페이지에서는 body 맨 앞에 생성
    bar = document.createElement("header");
    bar.className = "topbar";
    bar.setAttribute("data-topbar", "");
    document.body.prepend(bar);
  }

  // <base href="utility/"> 처럼 base가 걸린 페이지는 상위 경로 접두어 필요.
  // 예외 상황에서는 페이지에서 window.TOPBAR_PREFIX 로 직접 지정 가능.
  const path = location.pathname.toLowerCase().replace(/\\/g, "/");
  const prefix = typeof window.TOPBAR_PREFIX === "string"
    ? window.TOPBAR_PREFIX
    : (path.includes("/utility/calc/") ? "../../" : (document.querySelector("base") ? "../" : ""));

  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const activePage = path.includes("/utility/") ? "utility.html" : current;

  // ★ 깜빡임 방지의 핵심: 페이지에 정적 상단바 마크업이 이미 있으면 절대 다시 그리지 않는다.
  //   innerHTML로 재구축하면 첫 페인트(빈 바) → JS 후(내용 등장)의 두 단계가 생겨
  //   페이지를 이동할 때마다 상단바가 깜빡인다. active 표시만 동기화하고 끝낸다.
  if (bar.querySelector(".topbar-inner")) {
    const nav = bar.querySelector(".topbar-nav");
    if (nav && !nav.querySelector('a[href$="blog-rank.html"]')) {
      const keywordLink = nav.querySelector('a[href$="naver-rank.html"]');
      const blogLink = document.createElement("a");
      blogLink.href = `${prefix}blog-rank.html`;
      blogLink.textContent = "블로그분석";
      keywordLink?.after(blogLink);
    }
    bar.querySelectorAll(".topbar-nav a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
      a.classList.toggle("active", href === activePage);
    });
    renderTopbarActions(bar);
    return;
  }

  const navHtml = TOPBAR_MENU.map((item) => {
    if (!item.href) return `<a href="#" class="nav-dummy">${item.label}</a>`;
    const isActive = activePage === item.href.toLowerCase();
    const cls = [item.cls, isActive ? "active" : ""].filter(Boolean).join(" ");
    return `<a href="${prefix}${item.href}"${cls ? ` class="${cls}"` : ""}>${item.label}</a>`;
  }).join("\n      ");

  bar.innerHTML = `
  <div class="topbar-inner">
    <a href="${prefix}index.html" class="topbar-logo"><span>ENERGUARD</span><span>LAB</span></a>
    <nav class="topbar-nav">
      ${navHtml}
    </nav>
    <div class="topbar-actions"></div>
  </div>`;
  renderTopbarActions(bar);
}

/* ─────────────────────────────────────────
   ENERGUARD LAB — 준비 중인 메뉴 안내 (더미 링크 공통 처리)
   ───────────────────────────────────────── */
document.addEventListener("click", (e) => {
  const el = e.target.closest(".nav-dummy");
  if (!el) return;
  e.preventDefault();
  showToast("준비 중인 기능입니다.");
});

const AI_SUPABASE_URL = typeof SUPABASE_URL !== "undefined"
  ? SUPABASE_URL
  : "https://eukwfypbfqojbaihfqye.supabase.co";
const AI_SUPABASE_ANON_KEY = typeof SUPABASE_ANON_KEY !== "undefined"
  ? SUPABASE_ANON_KEY
  : "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const AI_CHAT_URL = AI_SUPABASE_URL + "/functions/v1/gemini-chat";
const AI_INQUIRY_URL = AI_SUPABASE_URL + "/functions/v1/inquiry-assistant";
const AI_CHAT_HISTORY_LIMIT = 12;
let aiWorkChatHistory = [];
let activeInquiryStore = "korean";

// 구글 검색 그라운딩이 얹히면 응답이 오래 걸리거나 서버가 멈춘 것처럼 안 끝날 때가 있었다
// (2026-09-28, 맞춤법 검사가 "검사 중"에서 무한정 멈춤). 서버 쪽은 useSearch:false일 때 검색을
// 아예 끄도록 고쳤고(맞춤법/번역/계산 의도 판별처럼 실시간 정보가 필요 없는 작업에 사용), 여기서는
// 그와 별개로 어떤 경우든 일정 시간 지나면 반드시 에러로 끝나도록 타임아웃을 건다.
// AbortController만으로는 부족하다 — auth-guard.js가 fetch를 가로채 로그인 세션 갱신을
// 먼저 기다리는데, 그 단계에서 멈추면 signal이 아직 실제 네트워크 요청에 붙지도 않은
// 상태라 abort가 의미가 없다. Promise.race로 감싸서 그 경우에도 무조건 시간 내에 끝낸다.
async function fetchAiJson(url, body, { timeoutMs = 25000 } = {}) {
  const controller = new AbortController();
  const request = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + AI_SUPABASE_ANON_KEY,
      "apikey": AI_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then((res) => res.json().then((data) => ({ ok: res.ok, data })));
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error("응답이 너무 오래 걸려 중단했습니다. 잠시 후 다시 시도해 주세요."));
    }, timeoutMs);
  });
  return Promise.race([request, timeout]);
}

async function fetchAiChat(chatHistory, { useSearch, timeoutMs } = {}) {
  return fetchAiJson(AI_CHAT_URL, { chatHistory, useSearch }, { timeoutMs });
}

async function fetchAiInquiry(inquiry, { store, mode, timeoutMs } = {}) {
  return fetchAiJson(AI_INQUIRY_URL, { inquiry, store, mode }, { timeoutMs });
}
// AI 답변 아바타 — 글자 "AI" 대신 로봇 얼굴 아이콘으로 AI다운 느낌을 준다.
const AI_AVATAR_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`;
// FAB 버튼 아이콘 — 패널이 닫혀 있을 땐 채팅 말풍선, 열려 있을 땐 종료(X)로 바뀐다.
const AI_FAB_ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.6 8.6 0 0 1-7.7 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.8 8.6 8.6 0 0 1 4.7-7.7 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"></path><path d="M8.2 11.8h.01"></path><path d="M12 11.8h.01"></path><path d="M15.8 11.8h.01"></path></svg>`;
const AI_FAB_ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
function setAiFabState(isOpen) {
  const btn = document.getElementById("__aiChatFab");
  if (!btn) return;
  btn.innerHTML = isOpen ? AI_FAB_ICON_CLOSE : AI_FAB_ICON_CHAT;
  btn.classList.toggle("is-open", isOpen);
  btn.setAttribute("aria-label", isOpen ? "AI 업무도우미 닫기" : "AI 업무도우미 열기");
}

function initAiChatFab() {
  initAiWorkPanel();
  // 정적 마크업이 있으면 그대로 쓰고(깜빡임 방지) 클릭 동작만 붙인다. 없을 때만 생성(폴백).
  let btn = document.getElementById("__aiChatFab");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "__aiChatFab";
    btn.className = "ai-chat-fab";
    btn.type = "button";
    btn.setAttribute("aria-label", "AI 업무도우미 열기");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.6 8.6 0 0 1-7.7 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.8 8.6 8.6 0 0 1 4.7-7.7 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"></path>
        <path d="M8.2 11.8h.01"></path>
        <path d="M12 11.8h.01"></path>
        <path d="M15.8 11.8h.01"></path>
      </svg>`;
    document.body.appendChild(btn);
  }
  if (!btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", toggleAiWorkPanel);
  }
}

/* ─────────────────────────────────────────
   분석 내역 패널 — 키워드 분석(naver-rank.html) 결과 히스토리를 전 페이지에서 열람.
   상단바 시계 아이콘으로 토글. 항목 클릭 시:
   - 키워드분석 페이지에서는 window.nrRestoreAnalysis 훅으로 즉시 복원 (로딩 없음)
   - 다른 페이지에서는 고유 히스토리 ID와 함께 키워드분석으로 이동해 정확한 결과를 복원
   ───────────────────────────────────────── */
const NR_HISTORY_KEY = "nrAnalysisHistory:v1";
const NR_HISTORY_DB_NAME = "nrAnalysisHistory";
const NR_HISTORY_STORE = "entries";
let nrHistoryDbPromise = null;
let nrHistoryMigrationPromise = null;
let nrHistoryRenderVersion = 0;

function nrHistoryId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nrHistoryOpenDb() {
  if (nrHistoryDbPromise) return nrHistoryDbPromise;
  nrHistoryDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(NR_HISTORY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NR_HISTORY_STORE)) {
        const store = db.createObjectStore(NR_HISTORY_STORE, { keyPath: "id" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("히스토리 저장소를 열 수 없습니다."));
  });
  return nrHistoryDbPromise;
}

async function nrHistoryMigrateLegacy() {
  if (nrHistoryMigrationPromise) return nrHistoryMigrationPromise;
  nrHistoryMigrationPromise = (async () => {
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(NR_HISTORY_KEY) || "[]"); }
    catch (_) { legacy = []; }
    if (!Array.isArray(legacy) || !legacy.length) return;

    const db = await nrHistoryOpenDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NR_HISTORY_STORE, "readwrite");
      const store = tx.objectStore(NR_HISTORY_STORE);
      legacy.forEach(item => store.put({
        ...item,
        id: item.id || nrHistoryId(),
        savedAt: item.savedAt || new Date().toISOString(),
      }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("기존 히스토리 이전에 실패했습니다."));
      tx.onabort = () => reject(tx.error || new Error("기존 히스토리 이전이 중단됐습니다."));
    });
    localStorage.removeItem(NR_HISTORY_KEY);
  })().catch(error => {
    console.warn("분석 히스토리 이전 실패", error);
  });
  return nrHistoryMigrationPromise;
}

async function nrHistoryLoad() {
  try {
    await nrHistoryMigrateLegacy();
    const db = await nrHistoryOpenDb();
    const entries = await new Promise((resolve, reject) => {
      const request = db.transaction(NR_HISTORY_STORE, "readonly").objectStore(NR_HISTORY_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("히스토리를 불러올 수 없습니다."));
    });
    return entries.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  } catch (error) {
    console.warn("분석 히스토리 조회 실패", error);
    return [];
  }
}

async function nrHistoryGet(id) {
  if (!id) return null;
  try {
    await nrHistoryMigrateLegacy();
    const db = await nrHistoryOpenDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(NR_HISTORY_STORE, "readonly").objectStore(NR_HISTORY_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("히스토리를 불러올 수 없습니다."));
    });
  } catch (error) {
    console.warn("분석 히스토리 단건 조회 실패", error);
    return null;
  }
}

function nrEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.nrSaveAnalysis = async function nrSaveAnalysis(entry) {
  if (!entry || !entry.keyword) return;
  const normalized = {
    id: nrHistoryId(),
    keyword: String(entry.keyword || "").trim(),
    store: String(entry.store || "한국 단열").trim(),
    summary: entry.summary || {},
    data: entry.data || null,
    savedAt: new Date().toISOString(),
  };
  if (!normalized.keyword) return;
  try {
    await nrHistoryMigrateLegacy();
    const db = await nrHistoryOpenDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NR_HISTORY_STORE, "readwrite");
      tx.objectStore(NR_HISTORY_STORE).put(normalized);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("히스토리를 저장할 수 없습니다."));
      tx.onabort = () => reject(tx.error || new Error("히스토리 저장이 중단됐습니다."));
    });
    nrHistoryRenderList();
    return normalized;
  } catch (error) {
    console.warn("분석 히스토리 저장 실패", error);
    return null;
  }
};

window.nrLoadAnalysisById = nrHistoryGet;
window.nrFindAnalysis = async function nrFindAnalysis(keyword, store) {
  const entries = await nrHistoryLoad();
  return entries.find(entry =>
    entry.keyword === keyword && (!store || entry.store === store) && entry.data
  ) || null;
};

function nrHistoryToggle(force) {
  const panel = document.getElementById("historyPanel");
  if (!panel) return;
  const open = typeof force === "boolean" ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));
  const btn = document.querySelector('.topbar-actions .topbar-icon-btn[aria-label="분석 내역"]');
  if (btn) btn.classList.toggle("history-on", open);
  if (open) nrHistoryRenderList();
}

async function nrHistoryClear() {
  if (!confirm("분석 내역을 모두 삭제할까요?")) return;
  try {
    const db = await nrHistoryOpenDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NR_HISTORY_STORE, "readwrite");
      tx.objectStore(NR_HISTORY_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("히스토리를 삭제할 수 없습니다."));
    });
  } catch (error) {
    console.warn("분석 히스토리 삭제 실패", error);
  }
  localStorage.removeItem(NR_HISTORY_KEY);
  nrHistoryRenderList();
}

async function nrHistoryRenderList() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const renderVersion = ++nrHistoryRenderVersion;
  const entries = await nrHistoryLoad();
  if (renderVersion !== nrHistoryRenderVersion) return;
  if (!entries.length) {
    list.innerHTML = `<div class="history-empty">아직 분석 내역이 없습니다.<br>키워드분석에서 키워드를 분석하면 자동으로 저장됩니다.</div>`;
    return;
  }
  list.innerHTML = entries.map((e, i) => {
    const d = new Date(e.savedAt);
    const h = d.getHours();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} `
      + `${h >= 12 ? "PM" : "AM"} ${String(h % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    // summary는 저장 시점에 미리 계산됨(신규). 없으면 원본 데이터에서 가능한 것만 표시.
    const s = e.summary || {};
    const best = s.bestRank != null ? s.bestRank : ((e.data && e.data.results || [])[0] || {}).rank;
    const details = [
      { key: "검색량", val: s.volume != null ? Number(s.volume).toLocaleString() : "-" },
      { key: "상품수", val: s.products != null ? Number(s.products).toLocaleString() : "-" },
      { key: "경쟁지수", val: s.compScore != null ? s.compScore + " / 100" : "-" },
      { key: "내 순위", val: best != null ? best + "위" : "이탈" },
    ].map(r => `<div class="detail-row"><span class="detail-key">${r.key}:</span><span class="detail-val">${r.val}</span></div>`).join("");
    return `<div class="history-item" data-index="${i}">
      <div class="history-date">${dateStr}</div>
      <div class="history-calc-name">${nrEsc(e.store)}</div>
      <div class="history-result-label">${nrEsc(e.keyword)}</div>
      <div class="history-detail">${details}</div>
    </div>`;
  }).join("");
  list.querySelectorAll(".history-item").forEach(el => {
    el.addEventListener("click", () => {
      const entry = entries[parseInt(el.dataset.index)];
      if (!entry) return;
      nrHistoryToggle(false);
      if (typeof window.nrRestoreAnalysis === "function") {
        window.nrRestoreAnalysis(entry.keyword, entry.store, entry.data); // 키워드분석 페이지 — 저장 데이터 즉시 복원
        return;
      }
      const prefix = (typeof window.TOPBAR_PREFIX === "string")
        ? window.TOPBAR_PREFIX
        : (document.querySelector("base") ? "../" : "");
      const params = new URLSearchParams({
        restoreHistoryId: entry.id,
        restoreKeyword: entry.keyword,
        restoreStore: entry.store,
      });
      location.href = `${prefix}naver-rank.html?${params.toString()}`;
    });
  });
}

function initHistoryPanel() {
  if (!document.getElementById("historyPanel")) {
    const panel = document.createElement("aside");
    panel.className = "history-panel";
    panel.id = "historyPanel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="history-header">
        <span>키워드 분석 내역</span>
        <button type="button" class="history-clear-btn">전체 삭제</button>
      </div>
      <div class="history-list" id="historyList"></div>`;
    panel.querySelector(".history-clear-btn").addEventListener("click", nrHistoryClear);
    document.body.appendChild(panel);
  }
  const btn = document.querySelector('.topbar-actions [data-history-button]');
  if (btn) {
    const actions = btn.closest(".topbar-actions");
    if (actions) actions.removeAttribute("aria-hidden");
    btn.style.cursor = "pointer";
    btn.addEventListener("click", (e) => { e.stopPropagation(); nrHistoryToggle(); });
  }
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("historyPanel");
    if (!panel || !panel.classList.contains("open")) return;
    if (panel.contains(e.target)) return;
    nrHistoryToggle(false);
  });
}

function initCommonFooter() {
  const footerMarkup = `
    <div class="site-footer-inner">
      <p class="footer-copy">Copyright 2026. Energuard Company. All Rights Reserved.</p>
      <div class="footer-links">
        <a href="#">맨 위로</a>
        <a href="guide.html">사용 가이드 ↗</a>
        <a href="terms.html">이용약관 ↗</a>
        <a href="privacy.html">개인정보처리방침 ↗</a>
      </div>
    </div>`;

  // 정적 푸터가 이미 페이지 HTML에 있으므로(전 페이지 배치 완료) 한 번만 확인한다.
  // 이전의 MutationObserver(body 전체 감시)는 페이지 내 렌더링(카테고리/탭 전환)마다
  // 푸터 검사를 재실행해 깜빡임과 성능 저하를 일으키던 원인이라 제거했다.
  let footer = document.getElementById("__commonFooter");
  const pageFooters = Array.from(document.querySelectorAll(".site-footer"))
    .filter(el => el.id !== "__commonFooter");
  if (!footer && !pageFooters.length) {
    footer = document.createElement("footer");
    footer.id = "__commonFooter";
    footer.className = "site-footer common-site-footer";
    footer.innerHTML = footerMarkup;
    document.body.appendChild(footer);
  }
  pageFooters.forEach(el => {
    if (!el.querySelector(".site-footer-inner")) el.innerHTML = footerMarkup;
  });
  if (footer) footer.hidden = pageFooters.length > 0;
}

/* ─────────────────────────────────────────
   전역 로딩 오버레이 — 모든 페이지의 로딩 표시를 하나로 통일.
   사용법: showLoading("메시지") → 작업 → hideLoading()
   동시에 여러 로딩이 겹칠 수 있으므로(예: 매출분석의 광고+매출 병렬 조회)
   카운터로 관리 — 모든 로딩이 끝나야 오버레이가 사라진다.
   ───────────────────────────────────────── */
let __glCount = 0;

function ensureGlobalLoading() {
  let el = document.getElementById("globalLoading");
  if (!el) {
    el = document.createElement("div");
    el.id = "globalLoading";
    el.innerHTML = `<div class="gl-spinner"></div><div class="gl-msg"></div>`;
    document.body.appendChild(el);
  }
  return el;
}

window.showLoading = function (msg) {
  const el = ensureGlobalLoading();
  __glCount++;
  if (msg != null) el.querySelector(".gl-msg").textContent = msg;
  el.classList.add("on");
};

// 오버레이는 유지한 채 진행 메시지만 갱신 (배치 수집 등 장시간 작업용)
window.setLoadingMessage = function (msg) {
  const el = ensureGlobalLoading();
  el.querySelector(".gl-msg").textContent = msg || "";
};

window.hideLoading = function () {
  __glCount = Math.max(0, __glCount - 1);
  if (__glCount === 0) {
    const el = document.getElementById("globalLoading");
    if (el) {
      el.classList.remove("on");
      el.querySelector(".gl-msg").textContent = "";
    }
  }
};

function bootCommonUi() {
  initTopbar();
  initAiChatFab();
  initHistoryPanel();
  initCommonFooter();
  ensureGlobalLoading();
}

// common.js는 body 끝에서 로드되므로 위쪽 DOM은 이미 전부 존재한다.
// DOMContentLoaded를 기다리면 크롬(상단바 내용·FAB)이 첫 페인트보다 늦게 떠서
// 페이지 이동/새로고침마다 깜빡이므로 즉시 실행한다.
bootCommonUi();

function initAiWorkPanel() {
  if (document.getElementById("__aiWorkPanel")) return;
  const panel = document.createElement("aside");
  panel.id = "__aiWorkPanel";
  panel.className = "ai-work-panel";
  panel.innerHTML = `
    <div class="ai-work-head">
      <div>
        <strong>AI 업무도우미</strong>
        <span>내부 상담/답변 초안 도구</span>
      </div>
    </div>
    <div class="ai-work-tabs" role="tablist">
      <button type="button" class="active" data-ai-tab="chat">업무 질문</button>
      <button type="button" data-ai-tab="inquiry">문의 답변</button>
      <button type="button" data-ai-tab="spellcheck">맞춤법 검사</button>
      <button type="button" data-ai-tab="translate">번역</button>
    </div>
    <section class="ai-work-pane active" data-ai-pane="chat">
      <div class="ai-chat-messages" id="__aiChatMessages">
        <div class="ai-msg ai-msg-bot">
          <div class="ai-msg-avatar">${AI_AVATAR_ICON}</div>
          <div class="ai-msg-bubble">내부 업무용 AI 도우미입니다. 단열재 설명, 고객 응대 문구, 계산 결과 해석처럼 업무에 필요한 내용을 질문해 주세요.</div>
        </div>
      </div>
      <div class="ai-chat-input-row">
        <textarea id="__aiChatInput" rows="1" placeholder="업무 질문을 입력하세요. Enter 전송, Shift+Enter 줄바꿈"></textarea>
        <button type="button" class="ai-send-btn" data-ai-send-chat aria-label="전송">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
        </button>
      </div>
    </section>
    <section class="ai-work-pane" data-ai-pane="inquiry">
      <div class="ai-lang-tabs" id="__aiInquiryStoreTabs">
        <button type="button" class="ai-lang-tab active" data-inquiry-store="korean">한국단열</button>
        <button type="button" class="ai-lang-tab" data-inquiry-store="energuard">에너가드컴퍼니</button>
      </div>
      <textarea id="__aiInquiryInput" class="ai-inquiry-text" placeholder="고객 문의를 붙여넣으세요."></textarea>
      <div class="ai-inquiry-actions">
        <button type="button" class="ai-secondary-btn" data-ai-clear-inquiry>지우기</button>
        <button type="button" class="ai-primary-btn" data-ai-generate-inquiry>답변 생성</button>
      </div>
      <div class="ai-inquiry-result" id="__aiInquiryResult">
        <span>생성된 고객 답변 초안이 여기에 표시됩니다.</span>
      </div>
      <button type="button" class="ai-copy-btn" data-ai-copy-inquiry hidden>답변 복사</button>
    </section>
    <section class="ai-work-pane" data-ai-pane="spellcheck">
      <textarea id="__aiSpellInput" class="ai-inquiry-text" placeholder="맞춤법을 검사할 문장을 입력하세요."></textarea>
      <div class="ai-inquiry-actions">
        <button type="button" class="ai-secondary-btn" data-ai-clear-spell>지우기</button>
        <button type="button" class="ai-primary-btn" data-ai-generate-spell>검사하기</button>
      </div>
      <div class="ai-inquiry-result" id="__aiSpellResult">
        <span>교정된 문장이 여기에 표시됩니다.</span>
      </div>
      <button type="button" class="ai-copy-btn" data-ai-copy-spell hidden>결과 복사</button>
    </section>
    <section class="ai-work-pane" data-ai-pane="translate">
      <div class="ai-lang-tabs" id="__aiLangTabs">
        <button type="button" class="ai-lang-tab active" data-lang="en">영어</button>
        <button type="button" class="ai-lang-tab" data-lang="ja">일본어</button>
        <button type="button" class="ai-lang-tab" data-lang="zh-Hans">중국어(간체)</button>
        <button type="button" class="ai-lang-tab" data-lang="ru">러시아어</button>
      </div>
      <textarea id="__aiTranslateInput" class="ai-inquiry-text" placeholder="번역할 문장을 입력하세요."></textarea>
      <div class="ai-inquiry-actions">
        <button type="button" class="ai-secondary-btn" data-ai-clear-translate>지우기</button>
        <button type="button" class="ai-primary-btn" data-ai-generate-translate>번역하기</button>
      </div>
      <div class="ai-inquiry-result" id="__aiTranslateResult">
        <span>번역 결과가 여기에 표시됩니다.</span>
      </div>
      <button type="button" class="ai-copy-btn" data-ai-copy-translate hidden>결과 복사</button>
    </section>
    `;
  document.body.appendChild(panel);
  bindAiWorkPanel();
}

function bindAiWorkPanel() {
  document.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-ai-tab]");
    if (tab) setAiTab(tab.dataset.aiTab);
    const langTab = e.target.closest("[data-lang]");
    if (langTab) {
      activeTranslateLang = langTab.dataset.lang;
      document.querySelectorAll(".ai-lang-tab").forEach(b => b.classList.toggle("active", b.dataset.lang === activeTranslateLang));
    }
    const storeTab = e.target.closest("[data-inquiry-store]");
    if (storeTab) {
      activeInquiryStore = storeTab.dataset.inquiryStore;
      document.querySelectorAll("#__aiInquiryStoreTabs .ai-lang-tab").forEach(b => b.classList.toggle("active", b.dataset.inquiryStore === activeInquiryStore));
    }
    if (handleAiQtyClick(e)) return;
    if (e.target.closest("[data-ai-send-chat]")) sendAiWorkChat();
    if (e.target.closest("[data-ai-generate-inquiry]")) generateAiInquiryAnswer();
    if (e.target.closest("[data-ai-clear-inquiry]")) clearAiInquiry();
    if (e.target.closest("[data-ai-copy-inquiry]")) copyAiInquiryAnswer();
    if (e.target.closest("[data-ai-generate-spell]")) generateSpellCheck();
    if (e.target.closest("[data-ai-clear-spell]")) clearSpellCheck();
    if (e.target.closest("[data-ai-copy-spell]")) copySpellCheckAnswer();
    if (e.target.closest("[data-ai-generate-translate]")) generateTranslate();
    if (e.target.closest("[data-ai-clear-translate]")) clearTranslate();
    if (e.target.closest("[data-ai-copy-translate]")) copyTranslateAnswer();
  });

  document.addEventListener("keydown", (e) => {
    const chatInput = document.getElementById("__aiChatInput");
    if (e.target === chatInput && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiWorkChat();
    }
    // 수량 계산 입력칸에서 Enter = 그 말풍선의 [다음] 버튼
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("ai-qty-in")) {
      const submit = e.target.closest(".ai-qty-bubble")?.querySelector(".ai-choice-btn.primary");
      if (submit) { e.preventDefault(); submit.click(); }
    }
    if (e.key === "Escape") closeAiWorkPanel();
  });

  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "__aiChatInput") resizeAiTextarea(e.target, 120);
  });
}

function toggleAiWorkPanel() {
  const panel = document.getElementById("__aiWorkPanel");
  if (!panel) return;
  panel.classList.toggle("open");
  setAiFabState(panel.classList.contains("open"));
  if (panel.classList.contains("open")) {
    setTimeout(() => {
      const input = document.getElementById("__aiChatInput");
      if (input && document.querySelector('[data-ai-pane="chat"]').classList.contains("active")) input.focus();
    }, 180);
  }
}

function closeAiWorkPanel() {
  const panel = document.getElementById("__aiWorkPanel");
  if (panel) panel.classList.remove("open");
  setAiFabState(false);
}

function setAiTab(name) {
  document.querySelectorAll("[data-ai-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.aiTab === name));
  document.querySelectorAll("[data-ai-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.aiPane === name));
}

async function sendAiWorkChat() {
  const input = document.getElementById("__aiChatInput");
  const text = input ? input.value.trim() : "";
  if (!text) return;
  input.value = "";
  resizeAiTextarea(input, 120);
  cancelAiQtyFlow(true); // 진행 중이던 수량 계산 버튼은 새 질문을 보내면 닫는다
  appendAiChatMessage("user", text);
  showAiTyping();

  // 판상형 단열재 수량 질문은 AI가 어림짐작하지 않고, 면적·규격·차감·할증률을 버튼으로 확인한 뒤
  // 실제 계산기(calc/insulation-board.html)와 같은 산식으로 계산한다. 수량 질문이 아니면 일반 대화.
  if (await startAiQtyFlow(text)) {
    hideAiTyping();
    return;
  }
  aiWorkChatHistory.push({ role: "user", parts: [{ text }] });
  trimAiWorkChatHistory();

  try {
    const { ok, data } = await fetchAiChat(aiWorkChatHistory.slice(-AI_CHAT_HISTORY_LIMIT));
    hideAiTyping();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!ok || data.error || !aiText) throw new Error(data?.error?.message || data?.error || "응답을 받지 못했습니다.");
    appendAiChatMessage("model", aiText);
    aiWorkChatHistory.push({ role: "model", parts: [{ text: aiText }] });
    trimAiWorkChatHistory();
  } catch (err) {
    hideAiTyping();
    aiWorkChatHistory.pop();
    appendAiChatMessage("model", err.message && err.message.includes("너무 오래") ? err.message : "통신 오류가 발생했습니다. gemini-chat 함수 상태를 확인해 주세요.");
  }
}

// ── 판상형 단열재 수량 계산기 연동 (선택형 대화) ─────────────────────────
// 수량을 묻는 질문이면 calc/insulation-board.js와 같은 산식으로 계산하되, 면적·단열재 규격·차감 면적·
// 할증률을 AI가 어림짐작하지 않고 대화창의 버튼/입력칸으로 하나씩 확인한 뒤 최종 수량을 알려 준다.
// 질문 문장에 이미 들어 있는 값은 다시 묻지 않는다(AI는 문장에서 숫자를 뽑는 데만 쓴다).
const AI_CALC_KEYWORD_RE = /판상형|아이소핑크|비드법|스티로폼|단열재.{0,6}(장|수량)|단열재.{0,10}필요|몇\s*장/;
const AI_QTY_BOARDS = [
  { key: "iso_900", kind: "아이소핑크", w: 900, h: 1800 },
  { key: "iso_600", kind: "아이소핑크", w: 600, h: 900 },
  { key: "st_900", kind: "스티로폼", w: 900, h: 1800 },
  { key: "st_600", kind: "스티로폼", w: 600, h: 900 },
];
let aiQtyFlow = null; // { id, question, data: { area, board, deducts, loss } }
let aiQtySeq = 0;

function qtyToMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === "cm") return v * 10;
  if (unit === "m") return v * 1000;
  return v;
}

function qtyLengthText(mm) {
  if (mm >= 1000 && mm % 100 === 0) return `${mm / 1000}m`;
  return `${Math.round(mm * 10) / 10}mm`;
}

// 질문 문장에서 이미 알려 준 값만 뽑는다. 언급이 없는 항목은 null(= 나중에 버튼으로 물어봄).
async function extractAiQtyHints(question) {
  const prompt = `다음 문장이 "판상형 단열재(아이소핑크, 스티로폼 등) 수량 계산" 요청인지 판단하고, 문장에 직접 적힌 값만 뽑아줘.
아래 JSON 형식으로만 답하고, 그 외의 설명이나 말은 절대 하지 마.

{"match": true 또는 false, "areaM2": 숫자 또는 null, "areaPyeong": 숫자 또는 null, "wallWidthMm": 숫자 또는 null, "wallHeightMm": 숫자 또는 null, "boardWidthMm": 숫자 또는 null, "boardHeightMm": 숫자 또는 null, "lossRate": 숫자 또는 null, "kind": "아이소핑크" 또는 "스티로폼" 또는 null}

- 단열재 수량(몇 장 필요한지)을 묻는 요청이 아니면 {"match": false} 만 답해.
- "헤베", "㎡", "제곱미터", "평방미터", "m2"처럼 면적을 제곱미터로 직접 말했으면 areaM2만 채워.
- 평수(평)만 언급됐으면 areaPyeong만 채워.
- 가로×세로(m, cm, mm 등 길이 두 개)가 따로 언급됐으면 mm로 환산해 wallWidthMm/wallHeightMm를 채워.
- 면적 정보가 없으면 면적 항목은 모두 null.
- 단열재 규격(예: 900x1800)을 직접 말했을 때만 boardWidthMm/boardHeightMm를 채우고, 말하지 않았으면 null. 절대 기본값을 넣지 마.
- 할증률을 직접 말했을 때만 lossRate를 채우고, 아니면 null. 절대 기본값을 넣지 마.
- kind는 문장에 아이소핑크/스티로폼(비드법 포함)이 언급됐을 때만 채워.

문장: "${question}"`;
  try {
    const { data } = await fetchAiChat([{ role: "user", parts: [{ text: prompt }] }], { useSearch: false, timeoutMs: 12000 });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonText = (raw.match(/\{[\s\S]*\}/) || [])[0];
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText);
    return parsed && parsed.match ? parsed : null;
  } catch (err) {
    return null; // 추출 실패 시 조용히 일반 대화로 넘어간다
  }
}

// 수량 질문이면 선택형 대화를 시작하고 true, 아니면 false(일반 대화로 처리).
async function startAiQtyFlow(question) {
  if (!AI_CALC_KEYWORD_RE.test(question)) return false;
  const hints = await extractAiQtyHints(question);
  if (!hints) return false;

  const data = { area: null, board: null, deducts: null, loss: null, kind: hints.kind || null };
  const known = [];
  if (Number(hints.wallWidthMm) > 0 && Number(hints.wallHeightMm) > 0) {
    const areaM2 = (Number(hints.wallWidthMm) * Number(hints.wallHeightMm)) / 1_000_000;
    data.area = { areaMm2: Number(hints.wallWidthMm) * Number(hints.wallHeightMm), label: `${qtyLengthText(Number(hints.wallWidthMm))} × ${qtyLengthText(Number(hints.wallHeightMm))}` };
    known.push(`시공 면적: ${data.area.label} (${areaM2.toFixed(2)}㎡)`);
  } else if (Number(hints.areaM2) > 0) {
    data.area = { areaMm2: Number(hints.areaM2) * 1_000_000, label: `${Number(hints.areaM2)}㎡` };
    known.push(`시공 면적: ${Number(hints.areaM2)}㎡`);
  } else if (Number(hints.areaPyeong) > 0) {
    data.area = { areaMm2: Number(hints.areaPyeong) * 3.30579 * 1_000_000, label: `${Number(hints.areaPyeong)}평` };
    known.push(`시공 면적: ${Number(hints.areaPyeong)}평 (약 ${(Number(hints.areaPyeong) * 3.30579).toFixed(2)}㎡)`);
  }
  if (Number(hints.boardWidthMm) > 0 && Number(hints.boardHeightMm) > 0) {
    data.board = { w: Number(hints.boardWidthMm), h: Number(hints.boardHeightMm), label: `${data.kind || "단열재"} ${Number(hints.boardWidthMm)}×${Number(hints.boardHeightMm)}mm` };
    known.push(`단열재 규격: ${data.board.label}`);
  }
  if (Number.isFinite(Number(hints.lossRate)) && hints.lossRate !== null) {
    data.loss = Number(hints.lossRate);
    known.push(`할증률: ${data.loss}%`);
  }

  aiQtyFlow = { id: "qty" + (++aiQtySeq), question, data };
  if (known.length) {
    appendAiChatMessage("model", "질문에서 확인한 내용이에요.\n" + known.join("\n"), { calc: true });
  } else {
    appendAiChatMessage("model", "수량 계산을 도와드릴게요. 몇 가지만 선택해 주세요.", { calc: true });
  }
  askAiQtyNext();
  return true;
}

function cancelAiQtyFlow(silent) {
  document.querySelectorAll(".ai-qty-bubble:not(.is-locked)").forEach(lockAiQtyBubble);
  const had = !!aiQtyFlow;
  aiQtyFlow = null;
  if (had && !silent) appendAiChatMessage("model", "수량 계산을 취소했어요.");
}

function lockAiQtyBubble(bubble) {
  bubble.classList.add("is-locked");
  bubble.querySelectorAll("button, input, select").forEach(el => { el.disabled = true; });
}

function appendAiQtyBubble(innerHtml) {
  const box = document.getElementById("__aiChatMessages");
  if (!box || !aiQtyFlow) return null;
  const div = document.createElement("div");
  div.className = "ai-msg ai-msg-bot ai-msg-calc";
  div.innerHTML = `<div class="ai-msg-avatar">${AI_AVATAR_ICON}</div><div class="ai-msg-bubble ai-qty-bubble" data-flow="${aiQtyFlow.id}">${innerHtml}<div class="ai-qty-foot"><button type="button" class="ai-qty-cancel" data-qty-act="cancel">취소</button></div></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div.querySelector(".ai-qty-bubble");
}

function setAiQtyBubbleBody(bubble, innerHtml) {
  bubble.innerHTML = `${innerHtml}<div class="ai-qty-foot"><button type="button" class="ai-qty-cancel" data-qty-act="cancel">취소</button></div>`;
  const box = document.getElementById("__aiChatMessages");
  if (box) box.scrollTop = box.scrollHeight;
  const firstInput = bubble.querySelector("input");
  if (firstInput) firstInput.focus();
}

function aiQtyChoiceBtn(label, act, value) {
  return `<button type="button" class="ai-choice-btn" data-qty-act="${act}" data-v="${value}">${escapeAiText(label)}</button>`;
}

function aiQtyLengthRow(prefix, defaultUnit) {
  const unitOptions = ["m", "cm", "mm"].map(u => `<option value="${u}"${u === defaultUnit ? " selected" : ""}>${u}</option>`).join("");
  return `<div class="ai-qty-row">
    <input type="number" class="ai-qty-in" data-role="${prefix}-w" placeholder="가로" min="0" step="any" />
    <select class="ai-qty-unit" data-role="${prefix}-wu">${unitOptions}</select>
    <span class="ai-qty-x">×</span>
    <input type="number" class="ai-qty-in" data-role="${prefix}-h" placeholder="세로" min="0" step="any" />
    <select class="ai-qty-unit" data-role="${prefix}-hu">${unitOptions}</select>
  </div>`;
}

// 아직 모르는 항목 중 첫 번째를 묻는다. 다 알면 결과를 낸다.
function askAiQtyNext() {
  if (!aiQtyFlow) return;
  const d = aiQtyFlow.data;
  if (!d.area) {
    appendAiQtyBubble(`<div class="ai-qty-q">시공할 면적을 어떻게 입력하시겠어요?</div>
      <div class="ai-choice-row">${aiQtyChoiceBtn("가로×세로", "area-mode", "wh")}${aiQtyChoiceBtn("면적(㎡)", "area-mode", "m2")}${aiQtyChoiceBtn("평수", "area-mode", "pyeong")}</div>`);
  } else if (!d.board) {
    const ordered = AI_QTY_BOARDS.slice().sort((a, b) => (b.kind === d.kind) - (a.kind === d.kind));
    appendAiQtyBubble(`<div class="ai-qty-q">단열재 종류와 규격을 선택해 주세요.</div>
      <div class="ai-choice-row">${ordered.map(b => aiQtyChoiceBtn(`${b.kind} ${b.w}×${b.h}`, "board-pick", b.key)).join("")}${aiQtyChoiceBtn("직접 입력", "board-pick", "custom")}</div>`);
  } else if (!d.deducts) {
    appendAiQtyBubble(`<div class="ai-qty-q">창문·문처럼 차감할 면적이 있나요?</div>
      <div class="ai-choice-row">${aiQtyChoiceBtn("없음", "deduct-pick", "no")}${aiQtyChoiceBtn("있음", "deduct-pick", "yes")}</div>`);
  } else if (d.loss === null) {
    appendAiQtyBubble(`<div class="ai-qty-q">할증률(여유분)은 얼마로 할까요?</div>
      <div class="ai-choice-row">${aiQtyChoiceBtn("5% (기본)", "loss-pick", "5")}${aiQtyChoiceBtn("10%", "loss-pick", "10")}${aiQtyChoiceBtn("직접 입력", "loss-pick", "custom")}</div>`);
  } else {
    finishAiQtyFlow();
  }
}

// 사용자가 고른 내용을 오른쪽 말풍선으로 남기고, 지난 질문 말풍선은 잠근 뒤 다음 질문으로 넘어간다.
function answerAiQty(bubble, text) {
  lockAiQtyBubble(bubble);
  appendAiChatMessage("user", text);
  askAiQtyNext();
}

function handleAiQtyClick(e) {
  const btn = e.target.closest("[data-qty-act]");
  if (!btn || btn.disabled) return false;
  const bubble = btn.closest(".ai-qty-bubble");
  if (!bubble || !aiQtyFlow || bubble.dataset.flow !== aiQtyFlow.id) return true;
  const act = btn.dataset.qtyAct;
  const v = btn.dataset.v;
  const d = aiQtyFlow.data;
  const num = role => parseFloat(bubble.querySelector(`[data-role="${role}"]`)?.value);
  const unit = role => bubble.querySelector(`[data-role="${role}"]`)?.value || "m";
  const invalid = msg => { showToast(msg); return true; };

  if (act === "cancel") { cancelAiQtyFlow(false); return true; }

  if (act === "area-mode") {
    if (v === "wh") {
      setAiQtyBubbleBody(bubble, `<div class="ai-qty-q">벽(시공면)의 가로와 세로 길이를 입력해 주세요. 벽이 여러 면이면 추가할 수 있어요.</div>
        <div class="ai-qty-walls">${aiQtyLengthRow("wall0", "m")}</div>
        <div class="ai-choice-row"><button type="button" class="ai-choice-btn ghost" data-qty-act="wall-add">+ 벽 추가</button><button type="button" class="ai-choice-btn primary" data-qty-act="area-wh-submit">다음</button></div>`);
    } else {
      const label = v === "m2" ? "면적(㎡)" : "평수";
      setAiQtyBubbleBody(bubble, `<div class="ai-qty-q">${label}을 입력해 주세요.</div>
        <div class="ai-qty-row"><input type="number" class="ai-qty-in" data-role="area-single" placeholder="${v === "m2" ? "예: 10" : "예: 15"}" min="0" step="any" /><span class="ai-qty-x">${v === "m2" ? "㎡" : "평"}</span></div>
        <div class="ai-choice-row"><button type="button" class="ai-choice-btn primary" data-qty-act="area-single-submit" data-v="${v}">다음</button></div>`);
    }
    return true;
  }
  if (act === "wall-add") {
    const walls = bubble.querySelector(".ai-qty-walls");
    const idx = walls.querySelectorAll(".ai-qty-row").length;
    walls.insertAdjacentHTML("beforeend", aiQtyLengthRow("wall" + idx, "m"));
    return true;
  }
  if (act === "area-wh-submit") {
    let totalMm2 = 0;
    const parts = [];
    const rows = bubble.querySelectorAll(".ai-qty-walls .ai-qty-row");
    for (let i = 0; i < rows.length; i++) {
      const wRaw = num(`wall${i}-w`), hRaw = num(`wall${i}-h`);
      if (!wRaw && !hRaw && rows.length > 1) continue; // 비워 둔 추가 칸은 무시
      const w = qtyToMm(wRaw, unit(`wall${i}-wu`)), h = qtyToMm(hRaw, unit(`wall${i}-hu`));
      if (!(w > 0) || !(h > 0)) return invalid("벽의 가로와 세로를 모두 입력해 주세요.");
      totalMm2 += w * h;
      parts.push(`${qtyLengthText(w)} × ${qtyLengthText(h)}`);
    }
    if (!(totalMm2 > 0)) return invalid("벽의 가로와 세로를 입력해 주세요.");
    d.area = { areaMm2: totalMm2, label: parts.join(" + ") };
    answerAiQty(bubble, `시공 면적: ${d.area.label} (${(totalMm2 / 1_000_000).toFixed(2)}㎡)`);
    return true;
  }
  if (act === "area-single-submit") {
    const value = num("area-single");
    if (!(value > 0)) return invalid("0보다 큰 값을 입력해 주세요.");
    const areaMm2 = (v === "m2" ? value : value * 3.30579) * 1_000_000;
    d.area = { areaMm2, label: v === "m2" ? `${value}㎡` : `${value}평` };
    answerAiQty(bubble, v === "m2" ? `시공 면적: ${value}㎡` : `시공 면적: ${value}평 (약 ${(value * 3.30579).toFixed(2)}㎡)`);
    return true;
  }

  if (act === "board-pick") {
    if (v === "custom") {
      setAiQtyBubbleBody(bubble, `<div class="ai-qty-q">단열재의 가로·세로 규격을 입력해 주세요.</div>
        ${aiQtyLengthRow("board", "mm")}
        <div class="ai-choice-row"><button type="button" class="ai-choice-btn primary" data-qty-act="board-submit">다음</button></div>`);
      return true;
    }
    const b = AI_QTY_BOARDS.find(x => x.key === v);
    if (!b) return true;
    d.board = { w: b.w, h: b.h, label: `${b.kind} ${b.w}×${b.h}mm` };
    answerAiQty(bubble, `단열재: ${d.board.label}`);
    return true;
  }
  if (act === "board-submit") {
    const w = qtyToMm(num("board-w"), unit("board-wu")), h = qtyToMm(num("board-h"), unit("board-hu"));
    if (!(w > 0) || !(h > 0)) return invalid("가로와 세로를 모두 입력해 주세요.");
    d.board = { w, h, label: `${w}×${h}mm` };
    answerAiQty(bubble, `단열재: ${d.board.label}`);
    return true;
  }

  if (act === "deduct-pick") {
    if (v === "no") {
      d.deducts = [];
      answerAiQty(bubble, "차감 면적: 없음");
    } else {
      setAiQtyBubbleBody(bubble, `<div class="ai-qty-q">차감할 창·문의 가로와 세로를 입력해 주세요. 여러 개면 추가할 수 있어요.</div>
        <div class="ai-qty-walls">${aiQtyLengthRow("ded0", "m")}</div>
        <div class="ai-choice-row"><button type="button" class="ai-choice-btn ghost" data-qty-act="ded-add">+ 차감 추가</button><button type="button" class="ai-choice-btn primary" data-qty-act="ded-submit">다음</button></div>`);
    }
    return true;
  }
  if (act === "ded-add") {
    const list = bubble.querySelector(".ai-qty-walls");
    const idx = list.querySelectorAll(".ai-qty-row").length;
    list.insertAdjacentHTML("beforeend", aiQtyLengthRow("ded" + idx, "m"));
    return true;
  }
  if (act === "ded-submit") {
    const items = [];
    const rows = bubble.querySelectorAll(".ai-qty-walls .ai-qty-row");
    for (let i = 0; i < rows.length; i++) {
      const wRaw = num(`ded${i}-w`), hRaw = num(`ded${i}-h`);
      if (!wRaw && !hRaw) continue; // 비워 둔 칸은 무시
      const w = qtyToMm(wRaw, unit(`ded${i}-wu`)), h = qtyToMm(hRaw, unit(`ded${i}-hu`));
      if (!(w > 0) || !(h > 0)) return invalid("차감 면적의 가로와 세로를 모두 입력해 주세요.");
      items.push({ w, h });
    }
    d.deducts = items;
    answerAiQty(bubble, items.length
      ? `차감 면적: ${items.map(x => `${qtyLengthText(x.w)} × ${qtyLengthText(x.h)}`).join(", ")}`
      : "차감 면적: 없음");
    return true;
  }

  if (act === "loss-pick") {
    if (v === "custom") {
      setAiQtyBubbleBody(bubble, `<div class="ai-qty-q">할증률(%)을 입력해 주세요.</div>
        <div class="ai-qty-row"><input type="number" class="ai-qty-in" data-role="loss" placeholder="예: 7" min="0" step="any" /><span class="ai-qty-x">%</span></div>
        <div class="ai-choice-row"><button type="button" class="ai-choice-btn primary" data-qty-act="loss-submit">계산하기</button></div>`);
      return true;
    }
    d.loss = Number(v);
    answerAiQty(bubble, `할증률: ${d.loss}%`);
    return true;
  }
  if (act === "loss-submit") {
    const value = num("loss");
    if (!(value >= 0)) return invalid("0 이상의 값을 입력해 주세요.");
    d.loss = value;
    answerAiQty(bubble, `할증률: ${value}%`);
    return true;
  }
  return true;
}

// 계산기(calc/insulation-board.js)와 같은 순서·산식으로 최종 수량을 낸다.
function finishAiQtyFlow() {
  const flow = aiQtyFlow;
  if (!flow) return;
  const { area, board, deducts, loss } = flow.data;
  const deductMm2 = deducts.reduce((sum, x) => sum + x.w * x.h, 0);
  const netMm2 = Math.max(0, area.areaMm2 - deductMm2);
  const netM2 = netMm2 / 1_000_000;
  const boardM2 = (board.w * board.h) / 1_000_000;
  aiQtyFlow = null;

  let answer;
  if (!(netM2 > 0)) {
    answer = "차감 면적이 시공 면적보다 크거나 같아서 계산할 수 없어요. 입력한 값을 다시 확인해 주세요.";
  } else {
    const baseCount = netM2 / boardM2;
    const finalCount = Math.ceil(baseCount * (1 + loss / 100));
    const extra = Math.max(0, finalCount - Math.ceil(baseCount));
    const round2 = n => (Math.round(n * 100) / 100).toFixed(2);
    answer = [
      `시공 면적: ${round2(area.areaMm2 / 1_000_000)}㎡ (${area.label})`,
      deducts.length ? `차감 면적: ${round2(deductMm2 / 1_000_000)}㎡ (${deducts.map(x => `${qtyLengthText(x.w)} × ${qtyLengthText(x.h)}`).join(", ")})` : "차감 면적: 없음",
      `순 면적: ${round2(netM2)}㎡`,
      `단열재: ${board.label} (1장 ${round2(boardM2)}㎡)`,
      `할증률: ${loss}%`,
      "",
      `필요 수량: 총 ${finalCount}장 (여유분 ${extra}장 포함)`,
      "",
      "※ 현장 여건에 따라 실제 수량은 달라질 수 있습니다.",
    ].join("\n");
  }
  appendAiChatMessage("model", answer, { calc: true });
  aiWorkChatHistory.push({ role: "user", parts: [{ text: flow.question }] });
  aiWorkChatHistory.push({ role: "model", parts: [{ text: answer }] });
  trimAiWorkChatHistory();
}

// ── 맞춤법 검사 탭 ──────────────────────────────────────────────
let aiSpellReqId = 0;
async function generateSpellCheck() {
  const input = document.getElementById("__aiSpellInput");
  const result = document.getElementById("__aiSpellResult");
  const copyBtn = document.querySelector("[data-ai-copy-spell]");
  const text = input ? input.value.trim() : "";
  if (!text) {
    showToast("검사할 문장을 입력해 주세요.");
    return;
  }
  const reqId = ++aiSpellReqId;
  result.innerHTML = `<div class="ai-result-loading">맞춤법 검사 중...</div>`;
  copyBtn.hidden = true;

  const prompt = `다음 문장의 맞춤법과 띄어쓰기를 교정해줘. 원래 의미와 말투(존댓말/반말 등)는 최대한 그대로 유지하고,
설명이나 부가 설명 없이 교정된 문장만 답해. 이미 맞으면 원문 그대로 답해.

문장: "${text}"`;

  try {
    const { ok, data } = await fetchAiChat([{ role: "user", parts: [{ text: prompt }] }], { useSearch: false });
    if (reqId !== aiSpellReqId) return;
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!ok || data.error || !answer) throw new Error(data?.error?.message || data?.error || "응답을 받지 못했습니다.");
    const cleaned = answer.trim().replace(/^["'“”]|["'“”]$/g, "");
    result.dataset.answer = cleaned;
    result.innerHTML = renderSpellCheckDiff(text, cleaned);
    copyBtn.hidden = false;
  } catch (err) {
    if (reqId !== aiSpellReqId) return;
    result.dataset.answer = "";
    result.innerHTML = `<span>맞춤법 검사 중 오류가 발생했습니다: ${escapeAiText(err.message || "오류")}</span>`;
  }
}

// 원문과 교정문을 문자 단위로 비교해서, 고쳐진 부분만 강조 표시한다(띄어쓰기 변경도 잡아내야 해서
// 단어 단위가 아니라 문자 단위 LCS 기반 diff를 쓴다).
function diffChars(oldStr, newStr) {
  const a = Array.from(oldStr);
  const b = Array.from(newStr);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = []; // 교정문(b) 기준으로 same/changed만 기록 — 삭제된 원문 글자는 결과에 안 보이므로 생략
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ ch: b[j], type: "same" });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      ops.push({ ch: b[j], type: "changed" });
      j++;
    }
  }
  while (j < m) { ops.push({ ch: b[j], type: "changed" }); j++; }
  return ops;
}

function renderSpellCheckDiff(original, corrected) {
  const ops = diffChars(original, corrected);
  const runs = [];
  for (const op of ops) {
    const last = runs[runs.length - 1];
    if (last && last.type === op.type) last.text += op.ch;
    else runs.push({ type: op.type, text: op.ch });
  }
  const hasChange = runs.some(run => run.type === "changed");
  const body = runs.map(run => {
    const escaped = escapeAiText(run.text).replace(/\n/g, "<br>");
    return run.type === "changed" ? `<mark class="ai-diff-fix">${escaped}</mark>` : escaped;
  }).join("");
  const tag = hasChange
    ? `<span class="ai-msg-tag ai-msg-tag-fix">✏️ 수정된 부분이 강조 표시됩니다</span>`
    : `<span class="ai-msg-tag">✅ 수정할 부분이 없습니다</span>`;
  return tag + body;
}

function clearSpellCheck() {
  aiSpellReqId++; // 진행 중이던 요청의 응답이 와도 무시되게
  const input = document.getElementById("__aiSpellInput");
  const result = document.getElementById("__aiSpellResult");
  const copyBtn = document.querySelector("[data-ai-copy-spell]");
  if (input) input.value = "";
  if (result) {
    result.dataset.answer = "";
    result.innerHTML = "<span>교정된 문장이 여기에 표시됩니다.</span>";
  }
  if (copyBtn) copyBtn.hidden = true;
}

function copySpellCheckAnswer() {
  const result = document.getElementById("__aiSpellResult");
  const text = result?.dataset.answer || result?.textContent || "";
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => showToast("교정된 문장을 복사했습니다."));
}

// ── 번역 탭 ──────────────────────────────────────────────────
const AI_LANG_LABELS = { en: "영어", ja: "일본어", "zh-Hans": "중국어(간체)", ru: "러시아어" };
let activeTranslateLang = "en";
let aiTranslateReqId = 0;
async function generateTranslate() {
  const input = document.getElementById("__aiTranslateInput");
  const result = document.getElementById("__aiTranslateResult");
  const copyBtn = document.querySelector("[data-ai-copy-translate]");
  const text = input ? input.value.trim() : "";
  if (!text) {
    showToast("번역할 문장을 입력해 주세요.");
    return;
  }
  const reqId = ++aiTranslateReqId;
  result.innerHTML = `<div class="ai-result-loading">번역 중...</div>`;
  copyBtn.hidden = true;

  const langLabel = AI_LANG_LABELS[activeTranslateLang] || "영어";
  const prompt = `다음 문장을 ${langLabel}로 번역해줘. 원래 의미와 어투(존댓말/반말, 안내/문의 등)를 최대한 살리고,
설명이나 부가 설명 없이 번역된 문장만 답해.

문장: "${text}"`;

  try {
    const { ok, data } = await fetchAiChat([{ role: "user", parts: [{ text: prompt }] }], { useSearch: false });
    if (reqId !== aiTranslateReqId) return;
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!ok || data.error || !answer) throw new Error(data?.error?.message || data?.error || "응답을 받지 못했습니다.");
    const cleaned = answer.trim().replace(/^["'“”]|["'“”]$/g, "");
    result.dataset.answer = cleaned;
    result.innerHTML = formatAiText(cleaned);
    copyBtn.hidden = false;
  } catch (err) {
    if (reqId !== aiTranslateReqId) return;
    result.dataset.answer = "";
    result.innerHTML = `<span>번역 중 오류가 발생했습니다: ${escapeAiText(err.message || "오류")}</span>`;
  }
}

function clearTranslate() {
  aiTranslateReqId++; // 진행 중이던 요청의 응답이 와도 무시되게
  const input = document.getElementById("__aiTranslateInput");
  const result = document.getElementById("__aiTranslateResult");
  const copyBtn = document.querySelector("[data-ai-copy-translate]");
  if (input) input.value = "";
  if (result) {
    result.dataset.answer = "";
    result.innerHTML = "<span>번역 결과가 여기에 표시됩니다.</span>";
  }
  if (copyBtn) copyBtn.hidden = true;
}

function copyTranslateAnswer() {
  const result = document.getElementById("__aiTranslateResult");
  const text = result?.dataset.answer || result?.textContent || "";
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => showToast("번역 결과를 복사했습니다."));
}

// ── 문의 답변 탭 ──────────────────────────────────────────────────
// 문의 내용만으로 AI가 전부 자동 인식하게 한다(제품명, 질문 종류 등). 스토어만 위 탭에서
// 고른 대로 넘기고, 답변은 항상 심화(detail) 모드로 고정한다.
let aiInquiryReqId = 0;
async function generateAiInquiryAnswer() {
  const input = document.getElementById("__aiInquiryInput");
  const result = document.getElementById("__aiInquiryResult");
  const copyBtn = document.querySelector("[data-ai-copy-inquiry]");
  const inquiry = input ? input.value.trim() : "";
  if (!inquiry) {
    showToast("고객 문의 내용을 입력해 주세요.");
    return;
  }
  const reqId = ++aiInquiryReqId;
  result.innerHTML = `<div class="ai-result-loading">답변 생성 중...</div>`;
  copyBtn.hidden = true;

  try {
    const { ok, data } = await fetchAiInquiry(inquiry, { store: activeInquiryStore, mode: "simple" });
    if (reqId !== aiInquiryReqId) return; // 응답 도착 전에 문의 내용이 더 바뀌어 새 요청이 이미 시작됨
    if (!ok || data.error) throw new Error(data.error || "서버 오류");
    result.dataset.answer = data.answer || "";
    result.innerHTML = formatAiText(data.answer || "");
    copyBtn.hidden = false;
  } catch (err) {
    if (reqId !== aiInquiryReqId) return;
    result.dataset.answer = "";
    result.innerHTML = `<span>답변 생성 중 오류가 발생했습니다: ${escapeAiText(err.message || "오류")}</span>`;
  }
}

function clearAiInquiry() {
  aiInquiryReqId++; // 진행 중이던 요청의 응답이 와도 무시되게
  const input = document.getElementById("__aiInquiryInput");
  const result = document.getElementById("__aiInquiryResult");
  const copyBtn = document.querySelector("[data-ai-copy-inquiry]");
  if (input) input.value = "";
  if (result) {
    result.dataset.answer = "";
    result.innerHTML = "<span>생성된 고객 답변 초안이 여기에 표시됩니다.</span>";
  }
  if (copyBtn) copyBtn.hidden = true;
}

function copyAiInquiryAnswer() {
  const result = document.getElementById("__aiInquiryResult");
  const text = result?.dataset.answer || result?.textContent || "";
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => showToast("답변을 복사했습니다."));
}

function trimAiWorkChatHistory() {
  if (aiWorkChatHistory.length > AI_CHAT_HISTORY_LIMIT) {
    aiWorkChatHistory = aiWorkChatHistory.slice(-AI_CHAT_HISTORY_LIMIT);
  }
}

function appendAiChatMessage(role, text, opts) {
  const box = document.getElementById("__aiChatMessages");
  if (!box) return;
  const isCalc = !!(opts && opts.calc);
  const div = document.createElement("div");
  div.className = "ai-msg " + (role === "user" ? "ai-msg-user" : "ai-msg-bot") + (isCalc ? " ai-msg-calc" : "");
  const tag = isCalc ? `<span class="ai-msg-tag">🧮 계산기 연동 답변</span>` : "";
  div.innerHTML = `<div class="ai-msg-avatar">${role === "user" ? "나" : AI_AVATAR_ICON}</div><div class="ai-msg-bubble">${tag}${formatAiText(text)}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showAiTyping() {
  const box = document.getElementById("__aiChatMessages");
  if (!box || document.getElementById("__aiTyping")) return;
  const div = document.createElement("div");
  div.id = "__aiTyping";
  div.className = "ai-msg ai-msg-bot";
  div.innerHTML = `<div class="ai-msg-avatar">${AI_AVATAR_ICON}</div><div class="ai-msg-bubble"><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function hideAiTyping() {
  const typing = document.getElementById("__aiTyping");
  if (typing) typing.remove();
}

function resizeAiTextarea(el, maxHeight) {
  if (!el) return;
  el.style.height = "44px";
  el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
}

function formatAiText(text) {
  return escapeAiText(text).replace(/\*\*/g, "").replace(/\n/g, "<br>");
}

function escapeAiText(text) {
  return String(text ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showToast(msg) {
  let t = document.getElementById("__toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "__toast";
    Object.assign(t.style, {
      position: "fixed",
      left: "50%",
      bottom: "32px",
      transform: "translateX(-50%)",
      background: "#05070b",
      color: "#fff",
      padding: "10px 20px",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
      zIndex: 9999,
      opacity: "0",
      transition: "opacity .2s",
      pointerEvents: "none",
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t.__timer);
  t.__timer = setTimeout(() => { t.style.opacity = "0"; }, 1600);
}
