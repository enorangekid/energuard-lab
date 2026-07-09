/* ─────────────────────────────────────────
   칸칸 — 단열재 차량별 적재량 확인 (freight-load.js)
   ───────────────────────────────────────── */

'use strict';

// ── 데이터 ──
const XPS_DATA = { 10:50, 20:22, 30:15, 40:12, 50:10, 60:8, 70:7, 80:6, 90:5, 100:4, 110:4, 120:4, 130:3, 140:3, 150:3, 160:3, 170:2, 180:2 };
const EPS_THICKNESSES = [10,20,30,40,50,60,70,75,80,90,100,120,150,200,250,300];

const TRUCK_SPECS = [
  { key:'1ton',      name:'1톤 용달',  width:1600, height:2800, lenRows:3, type:'single',          floorCount:3,  safeHeight:2500 },
  { key:'1.4ton',    name:'1.4톤 용달',width:1600, height:3100, lenRows:4, type:'single',          floorCount:4,  safeHeight:2600 },
  { key:'2.5ton',    name:'2.5톤',     width:2000, height:4300, type:'mixed_2.5',                  floorCount:5,  safeHeight:2800 },
  { key:'3.5ton',    name:'3.5톤',     width:2050, height:4600, type:'mixed_3.5',                  floorCount:6,  safeHeight:3000 },
  { key:'5ton',      name:'5톤',       width:2300, height:6200, type:'overhang_5t',                floorCount:8,  safeHeight:3200 },
  { key:'5ton_plus', name:'5톤 장축',  width:2350, height:8000, type:'overhang_5t_plus',           floorCount:10, safeHeight:3300 },
];

// ── 상태 ──
let currentType     = 'XPS';
let currentTruckKey = '';

// ── 헬퍼 ──
function getSheetsPerBundle(type, thickness) {
  if (!thickness || thickness <= 0) return 0;
  if (type === 'XPS') return XPS_DATA[thickness] || Math.floor(600 / thickness);
  const s = Math.floor(600 / thickness);
  return s < 1 ? 1 : s;
}

function getBundleHeightMm(type, thickness) {
  const sheets = getSheetsPerBundle(type, thickness);
  return sheets === 0 ? 600 : thickness * sheets;
}

// ── 자재 선택 콜백 ──
function onMaterialSelect(value) {
  currentType = value;
  buildRefTable();
  if (currentTruckKey) {
    const spec = TRUCK_SPECS.find(t => t.key === currentTruckKey);
    if (spec) renderResult(spec);
  }
}

// ── 차량 선택 콜백 ──
function onTruckSelect(value) {
  currentTruckKey = value;
}

