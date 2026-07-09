/* ─────────────────────────────────────────
   칸칸 — 석고보드 수량 계산기 (gypsum.js)
   ───────────────────────────────────────── */

'use strict';

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return v * 10;
  if (unit === 'm')  return v * 1000;
  return v; // mm
}

// ── mm² → m² 변환 ──
function mm2ToM2(mm2) {
  return mm2 / 1_000_000;
}

// ── 소수 반올림 ──
function r(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ── 차감 라디오 토글 ──
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
    // + 추가: 마지막 카드에만 표시
    const btnAdd = card.querySelector('.btn-deduct-add');
    btnAdd.style.display = (i === cards.length - 1) ? 'inline-flex' : 'none';

    btnAdd.onclick = () => addDeductCard();

    // − 삭제
    const btnRemove = card.querySelector('.btn-deduct-remove');
    btnRemove.onclick = () => {
      card.remove();
      deductCount--;
      renumberDeductCards();
      refreshDeductButtons();
      // 전부 삭제되면 "아니오"로 복귀
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
  // 입력값 수집
  const wallWidthMm  = toMm(document.getElementById('wallWidth').value,  document.getElementById('wallWidthUnit').value);
  const wallHeightMm = toMm(document.getElementById('wallHeight').value, document.getElementById('wallHeightUnit').value);
  const boardWidthMm  = toMm(document.getElementById('boardWidth').value,  document.getElementById('boardWidthUnit').value);
  const boardHeightMm = toMm(document.getElementById('boardHeight').value, document.getElementById('boardHeightUnit').value);
  const layers   = parseInt(document.getElementById('layers').value) || 1;
  const lossRate = parseFloat(document.getElementById('lossRate').value) || 0;

  // 유효성
  if (!wallWidthMm || !wallHeightMm) {
    alert('가벽 가로 길이와 높이를 입력해주세요.');
    return;
  }
  if (!boardWidthMm || !boardHeightMm) {
    alert('석고보드 가로, 세로 길이를 입력해주세요.');
    return;
  }

  // 전체 시공 면적 (mm²)
  const totalAreaMm2 = wallWidthMm * wallHeightMm;

  // 차감 면적 합산
  let deductAreaMm2 = 0;
  const hasDeduct = document.querySelector('input[name="hasDeduction"]:checked').value === 'yes';
  const deductDetails = [];

  if (hasDeduct) {
    document.querySelectorAll('.deduct-card').forEach((card, i) => {
      const w = toMm(card.querySelector('.deduct-w').value, card.querySelector('.deduct-unit-w').value);
      const h = toMm(card.querySelector('.deduct-h').value, card.querySelector('.deduct-unit-h').value);
      const name = `차감면적 #${i + 1}`;
      if (w > 0 && h > 0) {
        deductAreaMm2 += w * h;
        deductDetails.push({ name, area: mm2ToM2(w * h) });
      }
    });
  }

  // 순 면적
  const netAreaMm2  = Math.max(0, totalAreaMm2 - deductAreaMm2);
  const netAreaM2   = mm2ToM2(netAreaMm2);

  // 보드 1장 면적
  const boardAreaMm2 = boardWidthMm * boardHeightMm;
  const boardAreaM2  = mm2ToM2(boardAreaMm2);

  // 겹수 적용
  const layeredAreaM2 = netAreaM2 * layers;

  // 기본 수량 (할증 전)
  const baseCount = layeredAreaM2 / boardAreaM2;

  // 할증 적용
  const finalCount = Math.ceil(baseCount * (1 + lossRate / 100));

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // 평당 소요량 (1평 = 3.30579 m²)
  const perPyeong = r(boardAreaM2 > 0 ? (3.30579 / boardAreaM2) : 0, 1);
  // 할증 포함 면적
  const lossAreaM2 = r(layeredAreaM2 * (1 + lossRate / 100), 2);
  // 기준 면적 (순 시공 면적 표시)
  const netM2display = r(netAreaM2, 2);

  // 왼쪽 메인 카드
  document.getElementById('resMainSub').textContent  = `${netM2display} m²에 필요한 석고보드 수량`;
  document.getElementById('resMainNum').textContent  = finalCount;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${finalCount - Math.ceil(baseCount)}장 포함`;

  // 오른쪽 세부 카드
  document.getElementById('resLossArea').textContent   = `${lossAreaM2} m²`;
  document.getElementById('resBoardArea').textContent  = `${r(boardAreaM2, 2)} m²`;
  document.getElementById('resPerPyeong').textContent  = `${perPyeong}장`;

  // 결과 노트
  const noteEl = document.getElementById('resultNote');
  const deductNote = hasDeduct && deductDetails.length
    ? `차감 항목: ${deductDetails.map(d => `${d.name}(${r(d.area)}m²)`).join(', ')} / `
    : '';
  noteEl.innerHTML = `
    ※ ${deductNote}최종 수량 <strong>${finalCount}장</strong>은 할증(${lossRate}%)을 포함한 발주 권장 수량입니다.
    ${layers > 1 ? `<br/>※ ${layers}겹 시공 기준으로 계산되었습니다.` : ''}
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
  `;

  // 히스토리 추가
  addHistory(finalCount, r(netAreaM2), layers, lossRate);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value   = '3000';
  document.getElementById('wallHeight').value  = '2400';
  document.getElementById('boardWidth').value  = '900';
  document.getElementById('boardHeight').value = '1800';
  document.getElementById('layers').value      = '1';
  document.getElementById('lossRate').value    = '5';
  document.querySelector('input[name="hasDeduction"][value="no"]').checked = true;
  deductionInputs.style.display = 'none';
  document.getElementById('deductionList').innerHTML = '';
  deductCount = 0;
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(count, netArea, layers, lossRate) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'gypsum',
    calcName: '석고보드 수량 계산기',
    url: 'gypsum.html',
    resultLabel: `${count}장 필요`,
    params: {
      wallWidth:    document.getElementById('wallWidth').value,
      wallWidthUnit:  document.getElementById('wallWidthUnit').value,
      wallHeight:   document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      boardWidth:   document.getElementById('boardWidth').value,
      boardWidthUnit:  document.getElementById('boardWidthUnit').value,
      boardHeight:  document.getElementById('boardHeight').value,
      boardHeightUnit: document.getElementById('boardHeightUnit').value,
      layers:       document.getElementById('layers').value,
      lossRate:     document.getElementById('lossRate').value,
    },
    detail: [
      { key: '순 면적',   val: `${netArea} m²` },
      { key: '시공 겹수', val: `${layers}겹` },
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