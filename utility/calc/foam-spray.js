/* ─────────────────────────────────────────
   칸칸 — 우레탄폼 스프레이폼[소량] 소요량 계산기 (foam-spray.js)
   캔형 840ml / 20mm 기준 3.3㎡ → 필요 캔 수 산출
   ───────────────────────────────────────── */

'use strict';

// ── 캔당 커버리지 (20mm 기준) ──
const CAN_COVERAGE = 3.3;
const BASE_THICKNESS = 20;

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
  const areaW     = toM(document.getElementById('areaW').value,     document.getElementById('areaWUnit').value);
  const areaH     = toM(document.getElementById('areaH').value,     document.getElementById('areaHUnit').value);
  const thickness = toMm(document.getElementById('thickness').value, document.getElementById('thicknessUnit').value);
  const lossRate  = parseFloat(document.getElementById('lossRate').value)  || 0;

  if (!areaW || !areaH) {
    alert('시공 가로와 세로를 입력해주세요.');
    return;
  }
  if (!thickness) {
    alert('시공 두께를 입력해주세요.');
    return;
  }

  const area = areaW * areaH;

  // 두께 보정 면적 (20mm 기준 환산)
  const adjArea = r(area * (thickness / BASE_THICKNESS), 2);

  // 기본 캔 수
  const baseCount = adjArea / CAN_COVERAGE;

  // 할증 적용 → 올림
  const finalCount = Math.ceil(baseCount * (1 + lossRate / 100));

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${r(area)} ㎡ 시공에 필요한 캔 수`;
  document.getElementById('resMainNum').textContent  = finalCount;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, 두께 ${thickness}mm 기준`;

  document.getElementById('resArea').textContent    = `${r(area)} ㎡`;
  document.getElementById('resAdjArea').textContent = `${adjArea} ㎡`;

  document.getElementById('resultNote').innerHTML = `
    ※ 최종 수량 <strong>${finalCount}캔</strong>은 할증(${lossRate}%)을 포함한 발주 권장 수량입니다.
    (캔형 840ml / 두께 ${thickness}mm 기준 / 캔당 커버리지 ${CAN_COVERAGE}㎡)
    <br/>※ 실제 발포량은 온도·습도·시공면 상태에 따라 달라질 수 있습니다.
    <br/>※ 1회 시공 시 전량 소진을 권장합니다.
  `;

  addHistory(finalCount, r(area), thickness, lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('areaW').value     = '3';
  document.getElementById('areaH').value     = '3';
  document.getElementById('thickness').value = '20';
  document.getElementById('lossRate').value  = '10';
  document.getElementById('areaWUnit').value    = 'm';
  document.getElementById('areaHUnit').value    = 'm';
  document.getElementById('thicknessUnit').value = 'mm';
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(count, area, thickness, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'foam-spray',
    calcName: '우레탄폼 스프레이폼[소량] 소요량 계산기',
    url: 'foam-spray.html',
    resultLabel: `${count}캔 필요`,
    params: {
      areaW:         document.getElementById('areaW').value,
      areaWUnit:     document.getElementById('areaWUnit').value,
      areaH:         document.getElementById('areaH').value,
      areaHUnit:     document.getElementById('areaHUnit').value,
      thickness:     document.getElementById('thickness').value,
      thicknessUnit: document.getElementById('thicknessUnit').value,
      lossRate:      document.getElementById('lossRate').value,
    },
    detail: [
      { key: '시공 면적', val: `${area} ㎡` },
      { key: '시공 두께', val: `${thickness} mm` },
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