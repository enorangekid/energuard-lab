/* ─────────────────────────────────────────
   ENERGUARD LAB — 관리자 영역 공통 스크립트
   admin/ 하위 모든 페이지가 이 파일을 로드합니다.
   - Supabase Auth 세션 확인(로그인 안 돼 있으면 login.html로 튕김)
   - 관리자 서브 내비게이션 렌더링 (여기 한 곳에서만 메뉴 수정)
   work_notes 등 admin 전용 테이블은 RLS가 authenticated 전용이라,
   로그인 세션 없이는 anon 키로 접근해도 전부 거부됩니다.
   ───────────────────────────────────────── */
const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";

const ADMIN_SUBNAV = [
  { label: "업무일지", href: "worklog.html" },
  { label: "업무노트", href: "work-notes.html" },
  { label: "단가표",   href: "pricing.html" },
  { label: "견적서",   href: "quote.html" },
  { label: "자료실",   href: "archive.html" },
  { label: "위젯",     href: "widgets.html" },
];
// 아직 만들지 않은 페이지 — coming-soon으로 보낸다.
const ADMIN_SUBNAV_READY = ["work-notes.html"];

function initAdminTopbar() {
  const bar = document.querySelector("header.topbar[data-admin-topbar]");
  if (!bar) return;
  const current = (location.pathname.split("/").pop() || "").toLowerCase();
  const requestedName = new URLSearchParams(location.search).get("name") || "";

  const navHtml = ADMIN_SUBNAV.map((item) => {
    const ready = ADMIN_SUBNAV_READY.includes(item.href);
    const href = ready ? item.href : `coming-soon.html?name=${encodeURIComponent(item.label)}`;
    const isActive =
      (ready && current === item.href.toLowerCase()) ||
      (!ready && current === "coming-soon.html" && requestedName === item.label);
    const active = isActive ? " active" : "";
    return `<a href="${href}"${active ? ` class="${active.trim()}"` : ""}>${item.label}</a>`;
  }).join("\n      ");

  bar.innerHTML = `
  <div class="topbar-inner">
    <a href="../index.html" class="topbar-logo"><span>ENERGUARD</span><span>LAB</span></a>
    <nav class="topbar-nav">
      ${navHtml}
    </nav>
    <div class="topbar-actions">
      <a href="../index.html" class="admin-exit-link">메인으로</a>
      <button type="button" class="topbar-icon-btn" id="adminLogoutBtn" aria-label="로그아웃" title="로그아웃">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>
  </div>`;

  document.getElementById("adminLogoutBtn")?.addEventListener("click", adminLogout);
}

// 상단바는 인증 SDK나 세션 응답보다 먼저 그려 페이지 이동 중에도 같은 모습을 유지한다.
initAdminTopbar();

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 로그인 여부 확인 — 세션 없으면 즉시 login.html로 리다이렉트.
// 각 admin 페이지는 <body> 렌더 전에 이 함수부터 호출해야 합니다.
async function requireAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const back = encodeURIComponent(location.pathname.split("/").pop() || "work-notes.html");
    location.replace(`login.html?redirect=${back}`);
    return null;
  }
  initAdminTopbar();
  document.documentElement.classList.add("admin-authed");
  return session;
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  location.replace("login.html");
}

window.supabaseClient = supabaseClient;
window.requireAdminSession = requireAdminSession;
window.adminLogout = adminLogout;
window.initAdminTopbar = initAdminTopbar;
