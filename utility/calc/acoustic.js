/* ─────────────────────────────────────────
   칸칸 — 방음/흡음재 수량 계산기 (acoustic.js)
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

// ── 차감 면적 토글 ──
let radios;
let deductionInputs;
let deductCount = 0;

// ── 차감 카드 생성 ──
function addDeductCard() {
  const list = document.getElementById('deductionList');
  deductCount++;
  const idx = deductCount;
  const card = document.createElement('div');
  card.className = 'deduct-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <div class="deduct-card-header">
      <span class="deduct-card-title">차감면적 #${idx}</span>
      <div class="deduct-card-actions">
        <button class="btn-deduct-add" type="button">+ 추가</button>
        <button class="btn-deduct-remove" type="button">− 삭제</button>
      </div>
    </div>
    <div class="deduct-card-body">
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">가로</label>
          <div class="field-input-wrap">
            <input type="number" class="field-input deduct-w" placeholder="0" min="0" step="1" />
            <div class="unit-select-wrap">
              <select class="unit-select deduct-unit-w">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </div>
        </div>
        <div class="field-dot">×</div>
        <div class="field-group">
          <label class="field-label">세로</label>
          <div class="field-input-wrap">
            <input type="number" class="field-input deduct-h" placeholder="0" min="0" step="1" />
            <div class="unit-select-wrap">
              <select class="unit-select deduct-unit-h">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  list.appendChild(card);
  refreshDeductButtons();
}

// ── 버튼 이벤트 갱신 ──
function refreshDeductButtons() {
  const list = document.getElementById('deductionList');
  const cards = list.querySelectorAll('.deduct-card');
  cards.forEach((card, i) => {
    const btnAdd = card.querySelector('.btn-deduct-add');
    btnAdd.style.display = (i === cards.length - 1) ? 'inline-flex' : 'none';
    btnAdd.onclick = () => addDeductCard();

    const btnRemove = card.querySelector('.btn-deduct-remove');
    btnRemove.onclick = () => {
      card.remove();
      deductCount--;
      renumberDeductCards();
      refreshDeductButtons();
      if (document.querySelectorAll('.deduct-card').length === 0) {
        document.querySelector('input[name="hasDeduction"][value="no"]').checked = true;
        deductionInputs.style.display = 'none';
        deductCount = 0;
      }
    };
  });
}

// ── 번호 재정렬 ──
function renumberDeductCards() {
  document.querySelectorAll('.deduct-card').forEach((card, i) => {
    card.querySelector('.deduct-card-title').textContent = `차감면적 #${i + 1}`;
    card.dataset.idx = i + 1;
  });
}

// ── 계산하기 ──
function calculate() {
  const wallWidthMm  = toMm(document.getElementById('wallWidth').value,  document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const matWidthMm   = toMm(document.getElementById('matWidth').value,   document.getElementById('matWidthUnit').value);
  const matHeightMm  = toMm(document.getElementById('matHeight').value,  document.getElementById('matHeightUnit').value);
  const lossRate     = parseFloat(document.getElementById('lossRate').value) || 0;

  if (!wallWidthMm || !wallHeightMm) {
    alert('시공 면적 가로, 세로를 입력해주세요.');
    return;
  }
  if (!matWidthMm || !matHeightMm) {
    alert('흡음재 가로, 세로를 입력해주세요.');
    return;
  }

  const totalAreaMm2 = wallWidthMm * wallHeightMm;

  let deductAreaMm2 = 0;
  const hasDeduct = document.querySelector('input[name="hasDeduction"]:checked').value === 'yes';
  const deductDetails = [];

  if (hasDeduct) {
    document.querySelectorAll('.deduct-card').forEach((card, i) => {
      const w = toMm(card.querySelector('.deduct-w').value, card.querySelector('.deduct-unit-w').value);
      const h = toMm(card.querySelector('.deduct-h').value, card.querySelector('.deduct-unit-h').value);
      if (w > 0 && h > 0) {
        deductAreaMm2 += w * h;
        deductDetails.push({ name: `차감면적 #${i + 1}`, area: r(mm2ToM2(w * h)) });
      }
    });
  }

  const netAreaMm2 = Math.max(0, totalAreaMm2 - deductAreaMm2);
  const netAreaM2  = mm2ToM2(netAreaMm2);
  const matAreaMm2 = matWidthMm * matHeightMm;
  const matAreaM2  = mm2ToM2(matAreaMm2);
  const totalPcs   = Math.ceil((netAreaM2 / matAreaM2) * (1 + lossRate / 100));
  const perSqm     = r(1 / matAreaM2, 2);

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${r(netAreaM2)} m² 시공에 필요한 수량`;
  document.getElementById('resMainNum').textContent  = totalPcs;
  document.getElementById('resMainDesc').textContent = `할증 ${lossRate}% · ${totalPcs - Math.ceil(netAreaM2 / matAreaM2)}장 포함`;
  document.getElementById('resNetArea').textContent  = `${r(netAreaM2)} m²`;
  document.getElementById('resMatArea').textContent  = `${r(matAreaM2, 4)} m²`;
  document.getElementById('resPerSqm').textContent   = `${perSqm}장`;

  const deductNote = hasDeduct && deductDetails.length
    ? `차감 항목: ${deductDetails.map(d => `${d.name}(${d.area}m²)`).join(', ')} / `
    : '';

  document.getElementById('resultNote').innerHTML = `
    ※ ${deductNote}최종 수량 <strong>${totalPcs}장</strong>은 할증(${lossRate}%)을 포함한 발주 권장 수량입니다.<br/>
    ※ 실제 현장 조건(재단 로스, 모서리 처리 등)에 따라 수량이 달라질 수 있습니다.
  `;

  addHistory(totalPcs, r(netAreaM2), lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value   = '3000';
  document.getElementById('wallHeight').value  = '2400';
  document.getElementById('matWidth').value    = '500';
  document.getElementById('matHeight').value   = '500';
  document.getElementById('lossRate').value    = '5';
  document.querySelector('input[name="hasDeduction"][value="no"]').checked = true;
  deductionInputs.style.display = 'none';
  document.getElementById('deductionList').innerHTML = '';
  deductCount = 0;
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(pcs, netArea, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'acoustic',
    calcName: '방음/흡음재 수량 계산기',
    url: 'calc/acoustic.html',
    resultLabel: `${pcs}장 필요`,
    params: {
      wallWidth:      document.getElementById('wallWidth').value,
      wallWidthUnit:  document.getElementById('wallWidthUnit').value,
      wallHeight:     document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      matWidth:       document.getElementById('matWidth').value,
      matWidthUnit:   document.getElementById('matWidthUnit').value,
      matHeight:      document.getElementById('matHeight').value,
      matHeightUnit:  document.getElementById('matHeightUnit').value,
      lossRate:       document.getElementById('lossRate').value,
    },
    detail: [
      { key: '시공 면적', val: `${netArea} m²` },
      { key: '할증률',    val: `${lossRate}%` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  radios = document.querySelectorAll('input[name="hasDeduction"]');
  deductionInputs = document.getElementById('deductionInputs');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'yes') {
        deductionInputs.style.display = 'block';
        if (deductCount === 0) addDeductCard();
      } else {
        deductionInputs.style.display = 'none';
      }
    });
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