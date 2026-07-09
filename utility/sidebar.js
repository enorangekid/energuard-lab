/* ─────────────────────────────────────────
   칸칸 — sidebar.js
   ───────────────────────────────────────── */

'use strict';

// ── 공지사항 ──
const NOTICE = '몇 장 사야 할지 몰라서 검색하셨나요?     ·     한 장 더 시켰다가 반품 못 한 경험, 있죠?     ·     어림잡지 마세요, 칸칸이 계산합니다     ·     자재 발주가 두려운 당신에게     ·     현장 오차를 줄이는 정밀 실무 로직     ·     셀프 인테리어의 필수 도구 칸칸';

function renderNotice() {
  const el = document.getElementById('topbarNotice');
  if (el) el.textContent = NOTICE + '     ·     ' + NOTICE;
}

// ── 네비게이션 구조 ──
const NAV_ITEMS = [
  {
    category: '단열/보온',
    items: [
      { name: '판상형 단열재 수량 계산기',          url: 'calc/insulation-board.html' },
      { name: '열반사 단열재 소요량 계산기',         url: 'calc/reflective-insulation.html' },
      { name: '캠핑 단열재 소요량 계산기',           url: 'calc/insulation-board-camp.html' },
      { name: '빙어낚시 매트 소요량 계산기',         url: 'calc/ice-fishing-mat.html' },
      { name: '단열재 두께 계산기',                 url: 'calc/insulation-thickness.html' },
      { name: '전기난방필름 소요량 계산기',          url: 'calc/heating-film-insulation.html' },
      { name: '창문 단열재 견적 계산기',             url: 'calc/window-insulation.html' },
    ],
  },
  {
    category: '목공/보드',
    items: [
      { name: '석고보드 수량 계산기',               url: 'calc/gypsum.html' },
      { name: '천장재[텍스] 수량 계산기',           url: 'calc/tex.html' },
      { name: '방음/흡음재 수량 계산기',            url: 'calc/acoustic.html' },
    ],
  },
  {
    category: '마감/인테리어',
    items: [
      { name: '단열벽지 소요량 계산기',             url: 'calc/thermal-wallpaper.html' },
      { name: '단열초배지 소요량 계산기',            url: 'calc/thermal-base-wallpaper.html' },
      { name: '인테리어필름/시트지 소요량 계산기',   url: 'calc/interior-film.html' },
      { name: '장판 소요량 계산기',                 url: 'calc/flooring.html' },
      { name: '실리콘/줄눈 소요량 계산기',          url: 'calc/sealant.html' },
      { name: '블라인드 사이즈 계산기',             url: 'calc/blind.html' },
    ],
  },
  {
    category: '시공 보조',
    items: [
      { name: '우레탄폼 이액형[대용량] 소요량 계산기',  url: 'calc/foam-2k.html' },
      { name: '우레탄폼 스프레이형[소량] 소요량 계산기', url: 'calc/foam-spray.html' },
      { name: '우레탄폼 폼본드 소요량 계산기',         url: 'calc/foam-bond.html' },
      { name: '단열재 적재·운임 계산기',              url: 'calc/freight.html' },
      { name: '단열재 차량별 적재량 확인',            url: 'calc/freight-load.html' },
    ],
  },
  {
    category: '참고 자료',
    items: [
      { name: '재료별 열전도율 표',          url: 'calc/thermal-conductivity.html' },
      { name: '지역별 부위별 허용 열관류율', url: 'calc/u-value-table.html' },
      { name: '열관류율 계산기',            url: null },
    ],
  },
];

// ── 최근 본 계산기 추적 ──
const RECENT_KEY = 'kankan_recent';

function trackRecentCalc(name, url) {
  if (!url) return;
  try {
    let list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    list = list.filter(c => c.url !== url);
    list.unshift({ name, url });
    if (list.length > 5) list = list.slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch(e) {}
}

function getRecentCalcs() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch(e) { return []; }
}

// ── 인기 계산기 ──
const POPULAR_CALCS = [
  { name: '판상형단열재',  url: 'calc/insulation-board.html' },
  { name: '열반사단열재',  url: 'calc/reflective-insulation.html' },
  { name: '캠핑단열재',    url: 'calc/insulation-board-camp.html' },
  { name: '석고보드',      url: 'calc/gypsum.html' },
  { name: '단열벽지',      url: 'calc/thermal-wallpaper.html' },
  { name: '단열재두께',    url: 'calc/insulation-thickness.html' },
];

function shortName(name) {
  return name.replace(/\s*(수량|소요량|견적)?\s*계산기$/, '').replace(/\s*확인$/, '').trim();
}

