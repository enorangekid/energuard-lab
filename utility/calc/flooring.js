/* ─────────────────────────────────────────
   칸칸 — 장판 소요량 계산기 (flooring.js)
   ───────────────────────────────────────── */

'use strict';

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v;
}

// ── mm² → m² 변환 ──
function mm2ToM2(mm2) {
  return mm2 / 1_000_000;
}

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 계산하기 ──
function calculate() {
  const wallWidthMm  = toMm(document.getElementById('wallWidth').value,  document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const filmWidthMm  = toMm(document.getElementById('filmWidth').value,  document.getElementById('filmWidthUnit').value);
  const overlapMm    = toMm(document.getElementById('overlap').value,    document.getElementById('overlapUnit').value);
  const lossRate     = parseFloat(document.getElementById('lossRate').value) || 0;

  if (!wallWidthMm || !wallHeightMm) {
    alert('바닥 가로 길이와 세로 길이를 입력해주세요.');
    return;
  }
  if (!filmWidthMm) {
    alert('장판 폭을 입력해주세요.');
    return;
  }

  const netAreaM2 = mm2ToM2(wallWidthMm * wallHeightMm);
  const effectiveWidthMm = filmWidthMm - overlapMm;

  if (effectiveWidthMm <= 0) {
    alert('겹침 길이가 장판 폭보다 클 수 없습니다.');
    return;
  }

  const stripCount      = Math.ceil(wallWidthMm / effectiveWidthMm);
  const onePieceHeightM = (wallHeightMm + 100) / 1000;
  const baseLength      = onePieceHeightM * stripCount;
  const finalLength     = Math.ceil(baseLength * (1 + lossRate / 100) * 10) / 10;

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const netM2display = r(netAreaM2, 2);
  const lossAreaM2   = r(netAreaM2 * (1 + lossRate / 100), 2);

  document.getElementById('resMainSub').textContent  = `${netM2display} m²에 필요한 장판 소요량`;
  document.getElementById('resMainNum').textContent  = finalLength;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${r(finalLength - r(baseLength, 1), 1)}m 포함`;
  document.getElementById('resStripCount').textContent = `${stripCount}폭`;
  document.getElementById('resBoardArea').textContent  = `${netM2display} m²`;
  document.getElementById('resLossArea').textContent   = `${lossAreaM2} m²`;
  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalLength}m</strong>은 할증(${lossRate}%)을 포함한 발주 권장 길이입니다. (장판 폭 ${filmWidthMm}mm / 겹침 ${overlapMm}mm / ${stripCount}폭 기준)
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
  `;

  addHistory(finalLength, netM2display, stripCount, lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value  = '3600';
  document.getElementById('wallHeight').value = '4500';
  document.getElementById('filmWidth').value  = '1810';
  document.getElementById('overlap').value    = '30';
  document.getElementById('lossRate').value   = '10';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(length, netArea, stripCount, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'flooring',
    calcName: '장판 소요량 계산기',
    url: 'flooring.html',
    resultLabel: `${length}m 필요`,
    params: {
      wallWidth:      document.getElementById('wallWidth').value,
      wallWidthUnit:  document.getElementById('wallWidthUnit').value,
      wallHeight:     document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      filmWidth:      document.getElementById('filmWidth').value,
      filmWidthUnit:  document.getElementById('filmWidthUnit').value,
      overlap:        document.getElementById('overlap').value,
      overlapUnit:    document.getElementById('overlapUnit').value,
      lossRate:       document.getElementById('lossRate').value,
    },
    detail: [
      { key: '순 면적', val: `${netArea} m²` },
      { key: '폭 수',   val: `${stripCount}폭` },
      { key: '할증률',  val: `${lossRate}%` },
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