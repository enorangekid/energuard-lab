/* ─────────────────────────────────────────
   칸칸 — 우레탄폼 이액형[대용량] 소요량 계산기 (foam-2k.js)
   ───────────────────────────────────────── */

'use strict';

// ── 제품별 커버리지 (50mm 기준, m²/세트) ──
const COVERAGE = { hard: 10, soft: 20 };
const TYPE_LABEL = { hard: '경질', soft: '연질' };

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 단위 → m 변환 ──
function toM(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'mm') return v / 1000;
  if (unit === 'cm') return v / 100;
  return v;
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
  const foamType  = document.getElementById('foamType').value;
  const areaW     = toM(document.getElementById('areaW').value,     document.getElementById('areaWUnit').value);
  const areaH     = toM(document.getElementById('areaH').value,     document.getElementById('areaHUnit').value);
  const area      = areaW * areaH;
  const thickness = toMm(document.getElementById('thickness').value, document.getElementById('thicknessUnit').value);
  const lossRate  = parseFloat(document.getElementById('lossRate').value) || 0;

  if (!areaW || !areaH) {
    alert('시공 가로와 세로를 입력해주세요.');
    return;
  }
  if (!thickness) {
    alert('시공 두께를 입력해주세요.');
    return;
  }

  const coverage = COVERAGE[foamType] || 10;
  const adjArea  = r(area * (thickness / 50), 2);
  const baseCount = adjArea / coverage;
  const finalCount = Math.ceil(baseCount * (1 + lossRate / 100));
  const typeLabel = TYPE_LABEL[foamType] || foamType;

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${r(area)} ㎡ 시공에 필요한 세트 수`;
  document.getElementById('resMainNum').textContent  = finalCount;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, 두께 ${thickness}mm 기준`;
  document.getElementById('resFoamType').textContent = typeLabel;
  document.getElementById('resCoverage').textContent = `${coverage} ㎡ / 세트`;
  document.getElementById('resAdjArea').textContent  = `${adjArea} ㎡`;
  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalCount}세트</strong>는 할증(${lossRate}%)을 포함한 발주 권장 수량입니다.
    (${typeLabel} / 두께 ${thickness}mm 기준 / 세트당 커버리지 ${coverage}㎡)
    <br/>※ 실제 발포량은 온도·습도·시공면 상태에 따라 달라질 수 있습니다.
    <br/>※ 이액형 특성상 1회 시공 시 전량 소진을 권장합니다.
  `;

  addHistory(finalCount, r(area), thickness, lossRate, typeLabel);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('foamType').value = 'hard';
  document.getElementById('foamTypeText').textContent = '경질';
  document.querySelectorAll('#foamTypeList .custom-select-item').forEach((el, i) => el.classList.toggle('active', i === 0));
  document.getElementById('areaW').value         = '3';
  document.getElementById('areaH').value         = '3';
  document.getElementById('thickness').value     = '50';
  document.getElementById('lossRate').value      = '10';
  document.getElementById('areaWUnit').value     = 'm';
  document.getElementById('areaHUnit').value     = 'm';
  document.getElementById('thicknessUnit').value = 'mm';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(count, area, thickness, lossRate, typeLabel) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'foam-2k',
    calcName: '우레탄폼 이액형[대용량] 소요량 계산기',
    url: 'foam-2k.html',
    resultLabel: `${count}세트 필요`,
    params: {
      foamType:      document.getElementById('foamType').value,
      areaW:         document.getElementById('areaW').value,
      areaWUnit:     document.getElementById('areaWUnit').value,
      areaH:         document.getElementById('areaH').value,
      areaHUnit:     document.getElementById('areaHUnit').value,
      thickness:     document.getElementById('thickness').value,
      thicknessUnit: document.getElementById('thicknessUnit').value,
      lossRate:      document.getElementById('lossRate').value,
    },
    detail: [
      { key: '제품 종류', val: typeLabel },
      { key: '시공 면적', val: `${area} ㎡` },
      { key: '시공 두께', val: `${thickness}mm` },
      { key: '할증률',    val: `${lossRate}%` },
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