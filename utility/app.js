/* ─────────────────────────────────────────
   칸칸 — app.js
   ───────────────────────────────────────── */

// ── CALCULATORS — NAV_ITEMS에서 자동 생성 (sidebar.js가 먼저 로드되어야 함) ──
// NAV_ITEMS만 수정하면 사이드바 + 그리드 + 검색 모두 자동 반영
function urlToId(url) {
  if (!url) return null;
  return url.replace('calc/', '').replace('.html', '');
}

const CALCULATORS = NAV_ITEMS.flatMap(section =>
  section.items.flatMap(item =>
    item.children
      ? item.children.map(child => ({
          category: section.category,
          name: child.name,
          id: urlToId(child.url) || child.name,
          url: child.url || null,
        }))
      : [{
          category: section.category,
          name: item.name,
          id: urlToId(item.url) || item.name,
          url: item.url || null,
        }]
  )
);


// ── 계산기 그리드 렌더링 ──
function renderCalcGrid(searchFilter = '', categoryFilter = '') {
  const grid = document.getElementById('calcGrid');
  if (!grid) return;

  let filtered = CALCULATORS;
  if (categoryFilter) filtered = filtered.filter(c => c.category === categoryFilter);
  if (searchFilter) filtered = filtered.filter(c =>
    c.name.includes(searchFilter) || c.category.includes(searchFilter)
  );

  const html = filtered.length
    ? filtered.map(c => calcCardHTML(c)).join('')
    : '<p style="grid-column:1/-1;text-align:center;color:var(--color-text-muted);padding:40px 0;font-size:14px;">검색 결과가 없습니다.</p>';

  requestAnimationFrame(() => {
    grid.innerHTML = html;
  });

  const gridTitle = document.getElementById('gridTitle');
  if (gridTitle) {
    if (categoryFilter) gridTitle.textContent = categoryFilter;
    else if (searchFilter) gridTitle.textContent = `"${searchFilter}" 검색 결과`;
    else gridTitle.textContent = '계산기 한번에 보기';
  }
}

function calcCardHTML(c) {
  return `
    <div class="calc-card ${c.url ? '' : 'calc-card--soon'}" data-id="${c.id}">
      <div class="calc-card-category">${c.category}</div>
      <div class="calc-card-name">${c.name}</div>
      ${c.url ? '' : '<div class="calc-card-badge">준비중</div>'}
    </div>
  `;
}

// ── 계산기 열기 ──
function openCalc(id) {
  const calc = CALCULATORS.find(c => c.id === id);
  if (!calc) return;
  const url = calc.url
    ? calc.url
    : `coming-soon.html?name=${encodeURIComponent(calc.name)}`;
  if (calc.url) trackRecentCalc(calc.name, calc.url);
  if (window.KankanRouter) {
    window.KankanRouter.navigate(url);
  } else {
    window.location.href = url;
  }
}

// ── 유틸 ──
function roundTo(n, places) {
  const factor = Math.pow(10, places);
  return Math.round(n * factor) / factor;
}

// ── 홈 페이지 초기화 (SPA 재진입 시에도 직접 호출 가능) ──
function initHomePage() {
  // 단위 변환: 평 ↔ m²
  const pyeongInput = document.getElementById('pyeong');
  const sqmInput    = document.getElementById('sqm');
  if (pyeongInput && sqmInput) {
    pyeongInput.addEventListener('input', () => {
      const v = parseFloat(pyeongInput.value);
      sqmInput.value = isNaN(v) ? '' : roundTo(v * 3.30579, 4);
    });
    sqmInput.addEventListener('input', () => {
      const v = parseFloat(sqmInput.value);
      pyeongInput.value = isNaN(v) ? '' : roundTo(v / 3.30579, 4);
    });
  }

  // 단위 변환: mm ↔ m
  const mmInput    = document.getElementById('mm');
  const meterInput = document.getElementById('meter');
  if (mmInput && meterInput) {
    mmInput.addEventListener('input', () => {
      const v = parseFloat(mmInput.value);
      meterInput.value = isNaN(v) ? '' : roundTo(v / 1000, 6);
    });
    meterInput.addEventListener('input', () => {
      const v = parseFloat(meterInput.value);
      mmInput.value = isNaN(v) ? '' : roundTo(v * 1000, 4);
    });
  }

  // 카테고리 드롭다운 초기화 (홈 루트는 '')
  if (typeof buildCategoryDropdowns === 'function') {
    buildCategoryDropdowns(document.querySelector('.cat-tabs-list'), '');
  }

  // 계산기 그리드 클릭 이벤트 위임
  const calcGrid = document.getElementById('calcGrid');
  if (calcGrid) {
    calcGrid.addEventListener('click', e => {
      const card = e.target.closest('.calc-card');
      if (!card || card.classList.contains('calc-card--soon')) return;
      openCalc(card.dataset.id);
    });
  }

  renderCalcGrid();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
}

document.addEventListener('DOMContentLoaded', initHomePage);