// ── 검색 팝업 ──
function renderSearchModal() {
  if (document.getElementById('searchOverlay')) return;

  const sidebarEl = document.getElementById('sidebar');
  const root = (sidebarEl && sidebarEl.dataset.root) || '';

  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'searchOverlay';
  overlay.innerHTML = `
    <div class="search-modal" id="searchModal">
      <div class="search-input-row">
        <svg class="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="searchModalInput" class="search-modal-input" placeholder="어떤 계산기가 필요하신가요?" autocomplete="off" />
        <button class="search-close-btn" id="btnSearchClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="search-modal-body" id="searchModalBody"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input   = document.getElementById('searchModalInput');
  const body    = document.getElementById('searchModalBody');

  function openModal() {
    overlay.classList.add('active');
    input.value = '';
    renderDefault();
    setTimeout(() => input.focus(), 60);
  }
  function closeModal() { overlay.classList.remove('active'); }

  function renderDefault() {
    const recent = getRecentCalcs();
    let html = '';
    if (recent.length > 0) {
      html += `<div class="search-section">
        <div class="search-section-title">최근 본 계산기</div>
        <div class="search-results">
          ${recent.slice(0, 5).map(c => {
            const cat = NAV_ITEMS.find(s => s.items.some(i => i.url === c.url))?.category || '';
            return `<a class="search-result-item" href="${root}${c.url}">
              <span class="search-result-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              </span>
              <span class="search-result-cat">${cat}</span>
              <span class="search-result-name">${c.name}</span>
              <span class="search-result-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </span>
            </a>`;
          }).join('')}
        </div>
      </div>`;
    }
    html += `<div class="search-section">
      <div class="search-section-title">인기 계산기</div>
      <div class="search-chips">
        ${POPULAR_CALCS.map(c => `<a class="search-chip search-chip--hot" href="${root}${c.url}">${shortName(c.name)}</a>`).join('')}
      </div>
    </div>`;
    body.innerHTML = html;
  }

  function renderResults(query) {
    const q = query.trim();
    if (!q) { renderDefault(); return; }
    const results = NAV_ITEMS.flatMap(section =>
      section.items
        .filter(item => item.name.includes(q) || section.category.includes(q))
        .map(item => ({ name: item.name, url: item.url, category: section.category }))
    );
    if (!results.length) {
      body.innerHTML = `<div class="search-empty">검색 결과가 없습니다.</div>`;
      return;
    }
    body.innerHTML = `<div class="search-results">${
      results.map(item => `
        <a class="search-result-item${!item.url ? ' soon' : ''}" href="${item.url ? root + item.url : '#'}">
          <span class="search-result-cat">${item.category}</span>
          <span class="search-result-name">${item.name}</span>
          ${!item.url ? '<span class="sub-badge">준비중</span>' : ''}
        </a>`).join('')
    }</div>`;
  }

  input.addEventListener('input', e => renderResults(e.target.value));
  document.getElementById('btnSearchClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  overlay.addEventListener('click', e => { if (e.target.closest('.search-result-item')) closeModal(); });

  // 검색 아이콘 클릭 — DOM에 언제 추가되든 이벤트 위임
  document.addEventListener('click', e => {
    if (e.target.closest('#btnCatSearch')) openModal();
  });
}

// ── 카테고리 드롭다운 아이템 생성 (홈·계산기 페이지 공유) ──
function makeDropItem(name, url, root) {
  const shortName = name
    .replace(/\s*(수량|소요량|견적)?\s*계산기$/, '')
    .replace(/\s*확인$/, '')
    .trim();
  const a = document.createElement('a');
  a.className = 'cat-drop-item' + (url ? '' : ' soon');
  a.href = url ? root + url : root + 'coming-soon.html?name=' + encodeURIComponent(name);
  a.textContent = shortName;
  if (!url) {
    const badge = document.createElement('span');
    badge.className = 'sub-badge';
    badge.textContent = '준비중';
    a.appendChild(badge);
  }
  return a;
}

// ── 카테고리 드롭다운 빌드 (홈·계산기 페이지 공유) ──
function buildCategoryDropdowns(container, root) {
  if (!container) return;
  container.querySelectorAll('.cat-tab').forEach(tab => {
    const cat = tab.dataset.cat;
    if (!cat) return;
    const section = NAV_ITEMS.find(s => s.category === cat);
    if (!section) return;

    // wrap·chevron은 정적 HTML에 이미 포함 — 없을 때만 생성
    let wrap = tab.closest('.cat-tab-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cat-tab-wrap';
      tab.parentNode.insertBefore(wrap, tab);
      wrap.appendChild(tab);
    }
    if (!tab.querySelector('.cat-tab-chevron')) {
      const chevron = document.createElement('span');
      chevron.className = 'cat-tab-chevron';
      chevron.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      tab.appendChild(chevron);
    }

    // SPA: 이미 드롭다운이 초기화된 wrap은 건너뜀 (중복 방지)
    if (wrap.querySelector('.cat-dropdown')) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'cat-dropdown';

    let first = true;
    for (const item of section.items) {
      if (item.children) {
        const header = document.createElement('div');
        header.className = 'cat-drop-group' + (first ? ' first' : '');
        header.textContent = item.name;
        dropdown.appendChild(header);
        first = false;
        item.children.forEach(child => dropdown.appendChild(makeDropItem(child.name, child.url, root)));
      } else {
        dropdown.appendChild(makeDropItem(item.name, item.url, root));
        first = false;
      }
    }

    dropdown.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (!document.body.classList.contains('home')) {
          sessionStorage.setItem('kankan_open_cat', cat);
        }
      });
    });

    wrap.appendChild(dropdown);

    // CSS hover 대신 JS로 is-open 토글 — 클릭 순간 hover 끊김 방지
    wrap.addEventListener('mouseenter', () => wrap.classList.add('is-open'));
    wrap.addEventListener('mouseleave', () => wrap.classList.remove('is-open'));
  });

  // 이전 페이지에서 저장된 카테고리 드롭다운 복원
  const savedCat = sessionStorage.getItem('kankan_open_cat');
  if (savedCat) {
    sessionStorage.removeItem('kankan_open_cat');
    const savedTab = container.querySelector(`.cat-tab[data-cat="${savedCat}"]`);
    if (savedTab) {
      const savedWrap = savedTab.closest('.cat-tab-wrap');
      if (savedWrap) {
        savedWrap.classList.add('is-open');
        // mouseleave는 위의 공통 핸들러가 처리
      }
    }
  }
}

// ── 계산기 페이지 카테고리 네비바 초기화 (HTML은 각 페이지에 정적 포함) ──
function renderCalcNavBar() {
  if (document.body.classList.contains('home')) return;
  const nav = document.getElementById('categoryTabs');
  if (!nav) return;

  const sidebarEl = document.getElementById('sidebar');
  const root = (sidebarEl && sidebarEl.dataset.root) || '../';

  // 로고 href 설정
  const logo = nav.querySelector('.topbar-logo-mobile');
  if (logo) logo.href = root + 'index.html';

  // 드롭다운 빌드
  buildCategoryDropdowns(nav, root);

  // 현재 페이지를 최근 본 계산기에 저장
  const currentPath = location.pathname.replace(/^\//, '');
  for (const section of NAV_ITEMS) {
    for (const item of section.items) {
      if (item.url && isCurrentPath(currentPath, item.url)) {
        trackRecentCalc(item.name, item.url);
        break;
      }
    }
  }

  // 히스토리 버튼 이벤트 연결
  const overlay      = document.getElementById('mobileOverlay');
  const historyPanel = document.getElementById('historyPanel');
  const btnCatHistory = nav.querySelector('#btnCatHistory');
  if (btnCatHistory && historyPanel && overlay) {
    function closeAll() {
      historyPanel.classList.remove('mobile-open');
      overlay.classList.remove('active');
    }
    btnCatHistory.addEventListener('click', () => {
      historyPanel.classList.contains('mobile-open') ? closeAll() : (
        historyPanel.classList.add('mobile-open'),
        overlay.classList.add('active')
      );
    });
    overlay.addEventListener('click', closeAll);
  }
}

// ── 헬퍼 ──
function isCurrentPath(currentPath, url) {
  return url && currentPath && (
    currentPath === url ||
    currentPath.endsWith('/' + url)
  );
}

function getComingSoonName() {
  if (!location.pathname.includes('coming-soon')) return null;
  return new URLSearchParams(location.search).get('name');
}

function isComingSoonMatch(itemName) {
  const name = getComingSoonName();
  return name && decodeURIComponent(name) === itemName;
}

// ── 사이드바 렌더링 ──
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentPath = location.pathname.replace(/^\//, '');
  const root = sidebar.dataset.root || '';

  let html = `
    <div class="sidebar-logo">
      <a href="${root}index.html" class="logo">KAN KAN</a>
    </div>
    <div class="sidebar-nav">`;

  for (const section of NAV_ITEMS) {
    html += `
      <nav class="nav-section">
        <div class="nav-category">${section.category}</div>
        <ul>
    `;

    for (const item of section.items) {
      if (item.children) {
        const anyChildActive = item.children.some(child =>
          isCurrentPath(currentPath, child.url) || isComingSoonMatch(child.name)
        );
        const firstReady = item.children.find(c => c.url);
        const parentHref = firstReady
          ? `${root}${firstReady.url}`
          : `${root}coming-soon.html?name=${encodeURIComponent(item.name)}`;

        html += `
          <li class="nav-item nav-group ${anyChildActive ? 'open active-parent' : ''}">
            <a class="nav-group-label" href="${parentHref}">
              <span class="nav-group-text">${item.name}</span>
              <span class="nav-group-icon">${anyChildActive ? '−' : '+'}</span>
            </a>
            <ul class="nav-sub">
        `;

        for (const child of item.children) {
          const href = child.url
            ? `${root}${child.url}`
            : `${root}coming-soon.html?name=${encodeURIComponent(child.name)}`;
          const isActive = isCurrentPath(currentPath, child.url) || isComingSoonMatch(child.name);

          html += `
            <li class="nav-sub-item ${isActive ? 'active' : ''} ${!child.url ? 'soon' : ''}">
              <a href="${href}">
                ${child.name}
                ${!child.url ? '<span class="sub-badge">준비중</span>' : ''}
              </a>
            </li>
          `;
        }

        html += `</ul></li>`;

      } else {
        const href = item.url
          ? `${root}${item.url}`
          : `${root}coming-soon.html?name=${encodeURIComponent(item.name)}`;
        const isActive = isCurrentPath(currentPath, item.url) || isComingSoonMatch(item.name);

        html += `
          <li class="nav-item ${isActive ? 'active' : ''}">
            <a href="${href}">
              ${item.name}
              ${!item.url ? '<span class="sub-badge">준비중</span>' : ''}
            </a>
          </li>
        `;
      }
    }

    html += `</ul></nav>`;
  }

  sidebar.innerHTML = html + '</div>';
  initSidebarEvents(sidebar);
}

// ── 사이드바 이벤트 ──
function initSidebarEvents(sidebar) {
  sidebar.querySelectorAll('.nav-group-label').forEach(label => {
    const icon = label.querySelector('.nav-group-icon');
    if (!icon) return;
    icon.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const group = label.closest('.nav-group');
      group.classList.toggle('open');
      icon.textContent = group.classList.contains('open') ? '−' : '+';
    });
  });
}

// ── 공유 유틸리티 ──
function initCustomSelect(wrapId, btnId, listId, hiddenId, onSelect) {
  const wrap   = document.getElementById(wrapId);
  const btn    = document.getElementById(btnId);
  const list   = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  if (!wrap || !btn || !list || !hidden) return;

  btn.addEventListener('click', e => {
    if (btn.disabled) return;
    e.stopPropagation();
    wrap.classList.toggle('open');
    document.querySelectorAll('.custom-select-wrap').forEach(w => {
      if (w !== wrap) w.classList.remove('open');
    });
  });

  list.querySelectorAll('.custom-select-item:not(.soon)').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      list.querySelectorAll('.custom-select-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      btn.querySelector('span').textContent = item.textContent.trim();
      hidden.value = item.dataset.value;
      wrap.classList.remove('open');
      if (onSelect) onSelect(item.dataset.value);
    });
  });

  document.addEventListener('click', () => wrap.classList.remove('open'));
}

function showToast(msg) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className   = 'toast-msg toast-warn';
  el.textContent = msg;
  wrap.appendChild(el);
  const remove = () => { el.classList.add('hiding'); el.addEventListener('transitionend', () => el.remove(), {once:true}); };
  const t = setTimeout(remove, 3500);
  el.addEventListener('click', () => { clearTimeout(t); remove(); });
}

// ── 드로어 ──
function initMobileDrawers() {
  const overlay      = document.getElementById('mobileOverlay');
  const sidebar      = document.getElementById('sidebar');
  const historyPanel = document.getElementById('historyPanel');
  if (!overlay) return;

  function closeAll() {
    sidebar      && sidebar.classList.remove('mobile-open');
    historyPanel && historyPanel.classList.remove('mobile-open');
    overlay.classList.remove('active');
  }
  function openHistory() {
    sidebar && sidebar.classList.remove('mobile-open');
    historyPanel && historyPanel.classList.add('mobile-open');
    overlay.classList.add('active');
  }

  // 햄버거 — 사이드바 드로어 열기
  const btnHamburger = document.getElementById('btnHamburger');
  if (btnHamburger && sidebar) {
    btnHamburger.addEventListener('click', () => {
      sidebar.classList.contains('mobile-open') ? closeAll() : (
        historyPanel && historyPanel.classList.remove('mobile-open'),
        sidebar.classList.add('mobile-open'),
        overlay.classList.add('active')
      );
    });
  }

  // 카테고리바 히스토리 아이콘 (홈·calc 공통)
  const btnCatHistory = document.getElementById('btnCatHistory');
  btnCatHistory && btnCatHistory.addEventListener('click', () => {
    historyPanel && historyPanel.classList.contains('mobile-open') ? closeAll() : openHistory();
  });

  overlay.addEventListener('click', closeAll);
}

// ── 초기화 ──
function _init() {
  renderNotice();
  renderCalcNavBar();
  // 사이드바·검색모달은 첫 프레임 이후 렌더링 → 카테고리바 깜빡임 방지
  requestAnimationFrame(() => {
    renderSidebar();
    initMobileDrawers();
    renderSearchModal();
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}