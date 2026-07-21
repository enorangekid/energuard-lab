/* ─────────────────────────────────────────
   칸칸 — 실리콘/줄눈 소요량 계산기 (sealant.js)
   틈새 폭 × 깊이 × 길이 → 필요 통 수 산출
   ───────────────────────────────────────── */

'use strict';

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm')  return v * 10;
  if (unit === 'm')   return v * 1000;
  return v; // mm
}

// ── 단위 → m 변환 ──
function toM(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'mm') return v / 1000;
  if (unit === 'cm') return v / 100;
  return v; // m
}

// ── 계산하기 ──
function calculate() {
  const gapWidth   = toMm(document.getElementById('gapWidth').value,   document.getElementById('gapWidthUnit').value);
  const gapDepth   = toMm(document.getElementById('gapDepth').value,    document.getElementById('gapDepthUnit').value);
  const workLength = toM(document.getElementById('workLength').value,   document.getElementById('workLengthUnit').value);
  const lossRate   = parseFloat(document.getElementById('lossRate').value)    || 0;
  const cartVol    = parseFloat(document.getElementById('cartridgeVol').value) || 300;

  if (!gapWidth || !gapDepth) {
    alert('틈새 폭과 깊이를 입력해주세요.');
    return;
  }
  if (!workLength) {
    alert('시공 길이를 입력해주세요.');
    return;
  }

  // 순 소요량 (ml) = 폭(mm) × 깊이(mm) × 길이(m) × 1000(mm→ml 환산)
  // 폭×깊이 = mm², 길이 = m = 1000mm → mm³ → cm³(ml) : ÷ 1000
  const baseVolMl = gapWidth * gapDepth * workLength; // mm × mm × m = mm²·m = cm³ = ml (×1000÷1000)

  // 할증 적용
  const lossVolMl  = r(baseVolMl * (1 + lossRate / 100), 1);

  // 필요 통 수 (올림)
  const finalCount = Math.ceil(lossVolMl / cartVol);

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const cartridgeLabels = { 300: '일반 카트리지 / 300ml', 500: '소시지 타입 / 500ml', 600: '소시지 타입 / 600ml', 800: '소시지 타입 / 800ml' };
  const cartLabel = cartridgeLabels[cartVol] || `${cartVol}ml`;

  document.getElementById('resMainSub').textContent  = `${r(lossVolMl)}ml 필요한 실리콘 통 수`;
  document.getElementById('resMainNum').textContent  = finalCount;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${r(lossVolMl - baseVolMl, 1)}ml 포함`;

  document.getElementById('resBaseVol').textContent   = `${r(baseVolMl, 1)} ml`;
  document.getElementById('resLossVol').textContent   = `${lossVolMl} ml`;
  document.getElementById('resCartridge').textContent = cartLabel;

  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalCount}통</strong>은 할증(${lossRate}%)을 포함한 발주 권장 수량입니다. (${cartLabel} 기준)
    <br/>※ 틈새 깊이가 10mm 이상인 경우 백업재를 먼저 채워 실리콘 사용량을 줄이는 것을 권장합니다.
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
  `;

  addHistory(finalCount, r(lossVolMl), lossRate, cartLabel);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('gapWidth').value    = '10';
  document.getElementById('gapDepth').value    = '10';
  document.getElementById('workLength').value  = '10';
  document.getElementById('lossRate').value    = '10';
  document.getElementById('gapWidthUnit').value   = 'mm';
  document.getElementById('gapDepthUnit').value   = 'mm';
  document.getElementById('workLengthUnit').value = 'm';
  document.getElementById('placeType').value      = 'wet';
  document.getElementById('placeTypeText').textContent = '욕실/주방 (습기 많은 곳)';
  document.querySelectorAll('#placeTypeList .custom-select-item').forEach((el, i) => el.classList.toggle('active', i === 0));
  document.getElementById('cartridgeVol').value      = '300';
  document.getElementById('cartridgeVolText').textContent = '일반 카트리지 / 300ml';
  document.querySelectorAll('#cartridgeVolList .custom-select-item').forEach((el, i) => el.classList.toggle('active', i === 0));
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(count, vol, lossRate, cartLabel) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'sealant',
    calcName: '실리콘/줄눈 소요량 계산기',
    url: 'sealant.html',
    resultLabel: `${count}통 필요`,
    params: {
      gapWidth:       document.getElementById('gapWidth').value,
      gapWidthUnit:   document.getElementById('gapWidthUnit').value,
      gapDepth:       document.getElementById('gapDepth').value,
      gapDepthUnit:   document.getElementById('gapDepthUnit').value,
      workLength:     document.getElementById('workLength').value,
      workLengthUnit: document.getElementById('workLengthUnit').value,
      lossRate:       document.getElementById('lossRate').value,
      cartridgeVol:   document.getElementById('cartridgeVol').value,
    },
    detail: [
      { key: '총 소요량', val: `${vol} ml` },
      { key: '규격',      val: cartLabel },
      { key: '할증률',    val: `${lossRate}%` },
    ]
  });
  KankanHistory.renderPanel();
}

function initCustomSelect(wrapId, btnId, listId, hiddenId, onSelect) {
  const wrap = document.getElementById(wrapId);
  const btn = document.getElementById(btnId);
  const list = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  if (!wrap || !btn || !list || !hidden) return;

  btn.addEventListener('click', e => {
    if (btn.disabled) return;
    e.stopPropagation();
    wrap.classList.toggle('open');
    document.querySelectorAll('.custom-select-wrap').forEach(item => {
      if (item !== wrap) item.classList.remove('open');
    });
  });

  list.querySelectorAll('.custom-select-item:not(.soon)').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      list.querySelectorAll('.custom-select-item').forEach(option => option.classList.remove('active'));
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

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initCustomSelect('placeTypeWrap', 'placeTypeBtn', 'placeTypeList', 'placeType');
  initCustomSelect('cartridgeVolWrap', 'cartridgeVolBtn', 'cartridgeVolList', 'cartridgeVol');

  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});
