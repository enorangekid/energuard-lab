/* ─────────────────────────────────────────
   칸칸 — 단열벽지 소요량 계산기 (thermal-wallpaper.js)
   폭 1000mm(1M) 고정 롤형 제품 → 필요 길이(m) 산출
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

// ── 무늬 라벨 맵 ──
const PATTERN_LABEL = {
  oxford:     '옥스포드 시리즈',
  clay:       '클레이 시리즈',
  modernline: '모던라인 시리즈',
};

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
  const lossRate     = parseFloat(document.getElementById('lossRate').value) || 0;
  const patternType  = document.getElementById('patternType').value;

  // 제품 폭 1000mm(1M) 고정
  const ROLL_WIDTH_M = 1.0;

  if (!wallWidthMm || !wallHeightMm) {
    alert('벽체 가로 길이와 높이를 입력해주세요.');
    return;
  }

  // 전체 면적
  const totalAreaMm2 = wallWidthMm * wallHeightMm;

  // 차감 면적
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

  // 순 면적 (m²)
  const netAreaMm2 = Math.max(0, totalAreaMm2 - deductAreaMm2);
  const netAreaM2  = mm2ToM2(netAreaMm2);

  // 필요 길이 = 순 면적 ÷ 제품 폭(1.0M)
  const baseLength  = netAreaM2 / ROLL_WIDTH_M;

  // 할증 적용 → 소수점 1자리 올림
  const finalLength = Math.ceil(baseLength * (1 + lossRate / 100) * 10) / 10;

  // 결과 렌더링
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const netM2display  = r(netAreaM2, 2);
  const lossLengthM   = r(baseLength * (1 + lossRate / 100), 1);
  // 평당 소요량: 1평(3.30579m²) ÷ 폭 1.0M
  const perPyeong     = r(3.30579 / ROLL_WIDTH_M, 1);
  const patternLabel  = PATTERN_LABEL[patternType] || patternType;

  document.getElementById('resMainSub').textContent  = `${netM2display} m²에 필요한 단열벽지 길이 (${patternLabel})`;
  document.getElementById('resMainNum').textContent  = finalLength;
  document.getElementById('resMainDesc').textContent = `할증율 ${lossRate}%, ${r(finalLength - r(baseLength, 1), 1)}m 포함`;

  document.getElementById('resLossArea').textContent  = `${r(netAreaM2 * (1 + lossRate / 100), 2)} m²`;
  document.getElementById('resBoardArea').textContent = `${netM2display} m²`;
  document.getElementById('resPerPyeong').textContent = `${perPyeong}m`;

  const noteEl = document.getElementById('resultNote');
  const deductNote = hasDeduct && deductDetails.length
    ? `차감 항목: ${deductDetails.map(d => `${d.name}(${r(d.area)}m²)`).join(', ')} / `
    : '';
  noteEl.innerHTML = `
    ※ ${deductNote}최종 수량 <strong>${finalLength}m</strong>은 할증(${lossRate}%)을 포함한 발주 권장 길이입니다. (제품 폭 1000mm 기준 / ${patternLabel})
    <br/>※ 패턴 무늬(옥스포드·클레이·모던라인) 시공 시 이음매 맞춤 로스가 추가 발생할 수 있습니다.
    <br/>※ 실제 현장 조건에 따라 수량이 달라질 수 있습니다.
  `;

  addHistory(finalLength, netM2display, lossRate, patternLabel);
}

// ── 초기화 ──
function resetAll() {
  document.getElementById('wallWidth').value  = '3000';
  document.getElementById('wallHeight').value = '2400';
  document.getElementById('lossRate').value   = '10';
  document.getElementById('patternType').value = 'oxford';
  document.getElementById('patternTypeText').textContent = '옥스포드 시리즈';
  document.querySelectorAll('#patternTypeList .custom-select-item').forEach(el =>
    el.classList.toggle('active', el.dataset.value === 'oxford')
  );
  document.querySelector('input[name="hasDeduction"][value="no"]').checked = true;
  deductionInputs.style.display = 'none';
  document.getElementById('deductionList').innerHTML = '';
  deductCount = 0;
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 히스토리 ──
function addHistory(length, netArea, lossRate, patternLabel) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'thermal-wallpaper',
    calcName: '단열벽지 소요량 계산기',
    url: 'thermal-wallpaper.html',
    resultLabel: `${length}m 필요`,
    params: {
      wallWidth:     document.getElementById('wallWidth').value,
      wallWidthUnit: document.getElementById('wallWidthUnit').value,
      wallHeight:    document.getElementById('wallHeight').value,
      wallHeightUnit: document.getElementById('wallHeightUnit').value,
      lossRate:      document.getElementById('lossRate').value,
      patternType:   document.getElementById('patternType').value,
    },
    detail: [
      { key: '순 면적', val: `${netArea} m²` },
      { key: '무늬',    val: patternLabel },
      { key: '제품 폭', val: '1050mm 고정' },
      { key: '할증률',  val: `${lossRate}%` },
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