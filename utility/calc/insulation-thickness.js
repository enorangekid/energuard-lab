/* ─────────────────────────────────────────
   칸칸 — 단열재 두께 계산기 (insulation-thickness.js)
   ───────────────────────────────────────── */

'use strict';

// ── 법적 허용 열관류율 기준표 ──
const standardTable = {
  central1: {
    wall:        { apt: { direct: 0.150, indirect: 0.210 }, non_apt: { direct: 0.170, indirect: 0.240 } },
    roof:        { common: { direct: 0.150, indirect: 0.210 } },
    floor:       { heat: { direct: 0.150, indirect: 0.210 }, no_heat: { direct: 0.170, indirect: 0.240 } },
    window:      { apt: { direct: 0.900, indirect: 1.300 }, non_apt_window: { direct: 1.300, indirect: 1.600 }, non_apt_door: { direct: 1.500, indirect: 1.900 } },
    fire_door:   { common: { direct: 1.400, indirect: 1.800 } },
  },
  central2: {
    wall:        { apt: { direct: 0.170, indirect: 0.240 }, non_apt: { direct: 0.240, indirect: 0.340 } },
    roof:        { common: { direct: 0.150, indirect: 0.210 } },
    floor:       { heat: { direct: 0.170, indirect: 0.240 }, no_heat: { direct: 0.200, indirect: 0.290 } },
    window:      { apt: { direct: 1.000, indirect: 1.500 }, non_apt_window: { direct: 1.500, indirect: 1.900 }, non_apt_door: { direct: 1.500, indirect: 1.900 } },
    fire_door:   { common: { direct: 1.400, indirect: 1.800 } },
  },
  south: {
    wall:        { apt: { direct: 0.220, indirect: 0.310 }, non_apt: { direct: 0.320, indirect: 0.450 } },
    roof:        { common: { direct: 0.180, indirect: 0.260 } },
    floor:       { heat: { direct: 0.220, indirect: 0.310 }, no_heat: { direct: 0.250, indirect: 0.350 } },
    window:      { apt: { direct: 1.200, indirect: 1.700 }, non_apt_window: { direct: 1.800, indirect: 2.200 }, non_apt_door: { direct: 1.800, indirect: 2.200 } },
    fire_door:   { common: { direct: 1.400, indirect: 1.800 } },
  },
  jeju: {
    wall:        { apt: { direct: 0.290, indirect: 0.410 }, non_apt: { direct: 0.410, indirect: 0.560 } },
    roof:        { common: { direct: 0.250, indirect: 0.350 } },
    floor:       { heat: { direct: 0.290, indirect: 0.410 }, no_heat: { direct: 0.330, indirect: 0.470 } },
    window:      { apt: { direct: 1.600, indirect: 2.000 }, non_apt_window: { direct: 2.200, indirect: 2.800 }, non_apt_door: { direct: 2.200, indirect: 2.800 } },
    fire_door:   { common: { direct: 1.400, indirect: 1.800 } },
  },
};

const interFloorU = 0.810;

// ── 단열재 열전도율 ──
const materials = {
  iso_s:       0.027,
  xps_1:       0.028,
  eps_1_1:     0.036,
  eps_1_2:     0.037,
  eps_1_3:     0.040,
  eps_2_1:     0.031,
  eps_2_2:     0.032,
  eps_2_3:     0.033,
  eps_semi:    0.036,
  pir_1:       0.024,
  pir_2:       0.023,
  pir_semi:    0.023,
  pf_lx:       0.020,
  pf_dom:      0.022,
  min_wool:    0.036,
  glass_wool:  0.036,
  manual:      0,
};

