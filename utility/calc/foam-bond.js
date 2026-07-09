/* ─────────────────────────────────────────
   칸칸 — 우레탄폼 폼본드 소요량 계산기 (foam-bond.js)
   1캔 = 16㎡ 기준 → 필요 캔 수 산출
   ───────────────────────────────────────── */

'use strict';

// ── 상수 ──
const M2_PER_CAN = 16; // 1캔당 시공 가능 면적 (m²)

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v;
}

// ── 계산하기 ──
function calculate() {
  const boardW      = toMm(document.getElementById('boardW').value, document.getElementById('boardWUnit').value);
  const boardH      = toMm(document.getElementById('boardH').value, document.getElementById('boardHUnit').value);
  const boardWUnit  = document.getElementById('boardWUnit').value;
  const boardHUnit  = document.getElementById('boardHUnit').value;
  const boardCount  = parseInt(document.getElementById('boardCount').value)    || 0;
  const lossRate    = parseFloat(document.getElementById('lossRate').value)    || 0;

  if (!boardW || !boardH) {
    alert('단열재 가로와 세로를 입력해주세요.');
    return;
  }
  if (!boardCount) {
    alert('시공 수량을 입력해주세요.');
    return;
  }

  // 단열재 1장 면적 (m²)
  const boardAreaM2 = (boardW / 1000) * (boardH / 1000);

  // 전체 시공 면적
  const totalAreaM2 = boardAreaM2 * boardCount;

  // 필요 캔 수 (할증 적용 → 올림)
  const finalCount = Math.ceil((totalAreaM2 / M2_PER_CAN) * (1 + lossRate / 100));

  // 장당 소요 면적
  const perBoardM2 = r(boardAreaM2, 2);

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${boardCount}장 시공에 필요한 폼본드`;
  document.getElementById('resMainNum').textContent  = finalCount;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${document.getElementById('boardW').value}×${document.getElementById('boardH').value}${boardWUnit} 기준`;

  document.getElementById('resTotalArea').textContent = `${r(totalAreaM2, 2)} ㎡`;
  document.getElementById('resPerBoard').textContent  = `${perBoardM2} ㎡ / 장`;
  document.getElementById('resTotalGram').textContent = `${M2_PER_CAN} ㎡ / 캔`;

  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalCount}개</strong>는 할증(${lossRate}%)을 포함한 발주 권장 수량입니다.
    (1캔당 시공 가능 면적 ${M2_PER_CAN}㎡ 기준)
    <br/>※ 시공 방법과 단열재 종류·두께에 따라 실제 소요량은 달라질 수 있습니다.
  `;

  const rawW = document.getElementById('boardW').value;
  const rawH = document.getElementById('boardH').value;
  addHistory(finalCount, boardCount, rawW, rawH, boardWUnit, r(totalAreaM2, 2), lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('boardW').value     = '900';
  document.getElementById('boardH').value     = '1800';
  document.getElementById('boardCount').value = '10';
  document.getElementById('lossRate').value   = '10';
  document.getElementById('boardWUnit').value = 'mm';
  document.getElementById('boardHUnit').value = 'mm';
  document.getElementById('presetType').value = 'custom';
  document.getElementById('presetTypeText').textContent = '직접 입력';
  document.querySelectorAll('#presetTypeList .custom-select-item').forEach((el, i) => el.classList.toggle('active', i === 0));
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(count, boardCount, boardW, boardH, boardUnit, totalArea, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'foam-bond',
    calcName: '우레탄폼 폼본드 소요량 계산기',
    url: 'foam-bond.html',
    resultLabel: `${count}개 필요`,
    params: {
      boardW:     document.getElementById('boardW').value,
      boardWUnit: document.getElementById('boardWUnit').value,
      boardH:     document.getElementById('boardH').value,
      boardHUnit: document.getElementById('boardHUnit').value,
      boardCount: document.getElementById('boardCount').value,
      lossRate:   document.getElementById('lossRate').value,
    },
    detail: [
      { key: '단열재 규격', val: `${boardW}×${boardH}${boardUnit}` },
      { key: '시공 수량',   val: `${boardCount}장` },
      { key: '전체 면적',   val: `${totalArea} ㎡` },
      { key: '할증률',      val: `${lossRate}%` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});