/* ─────────────────────────────────────────
   칸칸 — 블라인드 사이즈 계산기 (blind.js)
   ───────────────────────────────────────── */

'use strict';

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v;
}

// ── 여유값 레이블 ──
function marginLabel(val) {
  if (val < 0)  return `−${Math.abs(val)}mm`;
  if (val === 0) return '0mm (여유 없음)';
  return `+${val}mm`;
}

// ── 계산하기 ──
function calculate() {
  const fw = toMm(document.getElementById('frameWidth').value,  document.getElementById('frameWidthUnit').value);
  const fh = toMm(document.getElementById('frameHeight').value, document.getElementById('frameHeightUnit').value);
  const hm = parseInt(document.getElementById('hMarginValue').value) || 0;
  const vm = parseInt(document.getElementById('vMarginValue').value) || 0;

  if (!fw || !fh) {
    alert('창틀 가로와 높이를 입력해주세요.');
    return;
  }

  // 가로: hMarginValue는 양쪽 합산값
  const orderW = Math.round(fw + hm);
  // 높이: 하단 여유만 적용 (매립 시 -10은 단순 차감)
  const orderH = Math.round(fh + vm);

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resWidth').textContent   = orderW.toLocaleString();
  document.getElementById('resHeight').textContent  = orderH.toLocaleString();
  document.getElementById('resMainSub').textContent = '주문 제작 사이즈';
  document.getElementById('resMainDesc').textContent =
    `창틀 실측 ${fw}×${fh}mm 기준 · 좌우 ${marginLabel(hm)} · 하단 ${marginLabel(vm)}`;

  document.getElementById('resFrame').textContent   = `${fw} × ${fh} mm`;
  document.getElementById('resHMargin').textContent = marginLabel(hm);
  document.getElementById('resVMargin').textContent = marginLabel(vm);

  // 2400mm 초과 경고
  const warnWide = orderW > 2400
    ? `<br/>⚠️ 주문 가로 폭이 2400mm를 초과합니다. 창문 프레임 기준으로 분할 주문을 권장합니다.`
    : '';

  document.getElementById('resultNote').innerHTML = `
    ※ 위 사이즈를 블라인드 주문 시 가로·세로에 그대로 입력하세요.${warnWide}<br>
    ※ 실제 현장 조건(손잡이 돌출, 커튼박스 등)에 따라 사이즈가 달라질 수 있습니다.
  `;

  addHistory(orderW, orderH, fw, fh, hm, vm);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('frameWidth').value  = '1500';
  document.getElementById('frameHeight').value = '1800';
  document.getElementById('frameWidthUnit').value  = 'mm';
  document.getElementById('frameHeightUnit').value = 'mm';

  // 드롭다운 리셋
  [
    { wrapId: 'hMarginWrap', btnId: 'hMarginBtn', listId: 'hMarginList', hiddenId: 'hMarginValue', defaultVal: '100', defaultText: '있음 (양쪽 여유 +100mm)' },
    { wrapId: 'vMarginWrap', btnId: 'vMarginBtn', listId: 'vMarginList', hiddenId: 'vMarginValue', defaultVal: '100', defaultText: '있음 (하단 여유 +100mm)' },
  ].forEach(({ btnId, listId, hiddenId, defaultVal, defaultText }) => {
    document.getElementById(btnId).querySelector('span').textContent = defaultText;
    document.getElementById(hiddenId).value = defaultVal;
    document.querySelectorAll(`#${listId} .custom-select-item`).forEach(i => {
      i.classList.toggle('active', i.dataset.value === defaultVal);
    });
  });

  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(orderW, orderH, fw, fh, hm, vm) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'blind',
    calcName: '블라인드 사이즈 계산기',
    url: 'blind.html',
    resultLabel: `${orderW.toLocaleString()} × ${orderH.toLocaleString()} mm`,
    params: {
      frameWidth:      document.getElementById('frameWidth').value,
      frameWidthUnit:  document.getElementById('frameWidthUnit').value,
      frameHeight:     document.getElementById('frameHeight').value,
      frameHeightUnit: document.getElementById('frameHeightUnit').value,
      hMarginValue:    document.getElementById('hMarginValue').value,
      vMarginValue:    document.getElementById('vMarginValue').value,
    },
    detail: [
      { key: '창틀 실측', val: `${fw}×${fh}mm` },
      { key: '좌우 여유', val: marginLabel(hm * 2) },
      { key: '하단 여유', val: marginLabel(vm) },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initCustomSelect('hMarginWrap', 'hMarginBtn', 'hMarginList', 'hMarginValue');
  initCustomSelect('vMarginWrap', 'vMarginBtn', 'vMarginList', 'vMarginValue');

  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});