// ── UI 업데이트 ──
function updateUI() {
  const part = document.getElementById('part').value;
  const housingType = document.getElementById('housingType').value;

  const optExposure   = document.getElementById('opt-exposure');
  const optHousing    = document.getElementById('opt-housing');
  const optHeating    = document.getElementById('opt-heating');
  const optWindowType = document.getElementById('opt-window-type');
  const rowSubOptions = document.getElementById('row-sub-options');

  // 전체 초기화
  [optExposure, optHousing, optHeating, optWindowType].forEach(el => el.style.display = 'none');

  if (part === 'wall') {
    optExposure.style.display = '';
    optHousing.style.display  = '';
  } else if (part === 'roof') {
    optExposure.style.display = '';
  } else if (part === 'floor') {
    optExposure.style.display = '';
    optHeating.style.display  = '';
  } else if (part === 'inter_floor') {
    // 추가 옵션 없음
  } else if (part === 'window') {
    optExposure.style.display = '';
    optHousing.style.display  = '';
    if (housingType === 'non_apt') {
      optWindowType.style.display = '';
    }
  } else if (part === 'fire_door') {
    optExposure.style.display = '';
  }

  // 하위 옵션 행 표시 여부
  const anySubVisible = optHeating.style.display !== 'none' || optWindowType.style.display !== 'none';
  rowSubOptions.style.display = anySubVisible ? '' : 'none';

  updateUValue();
}

// ── U값 업데이트 ──
function updateUValue() {
  const region      = document.getElementById('region').value;
  const part        = document.getElementById('part').value;
  const exposure    = document.getElementById('exposure').value;
  const housingType = document.getElementById('housingType').value;
  const heatingType = document.getElementById('heatingType').value;
  const windowType  = document.getElementById('windowType').value;

  let uValue = 0;

  if (part === 'inter_floor') {
    uValue = interFloorU;
  } else {
    const data = standardTable[region][part];
    if (part === 'wall') {
      uValue = data[housingType][exposure];
    } else if (part === 'floor') {
      uValue = data[heatingType][exposure];
    } else if (part === 'roof' || part === 'fire_door') {
      uValue = data['common'][exposure];
    } else if (part === 'window') {
      if (housingType === 'apt') {
        uValue = data['apt'][exposure];
      } else {
        const key = windowType === 'window' ? 'non_apt_window' : 'non_apt_door';
        uValue = data[key][exposure];
      }
    }
  }

  document.getElementById('targetU').value = uValue.toFixed(3);
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 단열재 커스텀 드롭다운 (그룹 헤더 포함) ──
function initMaterialSelect() {
  initCustomSelect('materialWrap', 'materialBtn', 'materialList', 'material', () => updateConductivity());
}

// ── 열전도율 업데이트 ──
function updateConductivity() {
  const m = document.getElementById('material').value;
  const input = document.getElementById('conductivity');
  if (m === 'manual') {
    input.readOnly = false;
    input.value = '';
    input.placeholder = '예: 0.034';
    input.focus();
  } else {
    input.readOnly = true;
    input.value = materials[m].toFixed(3);
  }
  document.getElementById('resultPanel').style.display = 'none';
}

// ── 계산하기 ──
function calculate() {
  const uValue = parseFloat(document.getElementById('targetU').value);
  const kValue = parseFloat(document.getElementById('conductivity').value);

  if (!uValue || !kValue) {
    alert('입력 값을 확인해주세요.');
    return;
  }

  const thicknessExact = (kValue / uValue) * 1000;
  const thicknessFinal = Math.ceil(thicknessExact / 5) * 5;

  const materialName = document.getElementById('materialBtn').querySelector('span').textContent.trim();
  const partName     = document.getElementById('partBtn').querySelector('span').textContent.trim();
  const regionName   = document.getElementById('regionBtn').querySelector('span').textContent.trim();

  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('resMainSub').textContent  = `${regionName} · ${partName}`;
  document.getElementById('resMainNum').textContent  = thicknessFinal;
  document.getElementById('resMainDesc').textContent = materialName;

  document.getElementById('resExact').textContent       = `${thicknessExact.toFixed(1)} mm`;
  document.getElementById('resUValue').textContent      = `${uValue.toFixed(3)} W/㎡K`;
  document.getElementById('resConductivity').textContent = `${kValue.toFixed(3)} W/mK`;

  document.getElementById('resultNote').innerHTML = `
    ※ 정확한 계산값 ${thicknessExact.toFixed(1)}mm를 5mm 단위로 올림 처리한 수치입니다. 실제 제품 구매 시 해당 두께 이상인 10mm 단위 제품을 선택하세요.<br/>
    ※ 콘크리트 등 구조체와 외·내부 열저항은 포함되지 않으며, 이를 고려할 경우 약간의 오차가 발생할 수 있습니다.
  `;

  addHistory(thicknessFinal, thicknessExact, regionName, partName, materialName, uValue, kValue);
}

// ── 초기화 ──
function resetAll() {
  // hidden input 값 리셋
  document.getElementById('region').value      = 'central2';
  document.getElementById('part').value        = 'wall';
  document.getElementById('exposure').value    = 'direct';
  document.getElementById('housingType').value = 'apt';
  document.getElementById('heatingType').value = 'heat';
  document.getElementById('windowType').value  = 'window';

  // 각 드롭다운 버튼 텍스트 + active 리셋
  const resetSelect = (btnId, listId, defaultVal) => {
    const list = document.getElementById(listId);
    list.querySelectorAll('.custom-select-item').forEach(i => {
      i.classList.toggle('active', i.dataset.value === defaultVal);
    });
    const activeItem = list.querySelector(`.custom-select-item[data-value="${defaultVal}"]`);
    if (activeItem) {
      document.getElementById(btnId).querySelector('span').textContent = activeItem.textContent.trim();
    }
  };

  resetSelect('regionBtn',      'regionList',      'central2');
  resetSelect('partBtn',        'partList',        'wall');
  resetSelect('exposureBtn',    'exposureList',    'direct');
  resetSelect('housingTypeBtn', 'housingTypeList', 'apt');
  resetSelect('heatingTypeBtn', 'heatingTypeList', 'heat');
  resetSelect('windowTypeBtn',  'windowTypeList',  'window');

  // 단열재 커스텀 드롭다운 리셋
  const hidden = document.getElementById('material');
  hidden.value = 'iso_s';
  const list = document.getElementById('materialList');
  list.querySelectorAll('.custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === 'iso_s');
  });
  document.getElementById('materialBtn').querySelector('span').textContent = '아이소핑크 특호 (0.027)';

  document.getElementById('conductivity').readOnly = true;
  document.getElementById('conductivity').value = '0.027';
  document.getElementById('resultPanel').style.display = 'none';
  updateUI();
}