// ── 결과 렌더링 ──
function renderResult(spec) {
  const repThickness   = 50;
  const bundleHeightMm = getBundleHeightMm(currentType, repThickness);

  let maxTiers = Math.floor(spec.safeHeight / bundleHeightMm);
  if (maxTiers < 1) maxTiers = 1;
  if (spec.key === '1ton' || spec.key === '1.4ton') {
    const limit = currentType === 'XPS' ? 4 : 3;
    if (maxTiers > limit) maxTiers = limit;
  }
  const totalBundles = spec.floorCount * maxTiers;

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';

  document.getElementById('resMainSub').textContent      = spec.name + ' 기준 적재량';
  document.getElementById('resVehicle').textContent      = totalBundles + '단';
  document.getElementById('resBundleDetail').textContent = `${spec.floorCount}슬롯 × ${maxTiers}단 (50T 기준)`;
  document.getElementById('resBundle').textContent       = totalBundles + '단';
  document.getElementById('resTruckSize').textContent    = `${spec.width.toLocaleString()} × ${spec.height.toLocaleString()}mm`;
  document.getElementById('resNote').textContent         = `※ ${currentType} 50T 기준 · 1단 높이 ${bundleHeightMm}mm · 안전 적재 높이 ${spec.safeHeight.toLocaleString()}mm · 실제 두께에 따라 단 수가 달라집니다`;

  const vis = document.getElementById('visualSection');
  vis.style.display = 'flex';
  setTimeout(() => { drawVisualization(spec, totalBundles, bundleHeightMm); }, 100);

  addHistory(spec.name, totalBundles, repThickness, bundleHeightMm);
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ── Top View / Side View ──
function drawVisualization(vInfo, totalBundles, bundleHeightMm) {
  const wrap = document.querySelector('.truck-topview-wrap');
  if (!wrap) return;
  let containerWidth = wrap.clientWidth - 80;
  if (containerWidth <= 0) {
    setTimeout(() => drawVisualization(vInfo, totalBundles, bundleHeightMm), 50);
    return;
  }

  const slotW = 900, slotL = 1800;
  const singleBoxW = slotL, doubleBoxW = slotW;
  const singleRowH = slotW, doubleRowH = slotL;

  let maxTiers = Math.floor(vInfo.safeHeight / bundleHeightMm);
  if (maxTiers < 1) maxTiers = 1;
  if (vInfo.key === '1ton' || vInfo.key === '1.4ton') {
    const limit = currentType === 'XPS' ? 4 : 3;
    if (maxTiers > limit) maxTiers = limit;
  }

  const truckBed = document.getElementById('truckBed');
  const sideview = document.getElementById('sideviewWrap');

  truckBed.innerHTML = `<div class="truck-cab">운전석</div>
    <div class="truck-dim-w">${vInfo.width}mm</div>
    <div class="truck-dim-h"><span>${vInfo.height}mm</span></div>`;
  sideview.innerHTML = `<div class="sideview-head">앞</div>
    <div class="limit-line" style="bottom:${120+16}px;"><span class="limit-label">높이 제한</span></div>`;

  document.getElementById('topViewLabel').textContent = '900×1800mm 기준';

  let fitScale = containerWidth / vInfo.width;
  if (fitScale > 0.12) fitScale = 0.12;

  truckBed.style.width  = (vInfo.width  * fitScale) + 'px';
  truckBed.style.height = (vInfo.height * fitScale) + 'px';

  let rowConfigs = [];
  if (vInfo.type === 'mixed_3.5') {
    rowConfigs = [
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH},
    ];
  } else if (vInfo.type === 'mixed_2.5') {
    rowConfigs = [
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH},
    ];
  } else if (vInfo.type.includes('overhang')) {
    const cnt = vInfo.type === 'overhang_5t_plus' ? 5 : 4;
    for (let i = 0; i < cnt; i++)
      rowConfigs.push({type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH});
  } else {
    for (let i = 0; i < vInfo.lenRows; i++)
      rowConfigs.push({type:'가로', cap:maxTiers, mode:'single', rowH:singleRowH});
  }

  const slotMap = [];
  rowConfigs.forEach(cfg => {
    if (cfg.mode === 'double') { slotMap.push({maxH:cfg.cap/2}); slotMap.push({maxH:cfg.cap/2}); }
    else slotMap.push({maxH:cfg.cap});
  });

  const slotFill = new Array(slotMap.length).fill(0);
  let placed = 0, guard = 0;
  while (placed < totalBundles && guard < 2000) {
    for (let i = 0; i < slotMap.length; i++) {
      if (placed < totalBundles && slotFill[i] < slotMap[i].maxH) { slotFill[i]++; placed++; }
    }
    guard++;
  }

  const boxClass = currentType === 'EPS' ? 'eps' : 'xps';
  let sCursor = 0;
  rowConfigs.forEach(cfg => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'truck-row';
    rowDiv.style.height = (cfg.rowH * fitScale) + 'px';
    rowDiv.style.width  = '100%';

    const left  = slotFill[sCursor];
    const right = cfg.mode === 'double' ? slotFill[sCursor + 1] : 0;
    sCursor += cfg.mode === 'double' ? 2 : 1;

    const createBox = (cnt, mode) => {
      const box = document.createElement('div');
      box.className   = 'stack-box ' + (cnt === 0 ? 'empty' : boxClass);
      box.style.width  = ((mode === 'double' ? doubleBoxW : singleBoxW) * fitScale) + 'px';
      box.style.height = '100%';
      box.innerHTML    = `<span>${cnt > 0 ? cnt : '–'}</span>`;
      return box;
    };

    if (cfg.mode === 'double') {
      rowDiv.appendChild(createBox(left,  'double'));
      rowDiv.appendChild(createBox(right, 'double'));
    } else {
      rowDiv.appendChild(createBox(left, 'single'));
    }
    truckBed.appendChild(rowDiv);

    const maxStack = Math.max(left, right);
    const colDiv   = document.createElement('div');
    colDiv.className = 'side-col';
    const hRatio = 120 / 2500;
    for (let k = 0; k < maxStack; k++) {
      const block = document.createElement('div');
      block.className   = 'side-block ' + boxClass;
      let pxH = bundleHeightMm * hRatio;
      if (pxH < 8) pxH = 8;
      block.style.height = pxH + 'px';
      block.textContent  = k + 1;
      colDiv.appendChild(block);
    }
    colDiv.innerHTML += `<div class="side-col-label">${cfg.type.charAt(0)}</div>`;
    sideview.appendChild(colDiv);
  });
}

// ── 두께별 단위표 ──
function buildRefTable() {
  const tbody = document.getElementById('refTableBody');
  tbody.innerHTML = '';
  const list = currentType === 'XPS'
    ? Object.keys(XPS_DATA).map(Number)
    : EPS_THICKNESSES;

  list.forEach(t => {
    const qty = getSheetsPerBundle(currentType, t);
    tbody.innerHTML += `<tr><td>${t}T</td><td>${qty}장</td><td>${t * qty}mm</td></tr>`;
  });
}

// ── 히스토리 ──
function addHistory(vehicleName, totalBundles, thickness, bundleHeightMm) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'freight-load',
    calcName: '단열재 차량별 적재량 확인',
    url: 'freight-load.html',
    resultLabel: `${vehicleName} · 최대 ${totalBundles}단`,
    params: {
      materialType: document.getElementById('materialType').value,
      truckType:    document.getElementById('truckType').value,
    },
    detail: [
      { key: '자재',     val: `${currentType} ${thickness}T` },
      { key: '1단 높이', val: `${bundleHeightMm}mm` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── 초기화 ──
function resetAll() {
  currentType     = 'XPS';
  currentTruckKey = '';
  document.getElementById('materialBtnText').textContent = '압출법단열재 (XPS)';
  document.getElementById('materialType').value = 'XPS';
  document.querySelectorAll('#materialList .custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === 'XPS');
  });
  document.getElementById('truckBtnText').textContent = '1톤 용달';
  document.getElementById('truckType').value = '1ton';
  document.querySelectorAll('#truckList .custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === '1ton');
  });
  document.getElementById('resultPanel').style.display   = 'none';
  document.getElementById('visualSection').style.display = 'none';
  buildRefTable();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initCustomSelect('materialWrap', 'materialBtn', 'materialList', 'materialType', onMaterialSelect);
  initCustomSelect('truckWrap',    'truckBtn',    'truckList',    'truckType',    onTruckSelect);
  buildRefTable();

  document.getElementById('btnCheck').addEventListener('click', () => {
    const truckKey = document.getElementById('truckType').value;
    if (!truckKey) { alert('차량을 선택해주세요.'); return; }
    currentTruckKey = truckKey;
    const spec = TRUCK_SPECS.find(t => t.key === truckKey);
    if (spec) renderResult(spec);
  });

  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});
