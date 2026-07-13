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
  const prefix = typeof window.TOPBAR_PREFIX === "string"
    ? window.TOPBAR_PREFIX
    : (document.querySelector("base") ? "../" : "");

  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const navHtml = TOPBAR_MENU.map((item) => {
    if (!item.href) return `<a href="#" class="nav-dummy">${item.label}</a>`;
    const active = current === item.href.toLowerCase() ? ' class="active"' : "";
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
  if (document.getElementById("__aiChatFab")) return;
  initAiWorkPanel();
  const btn = document.createElement("button");
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
  btn.addEventListener("click", toggleAiWorkPanel);
  document.body.appendChild(btn);
}

/* ─────────────────────────────────────────
   분석 내역 패널 — 키워드 분석(naver-rank.html) 결과 히스토리를 전 페이지에서 열람.
   상단바 시계 아이콘으로 토글. 항목 클릭 시:
   - 키워드분석 페이지에서는 window.nrRestoreAnalysis 훅으로 즉시 복원 (로딩 없음)
   - 다른 페이지에서는 naver-rank.html?restoreKeyword=... 로 이동해 복원
   ───────────────────────────────────────── */
const NR_HISTORY_KEY = "nrAnalysisHistory:v1";

function nrHistoryLoad() {
  try { return JSON.parse(localStorage.getItem(NR_HISTORY_KEY) || "[]"); }
  catch (_) { return []; }
}

function nrEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

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

function nrHistoryClear() {
  if (!confirm("분석 내역을 모두 삭제할까요?")) return;
  localStorage.removeItem(NR_HISTORY_KEY);
  nrHistoryRenderList();
}

function nrHistoryRenderList() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const entries = nrHistoryLoad();
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
      const entry = nrHistoryLoad()[parseInt(el.dataset.index)];
      if (!entry) return;
      nrHistoryToggle(false);
      if (typeof window.nrRestoreAnalysis === "function") {
        window.nrRestoreAnalysis(entry.keyword, entry.store); // 키워드분석 페이지 — 즉시 복원
        return;
      }
      const prefix = (typeof window.TOPBAR_PREFIX === "string")
        ? window.TOPBAR_PREFIX
        : (document.querySelector("base") ? "../" : "");
      const params = new URLSearchParams({ restoreKeyword: entry.keyword, restoreStore: entry.store });
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

  function ensureFooter() {
    let footer = document.getElementById("__commonFooter");
    if (!footer) {
      footer = document.createElement("footer");
      footer.id = "__commonFooter";
      footer.className = "site-footer common-site-footer";
      footer.innerHTML = footerMarkup;
      document.body.appendChild(footer);
    }

    const pageFooters = Array.from(document.querySelectorAll(".site-footer"))
      .filter(el => el.id !== "__commonFooter");
    pageFooters.forEach(el => {
      if (!el.querySelector(".site-footer-inner")) el.innerHTML = footerMarkup;
    });
    const hasPageFooter = pageFooters.length > 0;
    footer.hidden = hasPageFooter;
  }

  ensureFooter();
  const observer = new MutationObserver(ensureFooter);
  observer.observe(document.body, { childList: true, subtree: true });
}

function bootCommonUi() {
  initTopbar();
  initAiChatFab();
  initHistoryPanel();
  initCommonFooter();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootCommonUi);
} else {
  bootCommonUi();
}

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
