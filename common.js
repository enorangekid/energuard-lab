/* ─────────────────────────────────────────
   ENERGUARD LAB — 공통 상단바 (여기 한 곳에서만 수정)
   각 페이지에는 <header class="topbar" data-topbar></header> 셸 한 줄만 두면
   common.js가 메뉴를 채우고, 현재 페이지에 active를 자동 표시합니다.
   <base href="..."> 가 걸린 페이지(utility.html)는 ../ 접두어를 자동 적용합니다.
   ───────────────────────────────────────── */
const TOPBAR_MENU = [
  { label: "랭킹추적",   href: "rank-tracker.html" },
  { label: "키워드분석", href: "naver-rank.html" },
  { label: "매출분석",   href: "sales-analysis.html" },
  { label: "아이템발굴", href: "item-discovery.html" },
  { label: "유틸리티",   href: "utility.html" },
];

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
    bar.querySelectorAll(".topbar-nav a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
      a.classList.toggle("active", href === activePage);
    });
    return;
  }

  const navHtml = TOPBAR_MENU.map((item) => {
    if (!item.href) return `<a href="#" class="nav-dummy">${item.label}</a>`;
    const active = activePage === item.href.toLowerCase() ? ' class="active"' : "";
    return `<a href="${prefix}${item.href}"${active}>${item.label}</a>`;
  }).join("\n      ");

  bar.innerHTML = `
  <div class="topbar-inner">
    <a href="${prefix}index.html" class="topbar-logo"><span>ENERGUARD</span><span>LAB</span></a>
    <nav class="topbar-nav">
      ${navHtml}
    </nav>
    <div class="topbar-actions" aria-hidden="true">
      <button type="button" class="topbar-icon-btn" tabindex="-1" aria-label="검색">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
      <button type="button" class="topbar-icon-btn" tabindex="-1" aria-label="계산 내역">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 15"></polyline>
        </svg>
      </button>
    </div>
  </div>`;
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
  const btn = document.querySelector('.topbar-actions .topbar-icon-btn[aria-label="계산 내역"]');
  if (btn) {
    btn.setAttribute("aria-label", "분석 내역");
    btn.removeAttribute("tabindex");
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
        <a href="#">사용 가이드 ↗</a>
        <a href="#">이용약관 ↗</a>
        <a href="#">개인정보처리방침 ↗</a>
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
      <button type="button" class="ai-work-close" data-ai-close aria-label="닫기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
      </button>
    </div>
    <div class="ai-work-tabs" role="tablist">
      <button type="button" class="active" data-ai-tab="chat">업무 질문</button>
      <button type="button" data-ai-tab="inquiry">문의 답변</button>
    </div>
    <section class="ai-work-pane active" data-ai-pane="chat">
      <div class="ai-chat-messages" id="__aiChatMessages">
        <div class="ai-msg ai-msg-bot">
          <div class="ai-msg-avatar">AI</div>
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
      <div class="ai-inquiry-controls">
        <label>스토어
          <select id="__aiStore">
            <option value="energuard">에너가드컴퍼니</option>
            <option value="korean">한국단열</option>
          </select>
        </label>
        <label>답변 방식
          <select id="__aiMode">
            <option value="simple">심플</option>
            <option value="detail">심화</option>
          </select>
        </label>
      </div>
      <label class="ai-inquiry-label">상품
        <select id="__aiProduct">
          <option value="">자동 인식</option>
          <option value="빌트론 열반사 단열재">빌트론 열반사 단열재</option>
          <option value="아이소핑크 (XPS)">아이소핑크 (XPS)</option>
          <option value="비드법 단열재">비드법 단열재</option>
          <option value="경질우레탄 보드">경질우레탄 보드</option>
          <option value="PF보드">PF보드</option>
          <option value="불연단열재">불연단열재</option>
          <option value="우레탄폼본드">우레탄폼본드</option>
          <option value="어싱매트 / 어싱패드">어싱매트 / 어싱패드</option>
        </select>
      </label>
      <textarea id="__aiInquiryInput" class="ai-inquiry-text" placeholder="고객 문의를 붙여넣으세요."></textarea>
      <div class="ai-inquiry-actions">
        <button type="button" class="ai-secondary-btn" data-ai-clear-inquiry>지우기</button>
        <button type="button" class="ai-primary-btn" data-ai-generate-inquiry>답변 생성</button>
      </div>
      <div class="ai-inquiry-result" id="__aiInquiryResult">
        <span>생성된 고객 답변 초안이 여기에 표시됩니다.</span>
      </div>
      <button type="button" class="ai-copy-btn" data-ai-copy-inquiry hidden>답변 복사</button>
    </section>`;
  document.body.appendChild(panel);
  bindAiWorkPanel();
}

function bindAiWorkPanel() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-ai-close]")) closeAiWorkPanel();
    const tab = e.target.closest("[data-ai-tab]");
    if (tab) setAiTab(tab.dataset.aiTab);
    if (e.target.closest("[data-ai-send-chat]")) sendAiWorkChat();
    if (e.target.closest("[data-ai-generate-inquiry]")) generateAiInquiryAnswer();
    if (e.target.closest("[data-ai-clear-inquiry]")) clearAiInquiry();
    if (e.target.closest("[data-ai-copy-inquiry]")) copyAiInquiryAnswer();
  });

  document.addEventListener("keydown", (e) => {
    const chatInput = document.getElementById("__aiChatInput");
    if (e.target === chatInput && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiWorkChat();
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
  appendAiChatMessage("user", text);
  aiWorkChatHistory.push({ role: "user", parts: [{ text }] });
  trimAiWorkChatHistory();
  showAiTyping();

  try {
    const res = await fetch(AI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AI_SUPABASE_ANON_KEY,
        "apikey": AI_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ chatHistory: aiWorkChatHistory.slice(-AI_CHAT_HISTORY_LIMIT) }),
    });
    const data = await res.json();
    hideAiTyping();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!res.ok || data.error || !aiText) throw new Error(data?.error?.message || data?.error || "응답을 받지 못했습니다.");
    appendAiChatMessage("model", aiText);
    aiWorkChatHistory.push({ role: "model", parts: [{ text: aiText }] });
    trimAiWorkChatHistory();
  } catch (err) {
    hideAiTyping();
    aiWorkChatHistory.pop();
    appendAiChatMessage("model", "통신 오류가 발생했습니다. gemini-chat 함수 상태를 확인해 주세요.");
  }
}

function trimAiWorkChatHistory() {
  if (aiWorkChatHistory.length > AI_CHAT_HISTORY_LIMIT) {
    aiWorkChatHistory = aiWorkChatHistory.slice(-AI_CHAT_HISTORY_LIMIT);
  }
}

function appendAiChatMessage(role, text) {
  const box = document.getElementById("__aiChatMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "ai-msg " + (role === "user" ? "ai-msg-user" : "ai-msg-bot");
  div.innerHTML = `<div class="ai-msg-avatar">${role === "user" ? "나" : "AI"}</div><div class="ai-msg-bubble">${formatAiText(text)}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showAiTyping() {
  const box = document.getElementById("__aiChatMessages");
  if (!box || document.getElementById("__aiTyping")) return;
  const div = document.createElement("div");
  div.id = "__aiTyping";
  div.className = "ai-msg ai-msg-bot";
  div.innerHTML = `<div class="ai-msg-avatar">AI</div><div class="ai-msg-bubble"><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function hideAiTyping() {
  const typing = document.getElementById("__aiTyping");
  if (typing) typing.remove();
}

async function generateAiInquiryAnswer() {
  const input = document.getElementById("__aiInquiryInput");
  const result = document.getElementById("__aiInquiryResult");
  const copyBtn = document.querySelector("[data-ai-copy-inquiry]");
  const inquiry = input ? input.value.trim() : "";
  if (!inquiry) {
    showToast("고객 문의 내용을 입력해 주세요.");
    return;
  }
  const product = document.getElementById("__aiProduct").value;
  const store = document.getElementById("__aiStore").value;
  const mode = document.getElementById("__aiMode").value;
  const payloadInquiry = product ? `[상품: ${product}]\n\n${inquiry}` : inquiry;
  result.innerHTML = `<div class="ai-result-loading">답변 생성 중...</div>`;
  copyBtn.hidden = true;

  try {
    const res = await fetch(AI_INQUIRY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AI_SUPABASE_ANON_KEY,
        "apikey": AI_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ inquiry: payloadInquiry, store, mode }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "서버 오류");
    result.dataset.answer = data.answer || "";
    result.innerHTML = formatAiText(data.answer || "");
    copyBtn.hidden = false;
  } catch (err) {
    result.dataset.answer = "";
    result.innerHTML = `<span>답변 생성 중 오류가 발생했습니다: ${escapeAiText(err.message || "오류")}</span>`;
  }
}

function clearAiInquiry() {
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