// ── 히스토리 ──
function addHistory(final, exact, region, part, material, uValue, kValue) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'insulation-thickness',
    calcName: '단열재 두께 계산기',
    url: 'insulation-thickness.html',
    resultLabel: `${final}mm 이상`,
    params: {
      region:      document.getElementById('region').value,
      part:        document.getElementById('part').value,
      exposure:    document.getElementById('exposure').value,
      housingType: document.getElementById('housingType').value,
      heatingType: document.getElementById('heatingType').value,
      windowType:  document.getElementById('windowType').value,
      material:    document.getElementById('material').value,
      conductivity: document.getElementById('conductivity').value,
    },
    detail: [
      { key: '지역/부위', val: `${region} · ${part}` },
      { key: '자재',      val: material },
      { key: '계산값',    val: `${exact.toFixed(1)}mm` },
    ]
  });
  KankanHistory.renderPanel();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  // 커스텀 드롭다운 초기화
  initCustomSelect('regionWrap',      'regionBtn',      'regionList',      'region',      () => updateUI());
  initCustomSelect('partWrap',        'partBtn',        'partList',        'part',        () => updateUI());
  initCustomSelect('exposureWrap',    'exposureBtn',    'exposureList',    'exposure',    () => updateUValue());
  initCustomSelect('housingTypeWrap', 'housingTypeBtn', 'housingTypeList', 'housingType', () => updateUI());
  initCustomSelect('heatingTypeWrap', 'heatingTypeBtn', 'heatingTypeList', 'heatingType', () => updateUValue());
  initCustomSelect('windowTypeWrap',  'windowTypeBtn',  'windowTypeList',  'windowType',  () => updateUValue());
  initMaterialSelect();

  // 외부 클릭 시 모든 드롭다운 닫기
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-wrap').forEach(w => w.classList.remove('open'));
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