/* ─────────────────────────────────────────
   ENERGUARD LAB — utility calculator data
   ───────────────────────────────────────── */

'use strict';

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
      const label = btn.querySelector('span');
      if (label) label.textContent = item.textContent.trim();
      hidden.value = item.dataset.value;
      wrap.classList.remove('open');
      if (onSelect) onSelect(item.dataset.value);
    });
  });

  document.addEventListener('click', () => wrap.classList.remove('open'));
}
