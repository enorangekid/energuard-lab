/* ─────────────────────────────────────────
   칸칸 — 인테리어 필름/시트지 소요량 계산기 (interior-film.js)
   폭 1220mm 고정 기준 → 필요 길이(m) 산출
   ───────────────────────────────────────── */

'use strict';

let filmTypeEl;
let lossRateEl;

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


// ── 필름 종류별 기본 할증률 ──
const FILM_DEFAULT_LOSS = {
  solid:  15,
  wood:   25,
  metal:  25,
};

// ── 계산하기 ──
function calculate() {
  const wallWidthMm  = toMm(document.getElementById('wallWidth').value,  document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const filmWidthMm  = toMm(document.getElementById('filmWidth').value,  document.getElementById('filmWidthUnit').value);
  const marginMm     = toMm(document.getElementById('margin').value,     document.getElementById('marginUnit').value);
  const lossRate     = parseFloat(lossRateEl.value) || 0;
  const filmType     = filmTypeEl.value;

  if (!wallWidthMm || !wallHeightMm) {
    alert('부착면 가로 길이와 세로 길이를 입력해주세요.');
    return;
  }
  if (!filmWidthMm) {
    alert('필름 폭을 입력해주세요.');
    return;
  }

  // 전체 면적
  const totalAreaMm2 = wallWidthMm * wallHeightMm;

  // 순 면적 (m²)
  const netAreaMm2 = totalAreaMm2;
  const netAreaM2  = mm2ToM2(netAreaMm2);

  // 필요 폭 수 (올림)
  const stripCount = Math.ceil(wallWidthMm / filmWidthMm);

  // 1폭당 필요 길이 (세로 + 여유분) → m
  const onePieceHeightM = (wallHeightMm + marginMm) / 1000;

  // 기본 총 길이
  const baseLength = onePieceHeightM * stripCount;

  // 할증 적용 → 소수점 1자리 올림
  const finalLength = Math.ceil(baseLength * (1 + lossRate / 100) * 10) / 10;

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const netM2display = r(netAreaM2, 2);
  const lossAreaM2   = r(netAreaM2 * (1 + lossRate / 100), 2);
  const filmTypeLabels = { solid: '단색', wood: '우드/결', metal: '메탈/패턴' };
  const filmLabel = filmTypeLabels[filmType] || filmType;

  document.getElementById('resMainSub').textContent  = `${netM2display} m²에 필요한 필름 소요량 (${filmLabel})`;
  document.getElementById('resMainNum').textContent  = finalLength;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${r(finalLength - r(baseLength, 1), 1)}m 포함`;

  document.getElementById('resStripCount').textContent = `${stripCount}폭`;
  document.getElementById('resBoardArea').textContent  = `${netM2display} m²`;
  document.getElementById('resLossArea').textContent   = `${lossAreaM2} m²`;

  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalLength}m</strong>은 할증(${lossRate}%)을 포함한 발주 권장 길이입니다. (필름 폭 ${filmWidthMm}mm 기준 / ${stripCount}폭)
    <br/>※ 무늬가 있는 필름은 방향을 맞춰야 하므로, 결이 있는 필름은 20~30% 더 여유 있게 주문하세요.
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
  `;

  addHistory(finalLength, netM2display, stripCount, lossRate, filmLabel);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value  = '3600';
  document.getElementById('wallHeight').value = '4500';
  document.getElementById('filmWidth').value  = '1220';
  document.getElementById('margin').value     = '100';
  document.getElementById('filmType').value   = 'solid';
  lossRateEl.value = '15';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(length, netArea, stripCount, lossRate, filmLabel) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'interior-film',
    calcName: '인테리어 필름/시트지 소요량 계산기',
    url: 'interior-film.html',
    resultLabel: `${length}m 필요`,
    params: {
      wallWidth:      document.getElementById('wallWidth').value,
      wallWidthUnit:  document.getElementById('wallWidthUnit').value,
      wallHeight:     document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      filmWidth:      document.getElementById('filmWidth').value,
      filmWidthUnit:  document.getElementById('filmWidthUnit').value,
      margin:         document.getElementById('margin').value,
      marginUnit:     document.getElementById('marginUnit').value,
      filmType:       document.getElementById('filmType').value,
      lossRate:       document.getElementById('lossRate').value,
    },
    detail: [
      { key: '순 면적',   val: `${netArea} m²` },
      { key: '폭 수',     val: `${stripCount}폭` },
      { key: '필름 종류', val: filmLabel },
      { key: '할증률',    val: `${lossRate}%` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  filmTypeEl = document.getElementById('filmType');
  lossRateEl = document.getElementById('lossRate');
  filmTypeEl.addEventListener('change', () => {
    const type = filmTypeEl.value;
    lossRateEl.value = FILM_DEFAULT_LOSS[type] || 15;
  });
  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});