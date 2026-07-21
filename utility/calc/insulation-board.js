/* ENERGUARD LAB - 판상형 단열재 수량 계산기 */

'use strict';

function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm') return v * 1000;
  return v;
}

function mm2ToM2(mm2) {
  return mm2 / 1_000_000;
}

function roundTo(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

let radios;
let deductionInputs;
let deductCount = 0;

function addDeductCard() {
  const list = document.getElementById('deductionList');
  deductCount += 1;
  const idx = deductCount;
  const card = document.createElement('div');
  card.className = 'deduct-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <div class="deduct-card-header">
      <span class="deduct-card-title">차감 면적 #${idx}</span>
      <div class="deduct-card-actions">
        <button class="btn-deduct-add" type="button">추가</button>
        <button class="btn-deduct-remove" type="button">삭제</button>
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

function refreshDeductButtons() {
  const list = document.getElementById('deductionList');
  const cards = list.querySelectorAll('.deduct-card');

  cards.forEach((card, i) => {
    const btnAdd = card.querySelector('.btn-deduct-add');
    btnAdd.style.display = i === cards.length - 1 ? 'inline-flex' : 'none';
    btnAdd.onclick = () => addDeductCard();

    const btnRemove = card.querySelector('.btn-deduct-remove');
    btnRemove.onclick = () => {
      card.remove();
      deductCount -= 1;
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

function renumberDeductCards() {
  document.querySelectorAll('.deduct-card').forEach((card, i) => {
    card.querySelector('.deduct-card-title').textContent = `차감 면적 #${i + 1}`;
    card.dataset.idx = i + 1;
  });
}

function calculate() {
  const wallWidthMm = toMm(document.getElementById('wallWidth').value, document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const boardWidthMm = toMm(document.getElementById('boardWidth').value, document.getElementById('boardWidthUnit').value);
  const boardHeightMm = toMm(document.getElementById('boardHeight').value, document.getElementById('boardHeightUnit').value);
  const lossRate = parseFloat(document.getElementById('lossRate').value) || 0;

  if (!wallWidthMm || !wallHeightMm) {
    alert('벽체 가로 길이와 높이를 입력해 주세요.');
    return;
  }
  if (!boardWidthMm || !boardHeightMm) {
    alert('단열재 가로, 세로 길이를 입력해 주세요.');
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
      const name = `차감 면적 #${i + 1}`;
      if (w > 0 && h > 0) {
        deductAreaMm2 += w * h;
        deductDetails.push({ name, area: mm2ToM2(w * h) });
      }
    });
  }

  const netAreaMm2 = Math.max(0, totalAreaMm2 - deductAreaMm2);
  const netAreaM2 = mm2ToM2(netAreaMm2);
  const boardAreaMm2 = boardWidthMm * boardHeightMm;
  const boardAreaM2 = mm2ToM2(boardAreaMm2);
  const baseCount = netAreaM2 / boardAreaM2;
  const finalCount = Math.ceil(baseCount * (1 + lossRate / 100));

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const perPyeong = roundTo(boardAreaM2 > 0 ? 3.30579 / boardAreaM2 : 0, 1);
  const lossAreaM2 = roundTo(netAreaM2 * (1 + lossRate / 100), 2);
  const netM2display = roundTo(netAreaM2, 2);
  const extraCount = Math.max(0, finalCount - Math.ceil(baseCount));

  document.getElementById('resMainSub').textContent = `${netM2display} m²에 필요한 단열재 수량`;
  document.getElementById('resMainNum').textContent = finalCount;
  document.getElementById('resMainDesc').textContent = `할증률 ${lossRate}%, 여유분 ${extraCount}장 포함`;

  document.getElementById('resLossArea').textContent = `${lossAreaM2} m²`;
  document.getElementById('resBoardArea').textContent = `${roundTo(boardAreaM2, 2)} m²`;
  document.getElementById('resPerPyeong').textContent = `${perPyeong}장`;

  const noteEl = document.getElementById('resultNote');
  const deductNote = hasDeduct && deductDetails.length
    ? `차감 항목: ${deductDetails.map(d => `${d.name}(${roundTo(d.area)}m²)`).join(', ')} / `
    : '';
  noteEl.innerHTML = `
    ${deductNote}최종 수량 <strong>${finalCount}장</strong>은 할증률(${lossRate}%)을 포함한 주문 권장 수량입니다.
    <br>실제 현장 조건에 따라 필요한 수량은 달라질 수 있습니다.
  `;

  addHistory(finalCount, roundTo(netAreaM2), lossRate);
}

function resetAll() {
  document.getElementById('wallWidth').value = '3000';
  document.getElementById('wallHeight').value = '2400';
  document.getElementById('boardWidth').value = '900';
  document.getElementById('boardHeight').value = '1800';
  document.getElementById('lossRate').value = '5';
  document.querySelector('input[name="hasDeduction"][value="no"]').checked = true;
  deductionInputs.style.display = 'none';
  document.getElementById('deductionList').innerHTML = '';
  deductCount = 0;
  document.getElementById('resultPanel').style.display = 'none';
}

function addHistory(count, netArea, lossRate) {
  const historyApi = window.KankanHistory;
  if (!historyApi || historyApi.isRestoring) return;
  historyApi.save({
    id: 'insulation-board',
    calcName: '판상형 단열재 수량 계산기',
    url: 'insulation-board.html',
    resultLabel: `${count}장 필요`,
    params: {
      wallWidth: document.getElementById('wallWidth').value,
      wallWidthUnit: document.getElementById('wallWidthUnit').value,
      wallHeight: document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      boardWidth: document.getElementById('boardWidth').value,
      boardWidthUnit: document.getElementById('boardWidthUnit').value,
      boardHeight: document.getElementById('boardHeight').value,
      boardHeightUnit: document.getElementById('boardHeightUnit').value,
      lossRate: document.getElementById('lossRate').value,
    },
    detail: [
      { key: '순면적', val: `${netArea} m²` },
      { key: '할증률', val: `${lossRate}%` },
    ]
  });
  historyApi.renderPanel();
}

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

  if (window.KankanHistory) {
    window.KankanHistory.restoreForm();
    window.KankanHistory.renderPanel();
    window.KankanHistory.renderClearBtn();
  }
});
