/* ─────────────────────────────────────────
   칸칸 — 전기난방필름 단열재 소요량 계산기 (heating-film-insulation.js)
   폭 1M 고정 롤형 → 필요 길이(m) 산출
   ───────────────────────────────────────── */

'use strict';

// ── 상수 ──
const INSUL_WIDTH_MM  = 1000; // 단열재 폭 고정 1M
const MARGIN_MM       = 100;  // 폭당 마감 여유

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v;
}

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 계산하기 ──
function calculate() {
  const wallWidthMm  = toMm(document.getElementById('wallWidth').value,  document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const lossRate     = parseFloat(document.getElementById('lossRate').value) || 0;

  if (!wallWidthMm || !wallHeightMm) {
    alert('바닥 가로 길이와 세로 길이를 입력해주세요.');
    return;
  }

  // 순 바닥 면적 (m²)
  const netAreaM2 = (wallWidthMm / 1000) * (wallHeightMm / 1000);

  // 필요 폭 수 (올림)
  const stripCount = Math.ceil(wallWidthMm / INSUL_WIDTH_MM);

  // 1폭당 필요 길이 (세로 + 마감 여유 100mm) → m
  const onePieceHeightM = (wallHeightMm + MARGIN_MM) / 1000;

  // 기본 총 길이
  const baseLength = onePieceHeightM * stripCount;

  // 할증 적용 → 소수점 1자리 올림
  const finalLength = Math.ceil(baseLength * (1 + lossRate / 100) * 10) / 10;

  // 할증 포함 면적
  const lossAreaM2 = r(netAreaM2 * (1 + lossRate / 100), 2);

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${r(netAreaM2, 2)} m²에 필요한 단열재 소요량`;
  document.getElementById('resMainNum').textContent  = finalLength;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${stripCount}폭 기준`;

  document.getElementById('resStripCount').textContent = `${stripCount}폭`;
  document.getElementById('resNetArea').textContent    = `${r(netAreaM2, 2)} m²`;
  document.getElementById('resLossArea').textContent   = `${lossAreaM2} m²`;

  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 ${finalLength}m은 할증(${lossRate}%)을 포함한 발주 권장 길이입니다.
    (단열재 폭 1M / ${stripCount}폭 기준 / 폭당 마감 여유 100mm 포함)
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
    <br/>※ 알루미늄·은박 단열재는 절대 사용 금지 — 화재 위험이 있습니다.
  `;

  addHistory(finalLength, r(netAreaM2, 2), stripCount, lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value  = '3600';
  document.getElementById('wallHeight').value = '4500';
  document.getElementById('lossRate').value   = '10';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(length, netArea, stripCount, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'heating-film-insulation',
    calcName: '전기난방필름 단열재 소요량 계산기',
    url: 'heating-film-insulation.html',
    resultLabel: `${length}m 필요`,
    params: {
      wallWidth:      document.getElementById('wallWidth').value,
      wallWidthUnit:  document.getElementById('wallWidthUnit').value,
      wallHeight:     document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
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