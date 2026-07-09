/* ─────────────────────────────────────────
   칸칸 — 창문 단열재 견적 계산기 (window-insulation.js)
   ───────────────────────────────────────── */

'use strict';

// ── 가격표 ──
const PRICE_TABLE = {
  '백색 스티로폼 40T':  { mvalue: 1.7, uprice: 0.130 },
  '백색 스티로폼 50T':  { mvalue: 1.7, uprice: 0.145 },
  '백색 스티로폼 60T':  { mvalue: 1.7, uprice: 0.160 },
  '백색 스티로폼 70T':  { mvalue: 1.6, uprice: 0.175 },
  '백색 스티로폼 80T':  { mvalue: 1.6, uprice: 0.190 },
  '백색 스티로폼 90T':  { mvalue: 1.6, uprice: 0.210 },
  '백색 스티로폼 100T': { mvalue: 1.5, uprice: 0.230 },
  '백색 스티로폼 110T': { mvalue: 1.5, uprice: 0.240 },
  '아이소핑크 40T':     { mvalue: 2.6, uprice: 0.130 },
  '아이소핑크 50T':     { mvalue: 2.6, uprice: 0.145 },
  '아이소핑크 60T':     { mvalue: 2.6, uprice: 0.160 },
  '아이소핑크 70T':     { mvalue: 2.5, uprice: 0.175 },
  '아이소핑크 80T':     { mvalue: 2.5, uprice: 0.190 },
  '아이소핑크 90T':     { mvalue: 2.5, uprice: 0.210 },
  '아이소핑크 100T':    { mvalue: 2.4, uprice: 0.230 },
  '아이소핑크 110T':    { mvalue: 2.4, uprice: 0.240 },
};

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v;
}

// ── 1개 단가 계산 ──
function calcUnitPrice(material, thickness, width, height) {
  const key   = `${material} ${thickness}`;
  const entry = PRICE_TABLE[key];
  if (!entry) return 0;
  const w     = width  / 1000;
  const h     = height / 1000;
  const price = w * h * entry.mvalue * entry.uprice * 100000;
  return Math.ceil(price / 10) * 10;
}

// ── 결제 수량 계산 (100원 단위 수량) ──
function calcPayQty(unitPrice, qty) {
  return Math.floor((unitPrice * qty) / 100);
}

// ── 계산하기 ──
function calculate() {
  const material  = document.getElementById('materialValue').value;
  const thickness = document.getElementById('thicknessValue').value;
  const w         = toMm(document.getElementById('winWidth').value,  document.getElementById('winWidthUnit').value);
  const h         = toMm(document.getElementById('winHeight').value, document.getElementById('winHeightUnit').value);
  const qty       = parseInt(document.getElementById('winQty').value) || 1;

  if (!w || !h) {
    alert('가로, 세로 사이즈를 입력해주세요.');
    return;
  }

  const unitPrice = calcUnitPrice(material, thickness, w, h);
  const totalPrice = unitPrice * qty;
  const payQty    = calcPayQty(unitPrice, qty);

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${w}×${h}mm · ${qty}개 총 견적가`;
  document.getElementById('resMainNum').textContent  = totalPrice.toLocaleString();
  document.getElementById('resMainDesc').textContent = `${material} ${thickness} · 결제 수량 ${payQty}개`;
  document.getElementById('resMaterial').textContent = `${material} ${thickness}`;
  document.getElementById('resUnitPrice').textContent = `${unitPrice.toLocaleString()}원`;
  document.getElementById('resPayQty').textContent   = `${payQty}개`;

  document.getElementById('resultNote').innerHTML = `
    ※ 스마트스토어 주문 시 <strong>가로 ${w}mm × 세로 ${h}mm</strong>, 수량 <strong>${payQty}개</strong>로 입력해 주세요.<br>
    ※ 본 견적은 참고용이며 실제 판매가와 다를 수 있습니다.<br>
    ※ 가로·세로 중 한쪽이 1800mm 이상이면 화물 배송 및 추가 배송비가 발생할 수 있습니다.
  `;

  addHistory(totalPrice, unitPrice, payQty, w, h, qty, material, thickness);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('materialValue').value  = '백색 스티로폼';
  document.getElementById('thicknessValue').value = '50T';
  document.getElementById('materialBtn').querySelector('span').textContent  = '백색 스티로폼';
  document.getElementById('thicknessBtn').querySelector('span').textContent = '50T';

  document.querySelectorAll('#materialList .custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === '백색 스티로폼');
  });
  document.querySelectorAll('#thicknessList .custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === '50T');
  });

  document.getElementById('winWidth').value  = '500';
  document.getElementById('winHeight').value = '900';
  document.getElementById('winQty').value    = '1';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(totalPrice, unitPrice, payQty, w, h, qty, material, thickness) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'window-insulation',
    calcName: '창문 단열재 견적 계산기',
    url: 'window-insulation.html',
    resultLabel: `${totalPrice.toLocaleString()}원`,
    params: {
      materialValue:  document.getElementById('materialValue').value,
      thicknessValue: document.getElementById('thicknessValue').value,
      winWidth:       document.getElementById('winWidth').value,
      winWidthUnit:   document.getElementById('winWidthUnit').value,
      winHeight:      document.getElementById('winHeight').value,
      winHeightUnit:  document.getElementById('winHeightUnit').value,
      winQty:         document.getElementById('winQty').value,
    },
    detail: [
      { key: '자재',   val: `${material} ${thickness}` },
      { key: '사이즈', val: `${w}×${h}mm` },
      { key: '수량',   val: `${qty}개 (결제 ${payQty}개)` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initCustomSelect('materialWrap', 'materialBtn', 'materialList', 'materialValue');
  initCustomSelect('thicknessWrap', 'thicknessBtn', 'thicknessList', 'thicknessValue');

  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});