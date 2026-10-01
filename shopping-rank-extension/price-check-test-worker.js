(()=>{
const BEAD_ROWS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300];
const BEAD_FB = (() => {
  const fb = {};
  const m2 = [85,75,65,55,45,40,35,35,35,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30];
  const m1 = [75,65,55,45,35,30,25,25,25,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20];
  const mj = [80,70,60,50,35,35,35,35,35,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30];
  BEAD_ROWS.forEach((t, i) => {
    fb[`bead_m2_3_t${t}`] = m2[i]; fb[`bead_m2_2_t${t}`] = m2[i]; fb[`bead_m2_1_t${t}`] = m2[i];
    fb[`bead_m1_3_t${t}`] = m1[i]; fb[`bead_m1_2_t${t}`] = m1[i]; fb[`bead_m1_1_t${t}`] = m1[i];
    fb[`bead_mj_t${t}`]   = mj[i];
  });
  return fb;
})();
const BEAD_MARGIN_KEY_MAP = {
  ia1: 'bead_m2_3', iia1: 'bead_m2_2', iiia2: 'bead_m2_1',
  ia2: 'bead_m1_3', iia2: 'bead_m1_2', iiib: 'bead_m1_1',
};
const PU_FB = {
  ic:    {40:100,50:90,60:70,70:55,80:50,90:45,100:35,110:35,120:35,130:35,140:35,150:35,160:35,170:35,180:35,190:35,200:35,210:35,220:35,230:35},
  iiia:  {30:45,40:95,50:85,60:65,70:50,80:45,90:40,100:30,110:30,120:30,130:30,140:30,150:30,160:30,170:30,180:30,190:30,200:30,210:30,220:30,230:30},
  iia:   {30:40,40:42,50:35,60:35,70:30,80:30,90:30,100:22,110:22,120:22,130:22,140:22,150:22,160:25,170:25,180:25,190:25,200:25,210:25,220:22,230:25,240:40,250:40,260:40},
  id_in: {30:100,40:100,50:45,60:40,70:40,80:35,90:35,100:35,110:35,120:35,130:35,140:35,150:35,160:35,170:35,180:35,190:35,200:35,210:35,220:35},
  id_out:{50:85,60:80,70:75,80:75,90:70,100:70,110:70,120:70,130:70,140:70,150:70,160:70,170:70,180:70,190:70,200:70,210:70,220:70},
};
const PF_FB = {
  lxo:{50:35,60:35,70:35,80:35,90:35,100:35,110:35,120:35,130:35,140:35,150:35,160:35,170:35,180:35,190:35,200:35,210:35,220:35},
  lxi:{50:45,60:45,70:45,80:45,90:45,100:45,110:45,120:45,130:45,140:45,150:45,160:45,170:45,180:45,190:45,200:45,210:45,220:45},
  kdo:{50:30,60:30,70:30,80:30,90:30,100:30,110:30,120:30,130:30,140:30,150:30,160:30,170:30,180:30,190:30,200:30,210:30,220:30},
  kdi:{50:40,60:30,70:30,80:30,90:30,100:30,110:30,120:30,130:30,140:30,150:30,160:30,170:30,180:30,190:30,200:30,210:30,220:30},
  imo:{50:35,60:35,70:35,80:35,90:35,100:35,110:35,120:35,130:35,140:35,150:35,160:35,170:35,180:35,190:35,200:35,210:35,220:35},
  imi:{50:50,60:50,70:40,80:40,90:40,100:40,110:40,120:40,130:40,140:40,150:40,160:40,170:40,180:40,190:40,200:40,210:40,220:40},
};
const FR_FB = { fr_bul:{40:3000,50:4000,60:4000,70:5000}, fr_jun:{40:3000,50:4000} };
const FR_COST_DEF = { fr_bul:{40:7000,50:9000,60:13000,70:13000}, fr_jun:{40:12600,50:15000} };

function getVal(obj, key, fallback) {
  const v = obj?.[key];
  return (v != null) ? v : fallback;
}
function calcRealPrice(costPerM2, marginPerM2, t, area) {
  if (!costPerM2) return null;
  const sellPerSheet = Math.round((costPerM2 + marginPerM2) * t * area * 1.1);
  return Math.ceil(sellPerSheet / 100) * 100;
}
const ISO_DEFS = {10:35,20:70,30:60,40:60,50:60,60:60,70:60,80:60,90:60,100:60,110:60,120:60,130:60,140:60,150:60,160:60,170:60,180:60,190:55,200:55,210:55,220:55,230:55,240:55,250:55,260:55,270:55,280:55,290:55,300:55};
// 2026-09-08: 아이소핑크 1호 신설(커밋 248a760) 이후 특호(grade_id='isopink')와 원가/마진
// 필드가 t>=30 구간에서 갈라졌다 — gradeId를 안 받고 무조건 특호 필드만 보고 있어서
// 1호 매핑이 생기면 계속 특호 가격으로 잘못 계산할 뻔했다. gradeId로 분기.
function calcIsoRealPrice(data, t, gradeId) {
  const margins = data.margins || {};
  const is1ho = gradeId === '1ho';
  let cost;
  if (t <= 15) cost = data.cost_900_1800_thin1 || 0;
  else if (t <= 25) cost = data.cost_900_1800_thin2 || 0;
  else if (t <= 180) cost = (is1ho ? data.cost_900_1800_1ho_mid : data.cost_900_1800_mid) || 0;
  else cost = (is1ho ? data.cost_900_1800_1ho_thick : data.cost_900_1800_thick) || 0;
  if (!cost) return null;
  const marginKey = (is1ho && t >= 30) ? `margin_iso_1ho_t${t}` : `margin_iso_t${t}`;
  const margin = getVal(margins, marginKey, ISO_DEFS[t] ?? 55);
  return Math.ceil(Math.round(t * (cost + margin) * 1.1) / 100) * 100;
}
function calcFrRealPrice(costPerM2, marginPerSheet, area) {
  if (!costPerM2) return null;
  const costPerSheet = Math.round(costPerM2 * area);
  const sellPerSheet = costPerSheet + marginPerSheet;
  const vatSell = Math.round(sellPerSheet * 1.1);
  return Math.ceil(vatSell / 100) * 100;
}
// "동일가로만 맞춤" 오버라이드(pricing.js _getOverrideId와 동일 규칙) — 정수 마진으로
// 경쟁사가를 정확히 못 맞출 때 마진 계산 대신 가격 자체를 강제 고정해둔 값. 이 필드가
// 있으면 그게 진짜 표시가라 마진 계산을 건너뛰고 그대로 써야 한다(2026-09-08, 이 체커가
// 오버라이드를 전혀 안 보고 있어서 "동일가 맞춤" 걸린 행은 항상 불일치로 잡히던 문제).
function getOverrideId(type, gradeId, t) {
  if (type === 'iso') {
    // 1호 신설 전부터 등록된 product_mapping 행들은 grade_id를 비워두거나 다른 값을
    // 써도 무조건 특호로 취급하고 있었다(calcIsoRealPrice와 동일한 이유) — 여기서
    // gradeId==='isopink'만 정확히 일치해야 한다고 해뒀더니 그 행들만 오버라이드를
    // 못 찾아서 여전히 마진 계산값(실제보다 살짝 낮음)으로 나오고 있었다. 1호만
    // 명시적으로 걸러내고 나머지는 전부 특호로 처리하도록 통일.
    if (gradeId === '1ho') return t < 30 ? `iso_price_override_t${t}` : `iso_price_override_1ho_t${t}`;
    return `iso_price_override_t${t}`;
  }
  return `${type}_price_override_${gradeId}_t${t}`;
}
function getTablePrice(mapping, pricingData) {
  if (!mapping || !pricingData) return null;
  const { product_type: type, thickness: t, area } = mapping;
  if (!area) return null;
  const margins = pricingData.margins || {};
  // 아이소핑크는 기본 등급이 1호 — grade_id가 명시적으로 'isopink'(특호)가 아니면
  // (비어있음/null/'mix' 등 포함) 1호로 본다. 단품 목록 체크는 라벨이 없어서 이
  // 기본값이 곧 판정값이 된다(단품은 전부 1호 판매).
  const gradeId = (type === 'iso') ? (mapping.grade_id === 'isopink' ? 'isopink' : '1ho') : mapping.grade_id;

  const overrideId = getOverrideId(type, gradeId, t);
  const overrideVal = overrideId != null ? Number(margins[overrideId]) : NaN;
  if (Number.isFinite(overrideVal) && overrideVal > 0) return overrideVal;

  if (type === 'iso') return calcIsoRealPrice(pricingData, t, gradeId);

  if (type === 'bead') {
    const COST_MAP = { ia1:'bead_cost_ia1', iia1:'bead_cost_iia1', iiia2:'bead_cost_iiia2', ia2:'bead_cost_ia2', iia2:'bead_cost_iia2', iiib:'bead_cost_iiib', ib_09:'bead_cost_ib', ib_06:'bead_cost_ib' };
    const cost = pricingData[COST_MAP[gradeId]] || 0;
    const tKey = Math.min(300, Math.max(10, Math.round(t / 10) * 10));
    // 2026-09-08: 준불연(ib_09/ib_06)은 pricing.js에서 마진 필드를 규격별로 완전히
    // 독립시켰다(bead_mj_t{T} 공유 → bead_mj_ib_09_t{T}/bead_mj_ib_06_t{T} 분리,
    // 커밋 761c3e1) — 여기서 옛 공유 키만 보고 있어서 분리 이후 값이 바뀌어도 체커가
    // 계속 예전 값으로 계산해 실제 가격과 안 맞았다.
    const marginKey = (gradeId === 'ib_09' || gradeId === 'ib_06')
      ? `bead_mj_${gradeId}_t${tKey}`
      : `${BEAD_MARGIN_KEY_MAP[gradeId]}_t${tKey}`;
    const fallbackKey = (gradeId === 'ib_09' || gradeId === 'ib_06') ? `bead_mj_t${tKey}` : marginKey;
    const margin = getVal(margins, marginKey, getVal(margins, fallbackKey, BEAD_FB[fallbackKey] ?? 0));
    return calcRealPrice(cost, margin, t, area);
  }
  if (type === 'pu') {
    const BANDS = {
      ic:     [{min:40,max:45,id:'pu_cost_ic_b1'},{min:50,max:65,id:'pu_cost_ic_b2'},{min:70,max:300,id:'pu_cost_ic_b3'}],
      iiia:   [{min:30,max:35,id:'pu_cost_iiia_b1'},{min:40,max:45,id:'pu_cost_iiia_b2'},{min:50,max:65,id:'pu_cost_iiia_b3'},{min:70,max:230,id:'pu_cost_iiia_b4'}],
      iia:    [{min:30,max:35,id:'pu_cost_iia_b1'},{min:40,max:45,id:'pu_cost_iia_b2'},{min:50,max:65,id:'pu_cost_iia_b3'},{min:70,max:230,id:'pu_cost_iia_b4'},{min:235,max:260,id:'pu_cost_iia_b5'}],
      id_in:  [{min:30,max:30,id:'pu_cost_id_in_b1'},{min:40,max:40,id:'pu_cost_id_in_b2'},{min:50,max:70,id:'pu_cost_id_in_b3'},{min:80,max:225,id:'pu_cost_id_in_b4'}],
      id_out: [{min:50,max:60,id:'pu_cost_id_out_b1'},{min:70,max:220,id:'pu_cost_id_out_b2'}],
    };
    const band = (BANDS[gradeId] || []).find(b => t >= b.min && t <= b.max);
    if (!band) return null;
    const cost = pricingData[band.id] || 0;
    const marginKey = `pu_m_${gradeId}_t${t}`;
    const margin = getVal(margins, marginKey, PU_FB[gradeId]?.[t] ?? 0);
    return calcRealPrice(cost, margin, t, area);
  }
  if (type === 'pf') {
    const COST_MAP = { lxo_s:'pf_cost_lx_out',lxo_l:'pf_cost_lx_out', lxi_s:'pf_cost_lx_in',lxi_l:'pf_cost_lx_in', kdo_s:'pf_cost_kd_out',kdo_l:'pf_cost_kd_out', kdi_s:'pf_cost_kd_in',kdi_l:'pf_cost_kd_in', imo_s:'pf_cost_im_out',imo_l:'pf_cost_im_out', imi_s:'pf_cost_im_in',imi_l:'pf_cost_im_in' };
    const MK = { lxo_s:'lxo',lxo_l:'lxo', lxi_s:'lxi',lxi_l:'lxi', kdo_s:'kdo',kdo_l:'kdo', kdi_s:'kdi',kdi_l:'kdi', imo_s:'imo',imo_l:'imo', imi_s:'imi',imi_l:'imi' };
    const cost = pricingData[COST_MAP[gradeId]] || 0;
    const mk = MK[gradeId];
    // 2026-09-08: 소형(_s)/대형(_l) 마진도 pricing.js에서 완전히 독립시켰다(pf_m_{mk}_t{T}
    // 공유 → pf_m_{gradeId}_t{T} 분리, 커밋 761c3e1) — 옛 공유 키만 보던 걸 새 키 우선으로
    // 고치고, 없으면(마이그레이션 전 데이터) 옛 키로 폴백한다.
    const marginKey = `pf_m_${gradeId}_t${t}`;
    const legacyKey = `pf_m_${mk}_t${t}`;
    const margin = getVal(margins, marginKey, getVal(margins, legacyKey, PF_FB[mk]?.[t] ?? 35));
    return calcRealPrice(cost, margin, t, area);
  }
  if (type === 'fr') {
    const costKey = `fr_cost_${gradeId}_t${t}`;
    const costPerM2 = pricingData[costKey] || FR_COST_DEF[gradeId]?.[t] || 0;
    const marginKey = `fr_m_${gradeId}_t${t}`;
    const marginPerSheet = getVal(margins, marginKey, FR_FB[gradeId]?.[t] ?? 0);
    return calcFrRealPrice(costPerM2, marginPerSheet, area);
  }
  return null;
}

function extractThicknessMm(label) {
  // 시트 규격 표기(900x1800, 1000x2000 등)의 숫자가 두께로 잘못 잡히지 않게 먼저 지운다.
  const cleaned = String(label || '').replace(/\d+\s*[xX*×]\s*\d+/g, ' ');
  const m = cleaned.match(/(\d+)\s*T\b/i) || cleaned.match(/(\d+)\s*(?:mm|밀리|미리)\b/i);
  return m ? Number(m[1]) : null;
}

// 비드법은 모음전 엑셀(pricing.js _doBeadExport)이 등급까지 옵션축에 실어보낸다 — 등급이
// 상품 하나에 고정이 아니라 옵션마다 바뀐다. 그 export 로직을 기준(정답)으로 역파싱한다.
//   1jong/2jong: optionName1="비드법단열재 1종3호" 형태, optionName2="900x1800 30T"
//   junbul:      optionName1="심재준불연 비드법 단열재 30T", optionName2="600x1200"|"900x1800"
// (pricing.js BEAD_GRADES의 sub 필드와 정확히 일치해야 함 — 거기 값 바뀌면 여기도 같이 바꿀 것)
const BEAD_SUB_TO_GRADE_ID = {
  '2종 3호': 'ia1', '2종 2호': 'iia1', '2종 1호': 'iiia2',
  '1종 3호': 'ia2', '1종 2호': 'iia2', '1종 1호': 'iiib',
};
const BEAD_GRADE_AREA = { ia1: 1.62, iia1: 1.62, iiia2: 1.62, ia2: 1.62, iia2: 1.62, iiib: 1.62, ib_09: 1.62, ib_06: 0.72 };

// PF보드도 비드법과 마찬가지로 모음전 엑셀(pricing.js _doPfExport)이 옵션축 2개(두께+규격)를
// 쓴다 — 규격(600x1200 등 작은 사이즈 vs 큰 사이즈)에 따라 실제 등급(PF_GRADES의 _s/_l)이
// 갈린다. product_mapping에는 mk 접두어만 등록(예: 'lxo')하고, 규격 옵션값으로 _s/_l을
// 붙여 완성한다. 작은 사이즈는 전부 "600x1200"으로 동일 — 그 외 값이면 큰 사이즈로 간주.
const PF_GRADE_AREA = {
  lxo_s: 0.72, lxo_l: 2.4, lxi_s: 0.72, lxi_l: 2.4,
  kdo_s: 0.72, kdo_l: 2.4, kdi_s: 0.72, kdi_l: 2.4,
  imo_s: 0.72, imo_l: 1.2, imi_s: 0.72, imi_l: 1.2,
};

// ── 한국단열(hkdy) 몰별 적용 검사 ─────────────────────────────────────────
// 기대가격은 관리자 화면(단가표 몰별 적용 표)이 옵션마다 계산해서 넘겨준다 — 여기서 공식을 다시
// 구현하지 않는다. 여기서는 스토어 옵션 행과 우리 옵션을 짝지어 비교만 한다.
//   1) 옵션 관리코드 = 우리 상품코드
//   2) 옵션 이름(띄어쓰기·기호 무시) = 우리 상품명, 아니면 한쪽이 다른 쪽을 포함하는 후보가 딱 하나일 때
//   3) 스토어 옵션 1개·우리 옵션 1개면 그대로 짝
// 어느 것도 확실하지 않으면 추측하지 않고 "단가표에 없음"으로 남긴다.
function normalizeOptionText(text) {
  return String(text || '').toLowerCase().replace(/[×*]/g, 'x').replace(/[\s\/_\-(),.·:]+/g, '');
}
function matchHkdOptions(storeRows, options) {
  const claimed = new Set();
  const byCode = new Map();
  for (const o of options) { const key = o.code ? String(o.code).toLowerCase() : null; if (key && !byCode.has(key)) byCode.set(key, o); }
  const results = [];
  const single = storeRows.length === 1 && options.length === 1;
  for (const row of storeRows) {
    let option = null, source = null;
    const code = row.code ? String(row.code).toLowerCase() : null;
    // 코드 매칭은 다대일이다 — 스토어에서 같은 관리코드를 옵션 여러 개에 붙여 쓰는 경우(예: 이중화이트 색상 옵션
    // 수십 개가 전부 WP_DW_5_1)가 있어서, 이미 짝지어진 우리 옵션이라도 같은 코드의 스토어 행은 그 옵션의 가격과
    // 비교한다. (이름 매칭은 그대로 일대일 — 이름으로는 같은 옵션을 두 번 짝짓지 않는다.)
    if (code && byCode.has(code)) { option = byCode.get(code); source = '코드 매칭'; }
    if (!option) {
      const label = normalizeOptionText(row.label);
      const open = options.filter(o => !claimed.has(o));
      let candidates = label ? open.filter(o => normalizeOptionText(o.name) === label) : [];
      if (!candidates.length && label) candidates = open.filter(o => { const name = normalizeOptionText(o.name); return name && (name.includes(label) || label.includes(name)); });
      if (candidates.length === 1) { option = candidates[0]; source = '이름 매칭'; }
    }
    if (!option && single) { option = options[0]; source = '단일 옵션'; }
    // 즉시할인만 적용된 가격("상품 가격")으로 비교한다 — 한국단열 스토어는 판매가를 높게 적고 즉시할인을 거는
    // 상품이 많아서 할인 전 판매가로 비교하면 상품마다 할인액만큼 전부 틀어진다(2026-09-28 첫 실검사:
    // 439103571 +18,000, 439904706 +28,900). 반대로 최대할인가(알림받기·쿠폰까지 뺀 값)로 비교하면 쿠폰이
    // 걸린 상품이 틀어진다(5697937041 전 옵션 -2,000 — 알림쿠폰). 수집기가 즉시할인가를 못 찾으면
    // (instantPrice 없음) 예전처럼 최대할인가로 비교하고 그 사실을 표시한다.
    const hasInstant = Number.isFinite(row.instantPrice) && row.instantPrice > 0;
    const actual = hasInstant ? row.instantPrice : row.finalPrice;
    const priceKind = hasInstant ? '즉시할인가' : '쿠폰 포함가';
    const listPrice = Number.isFinite(row.salePrice) && row.salePrice !== actual ? row.salePrice : null;
    const maxPrice = Number.isFinite(row.finalPrice) && row.finalPrice !== actual ? row.finalPrice : null;
    if (!option) {
      results.push({ label: row.label, code: row.code || null, actual, listPrice, maxPrice, priceKind, expected: null, diff: null, status: row.soldOut ? '품절' : '단가표에 없음', source: '매칭 안 됨' });
      continue;
    }
    claimed.add(option);
    const expected = Number(option.expected);
    let status;
    if (row.soldOut) status = '품절';
    else if (option.status) status = '판매상태 불일치';
    else if (!(expected > 0)) status = '단가 확인 불가';
    else status = actual === expected ? '일치' : '불일치';
    results.push({ label: row.label, code: option.code, name: option.name, actual, listPrice, maxPrice, priceKind, expected: expected > 0 ? expected : null, diff: expected > 0 ? actual - expected : null, status, source: hasInstant ? source : source + ' · 쿠폰 포함가' });
  }
  // 우리 표엔 판매중인데 스토어에서 짝을 못 찾은 옵션 — 품절·판매중지로 둔 옵션은 빼고 알린다.
  for (const option of options) {
    if (claimed.has(option) || option.status) continue;
    results.push({ label: option.name, code: option.code, name: option.name, actual: null, listPrice: null, maxPrice: null, priceKind: null, expected: Number(option.expected) > 0 ? Number(option.expected) : null, diff: null, status: '스토어에 없음', source: '매칭 안 됨' });
  }
  return results;
}

// 한국단열 추가상품 검사 — 스토어 상품 페이지의 추가상품(collector supplements)을 관리자 화면의 추가상품 목록(catalog:
// {code,name,expected,use})과 관리코드 → 이름 순으로 짝지어 가격을 비교한다. 상품별 목록이 아니라 한국단열 전체 마스터라서
// "목록에 있는데 이 상품엔 없는 추가상품"은 알리지 않고, 스토어에 있는데 목록에 없는 것(추가상품 목록에 없음)만 알린다.
// 사용여부 N인 추가상품이 스토어에서 쓰이고 있으면(품절·사용안함이 아니면) 사용여부 불일치.
function normalizeSupplementName(text) {
  return normalizeOptionText(String(text || '').replace(/[●★☆◆■※]/g, ''));
}
function matchHkdSupplements(storeSupplements, catalog) {
  const byCode = new Map(), byName = new Map();
  for (const c of catalog || []) {
    const code = c.code ? String(c.code).toLowerCase() : null;
    if (code && !byCode.has(code)) byCode.set(code, c);
    const name = normalizeSupplementName(c.name);
    if (name && !byName.has(name)) byName.set(name, c);
  }
  const results = [];
  for (const row of storeSupplements || []) {
    const code = row.code ? String(row.code).toLowerCase() : null;
    let entry = null, source = null;
    if (code && byCode.has(code)) { entry = byCode.get(code); source = '코드 매칭'; }
    if (!entry) { const name = normalizeSupplementName(row.label); if (name && byName.has(name)) { entry = byName.get(name); source = '이름 매칭'; } }
    const actual = Number.isFinite(row.finalPrice) ? row.finalPrice : null;
    const label = '[추가상품] ' + (row.label || '');
    if (!entry) {
      results.push({ kind: '추가상품', label, code: row.code || null, actual, expected: null, diff: null, status: row.soldOut ? '품절' : '추가상품 목록에 없음', source: '매칭 안 됨' });
      continue;
    }
    const expected = Number(entry.expected);
    let status;
    if (entry.use === 'N') status = row.soldOut ? '품절' : '사용여부 불일치';
    else if (row.soldOut) status = '품절';
    else if (!(expected > 0)) status = '단가 확인 불가';
    else status = actual === expected ? '일치' : '불일치';
    results.push({ kind: '추가상품', label, code: entry.code, name: entry.name, actual, expected: expected > 0 ? expected : null, diff: expected > 0 && actual != null ? actual - expected : null, status, source });
  }
  return results;
}

// 옵션 1개(row)를 보고 실제 계산에 쓸 {gradeId, thickness, area}를 알아낸다.
// 비드법/PF보드가 아니면 단순히 mapping의 고정 grade_id/area + 라벨에서 두께만 뽑으면 된다.
function resolveOptionMapping(mapping, row) {
  if (mapping.product_type === 'pf') {
    const opt2 = String(row.optionName2 || '').trim();
    const suffix = opt2 === '600x1200' ? '_s' : '_l';
    const gradeId = `${mapping.grade_id}${suffix}`;
    const t = extractThicknessMm(row.optionName1);
    return (t == null || !PF_GRADE_AREA[gradeId]) ? null : { gradeId, thickness: t, area: PF_GRADE_AREA[gradeId] };
  }
  if (mapping.product_type === 'iso') {
    // 2026-09-10: 아이소핑크 옵션 등급은 라벨의 "특호"/"1호" 키워드로 행마다 판정한다.
    //   • 통합 모음전: 옵션마다 "아이소핑크 KS정품 1호|특호 / 900x1800 30T" → 키워드로 갈림
    //   • 단품(두께 1개) + 1호/특호 선택옵션: "1호"/"특호" 옵션 → 키워드로 갈림, 두께는
    //     상품명/매핑(thickness)에서
    //   • 키워드가 전혀 없는 행(단품 기본옵션 등)은 product_mapping.grade_id로 판정하되,
    //     아이소핑크 기본 등급은 1호이므로 'isopink'가 명시된 경우만 특호로 본다.
    const combined = [row.label, row.optionName1, row.optionName2].map(x => String(x || '')).join(' ');
    const t = extractThicknessMm(row.optionName2) ?? extractThicknessMm(row.optionName1)
      ?? extractThicknessMm(combined) ?? (Number(mapping.thickness) || null);
    if (t == null) return null;
    let gradeId;
    if (/특호/.test(combined)) gradeId = 'isopink';
    else if (/1호/.test(combined)) gradeId = '1ho';
    else gradeId = mapping.grade_id === 'isopink' ? 'isopink' : '1ho';
    return { gradeId, thickness: t, area: mapping.area };
  }
  if (mapping.product_type !== 'bead') {
    const t = extractThicknessMm(row.label);
    return t == null ? null : { gradeId: mapping.grade_id, thickness: t, area: mapping.area };
  }
  // 준불연: optionName2가 "600x1200"/"900x1800" 그 자체(두께 표기가 없음)면 이쪽
  const opt2 = String(row.optionName2 || '').trim();
  if (opt2 === '600x1200' || opt2 === '900x1800') {
    const gradeId = opt2 === '600x1200' ? 'ib_06' : 'ib_09';
    const t = extractThicknessMm(row.optionName1);
    return t == null ? null : { gradeId, thickness: t, area: BEAD_GRADE_AREA[gradeId] };
  }
  // 1종/2종: optionName1에서 "1종3호" 같은 걸 읽어 등급으로 역매칭, 두께는 optionName2에서
  const jongMatch = String(row.optionName1 || '').match(/([12]종)\s*(\d호)/);
  if (!jongMatch) return null;
  const subKey = `${jongMatch[1]} ${jongMatch[2]}`;
  const gradeId = BEAD_SUB_TO_GRADE_ID[subKey];
  const t = extractThicknessMm(row.optionName2);
  if (!gradeId || t == null) return null;
  return { gradeId, thickness: t, area: BEAD_GRADE_AREA[gradeId] };
}



let processing = false;
const ALARM = "eg-price-check-next";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function save(state) { await chrome.storage.local.set({priceTest:state}); }
function endpoint(raw, id, kind) {
  const url = new URL(raw, 'https://smartstore.naver.com');
  if (url.origin !== 'https://smartstore.naver.com' || !new RegExp('^/i/v2/channels/[^/]+/'+kind+'/'+id+'$').test(url.pathname)) throw Error('수집 요청 주소가 상품과 일치하지 않습니다.');
  return url.href;
}
async function json(url) {
  const response = await fetch(url, {credentials:'include',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error(`직접 조회 실패 HTTP ${response.status}`);
  return response.json();
}
function optionRows(product, benefit) {
  const base = benefit?.optimalDiscount?.totalDiscountResult?.summary?.totalPayAmount;
  if (base == null || !Number.isFinite(Number(base)) || Number(base) <= 0) throw Error('할인 기준가 확인 불가');
  const combos = product.optionCombinations?.length ? product.optionCombinations : product.combinationOptions?.[0]?.options || product.standardCombinations || [];
  if (!combos.length) return [{label:'(옵션 없음)', finalPrice:Number(base), soldOut:(product.stockQuantity ?? 1) <= 0}];
  return combos.map(c => ({label:[c.optionName1,c.optionName2,c.optionName3].filter(Boolean).join(' / '),optionName1:c.optionName1,optionName2:c.optionName2,optionName3:c.optionName3,finalPrice:Number(base)+Number(c.price || 0),soldOut:(c.stockQuantity ?? 1) <= 0}));
}
async function inspect(item, pricing) {
  const id = String(item.productId);
  if (!/^\d+$/.test(id)) throw Error('상품번호 오류');
  const url=new URL(item.productUrl || 'https://smartstore.naver.com/energuardcompany/products/'+id);
  if(url.origin!=='https://smartstore.naver.com' || !['/energuardcompany/products/'+id,'/hkdy/products/'+id].includes(url.pathname.replace(/\/$/,''))) throw Error('허용되지 않은 상품 주소');
  const tab = await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try {
    let scan;
    for (let n=0;n<25;n++) {
      await delay(1000);
      try { scan = await chrome.tabs.sendMessage(tab.id,{type:'GET_COMPETITOR_SCAN_DATA'}); } catch {}
      if (scan?.ok && scan.benefitReady && scan.detailUrl && scan.benefitUrl) break;
    }
    if (!scan?.benefitReady) throw Error('페이지 할인 정보 수집 실패 — 로그인·차단 여부 확인 필요');
    // 직접 API 요청은 HTTP 429가 확인되어 사용하지 않는다. 페이지가 이미 받은 응답만 사용.
    endpoint(scan.detailUrl,id,'products'); endpoint(scan.benefitUrl,id,'product-benefits');
    if (!scan.ok || !Array.isArray(scan.rows) || !scan.rows.length || scan.rows.some(r => !Number.isFinite(r.finalPrice) || r.finalPrice <= 0)) throw Error('페이지 판매가 확인 불가');
    const pageUrl=new URL(scan.productUrl);
    if (pageUrl.origin !== url.origin || pageUrl.pathname.replace(/\/$/,'') !== url.pathname.replace(/\/$/,'')) throw Error('수집 상품 주소 불일치');
    const rows=scan.rows;
    return rows.map(row => {
      let resolved;
      if (row.label === '(옵션 없음)') resolved={gradeId:item.mapping.grade_id,thickness:item.mapping.thickness,area:item.mapping.area};
      else if (item.mapping.product_type==='pf' && /_(s|l)$/.test(item.mapping.grade_id || '')) {
        const thickness=extractThicknessMm(row.label);
        resolved=thickness ? {gradeId:item.mapping.grade_id,thickness,area:PF_GRADE_AREA[item.mapping.grade_id]} : null;
      } else resolved=resolveOptionMapping(item.mapping,row);
      const expected = resolved ? getTablePrice({...item.mapping,grade_id:resolved.gradeId,thickness:resolved.thickness,area:resolved.area},pricing) : null;
      const status = row.soldOut ? '품절' : !resolved ? '매핑 필요' : !(expected > 0) ? '단가 확인 불가' : expected === row.finalPrice ? '일치' : '불일치';
      return {productId:id,label:row.label,actual:row.finalPrice,expected,status,source:'페이지 수집',diff:expected > 0 ? row.finalPrice-expected : null};
    });
  } finally { await chrome.tabs.remove(tab.id).catch(()=>{}); await chrome.storage.local.remove('priceCheckTab'); }
}

// 한국단열(hkdy) 몰별 적용 검사 — 기대가격은 관리자 화면이 옵션별로 계산해 넘긴다(item.options).
// 에너가드 검사와 같이 할인 적용가(할인 응답의 기준가+옵션추가금)로 비교하므로 할인 응답을 기다린다.
// 할인이 없는 상품은 할인 응답 자체가 안 올 수 있어서, 끝까지 안 오면 상세의 판매가로 비교한다.
// 한국단열 스토어 두 곳(한국단열 hkdy · 한국단열라이프 hkdylife — 같은 스마트스토어 구조, 2026-09-30)의 상품 주소만 허용한다.
function hkdProductPathOk(pathname, id) {
  return /^\/(hkdy|hkdylife)\/products\/\d+$/.test(String(pathname||'').replace(/\/$/,'')) && String(pathname).replace(/\/$/,'').endsWith('/products/'+id);
}

function esmProductUrlOk(url, marketplace, id) {
  if (marketplace==='gmarket') return url.origin==='https://item.gmarket.co.kr'&&url.pathname.toLowerCase()==='/item'&&url.searchParams.get('goodscode')===id;
  if (marketplace==='auction') return url.origin==='https://itempage3.auction.co.kr'&&url.pathname.toLowerCase()==='/detailview.aspx'&&String(url.searchParams.get('ItemNo')||url.searchParams.get('itemno')||'').toUpperCase()===id;
  return false;
}
// ── 쿠팡 ──────────────────────────────────────────────────
// 상품 상세의 Next.js 데이터에서 같은 Product ID의 vendorItemId별 등록가·할인가를 먼저 묶어 읽는다.
// 단, 쿠팡이 현재 선택 옵션과 일부 조합만 내려주는 상품도 있으므로 빠진 vendorItemId는 같은 탭에서
// 해당 옵션 URL로 이동해 한 번씩 보충 수집한다. 매칭은 항상 Product ID + vendorItemId다
// (단열벽지 일반 3상품은 유형별 대표 옵션 ID 하나씩만 단가표에 넣어 같은 방식으로 검사한다).
function coupangProductUrlOk(url,id){
  return url.origin==='https://www.coupang.com'&&url.pathname.replace(/\/$/,'')==='/vp/products/'+id;
}
function matchCoupangOptions(productId,storeRows,options){
  const byId=new Map((storeRows||[]).map(row=>[String(row.optionId||''),row]));
  const results=[];
  for(const option of options||[]){
    const optionId=String(option.optionId||'');
    const row=optionId?byId.get(optionId):null;
    if(!row){
      if(option.status)continue;
      results.push({productId,optionId,store:'coupang',label:option.name||optionId,code:option.code||null,actual:null,expected:Number(option.expected)||null,diff:null,status:'스토어에 없음',source:'vendorItemId 매칭 안 됨'});
      continue;
    }
    const winner=Boolean(option.winner);
    const collectedRegistered=Number(row.registeredPrice);
    const actualFinal=Number(row.finalPrice),expectedFinal=Number(option.expectedFinal);
    // 위너 상품은 쿠폰을 붙이지 않는다. 페이지 데이터의 originPrice는 비교 대상이 아니며,
    // 구매자가 실제로 결제하는 위너 판매가(finalPrice)를 단가표의 수동 위너가와 비교한다.
    const actual=winner?actualFinal:collectedRegistered,expected=Number(option.expected);
    const validActual=Number.isFinite(actual)&&actual>0,validExpected=Number.isFinite(expected)&&expected>0;
    const validActualFinal=Number.isFinite(actualFinal)&&actualFinal>0,validExpectedFinal=Number.isFinite(expectedFinal)&&expectedFinal>0;
    let status;
    if(row.soldOut||row.invalid)status='품절';
    else if(!validActual)status='가격 확인 불가';
    else if(!validExpected)status='단가 확인 불가';
    else if(actual!==expected)status='불일치';
    else if(!winner&&validExpectedFinal&&(!validActualFinal||actualFinal!==expectedFinal))status='할인가 불일치';
    else status='일치';
    const actualDiscount=winner?NaN:Number(row.discountRate);
    const source=[
      winner?'vendorItemId 매칭 · 위너 실제 판매가 기준':'vendorItemId 매칭',
      row.sellerName&&`판매자 ${row.sellerName}`,
      Number.isFinite(actualDiscount)&&`할인 ${actualDiscount}%`,
    ].filter(Boolean).join(' · ');
    results.push({
      productId,optionId,store:'coupang',label:row.name||option.name||optionId,code:option.code||null,
      actual:validActual?actual:null,expected:validExpected?expected:null,diff:validActual&&validExpected?actual-expected:null,
      actualFinal:validActualFinal?actualFinal:null,expectedFinal:validExpectedFinal?expectedFinal:null,
      actualDiscount:Number.isFinite(actualDiscount)?actualDiscount:null,
      expectedDiscount:Number.isFinite(Number(option.expectedDiscount))?Number(option.expectedDiscount):null,
      status,source,priceKind:'쿠팡 등록가',listPrice:validActual?actual:null,maxPrice:validActualFinal?actualFinal:null,
    });
  }
  return results;
}
function coupangAdultError(where){const error=Error('쿠팡 성인 인증이 필요한 상품');error.adult=true;error.where=where||'';return error;}
async function inspectCoupang(item){
  const id=String(item.productId||'');
  const options=Array.isArray(item.options)?item.options:[];
  const url=new URL(item.productUrl||`https://www.coupang.com/vp/products/${id}?vendorItemId=${options[0]?.optionId||''}`);
  if(!/^\d+$/.test(id)||!coupangProductUrlOk(url,id))throw Error('허용되지 않은 쿠팡 상품 주소');
  const tab=await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try{
    const requested=options.map(option=>String(option.optionId)).filter(id=>/^\d+$/.test(id));
    const rowsById=new Map();
    async function scanCurrent(optionIds,requiredId){
      let last;
      for(let n=0;n<30;n++){
        await delay(1000);
        try{last=await chrome.tabs.sendMessage(tab.id,{type:'GET_COUPANG_SCAN_DATA',optionIds});}catch{}
        if(last?.blocked)throw Error(last.error||'쿠팡 사이트 확인 화면 또는 접근 차단');
        if(last?.adult)throw coupangAdultError();
        if(String(last?.productId)===id&&Array.isArray(last?.rows)){
          for(const row of last.rows){if(row?.optionId)rowsById.set(String(row.optionId),row);}
          if(last.ok&&(!requiredId||rowsById.has(String(requiredId))))return true;
        }
      }
      return false;
    }
    if(!await scanCurrent(requested,null)){
      // 인증 화면이 상품 주소가 아닌 다른 주소로 넘어가면 수집기가 붙지 않아 응답이 없다 — 현재 주소로 원인을 구분한다.
      let tabUrl=null;try{tabUrl=new URL(String((await chrome.tabs.get(tab.id))?.url||''));}catch{}
      // 성인 인증 화면은 로그인한 상태에서도 login.coupang.com/login/adult.pang 으로 넘어간다(2026-10-01 확인).
      // 그 주소(adult)면 성인 인증, 그냥 로그인 주소면 로그인이 풀린 것이라 검사를 멈춘다.
      if(tabUrl&&/adult/i.test(tabUrl.pathname))throw coupangAdultError(tabUrl.hostname+tabUrl.pathname);
      if(tabUrl&&/^(?:login|member)\.coupang\.com$/.test(tabUrl.hostname))throw Error('쿠팡 로그인이 필요합니다 — 쿠팡에 로그인한 뒤 다시 검사하세요 ('+tabUrl.hostname+tabUrl.pathname+')');
      throw Error('쿠팡 옵션 가격 수집 실패'+(tabUrl?` (현재 주소 ${tabUrl.hostname}${tabUrl.pathname})`:''));
    }
    for(const option of options){
      const optionId=String(option.optionId||'');
      if(!optionId||option.status||rowsById.has(optionId))continue;
      const optionUrl=`https://www.coupang.com/vp/products/${id}?vendorItemId=${optionId}`;
      await chrome.tabs.update(tab.id,{url:optionUrl});
      await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:optionUrl}});
      await scanCurrent([optionId],optionId);
    }
    return matchCoupangOptions(id,[...rowsById.values()],options);
  }catch(error){
    // 성인 인증이 필요한 상품은 차단이 아니라 이 상품만 읽을 수 없는 것 — 실패로 치지 않고 옵션마다 표시만 한다(11번가와 같은 방식).
    if(!error?.adult)throw error;
    return options.map(option=>({
      productId:id,optionId:String(option.optionId||''),store:'coupang',label:option.name||String(option.optionId||''),code:option.code||null,
      actual:null,expected:Number(option.expected)||null,diff:null,status:'성인인증 필요',source:'쿠팡에서 직접 확인 — 성인(본인) 인증이 필요한 상품이라 검사하지 못했습니다'+(error.where?` (이동한 주소 ${error.where})`:''),
    }));
  }finally{await chrome.tabs.remove(tab.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
}
// ── 11번가 ────────────────────────────────────────────────
// 11번가 구매자 페이지에는 셀러 재고번호(관리코드)가 안 나온다(2026-09-30 확인). 그래서 옵션을 "규격 열쇠"로 짝짓는다 —
// 단가표 관리코드(예: St_430_430_10_5)와 스토어 옵션 이름(예: "스티로폼(3호)_10T-430x430(5장)")을 같은 모양의 열쇠로 바꿔 비교한다.
//  · 비드법·아이소핑크: 재질(St 백색/Neo 회색/Iso 아이소핑크)+접착식 여부|두께|가로x세로 (장수는 열쇠에 넣지 않고 따로 대조 — 이름의 장수가 다르면 알려준다)
//  · 열반사(빌트론): BL|두께|길이|등급(S일반/D고급)+접착(N비접착/A한쪽접착)   · 단열벽지: WP|타입(P1·P2·DW·SK)|두께|길이(2.3m는 23)
// 옵션 이름과 가격이 서로 바뀐 스토어 옵션은 열쇠가 같아서 짝지어지고 가격이 어긋나 "불일치"로 나온다(그게 이 검사의 목적).
function st11KeyFromCode(code) {
  const c = String(code || '');
  let m = /^(IIso|Iso|Neo|St)(A?)_(\d+)_(\d+)_(\d+)_(\d+)$/.exec(c);
  if (m) return { key: `${m[1]==='IIso'?'Iso':m[1]}${m[2]}|${m[5]}|${m[3]}x${m[4]}`, count: Number(m[6]) };
  m = /^BL_(\d+)_(\d+)_([SD][NA])(?:_R)?$/.exec(c);
  if (m) return { key: `BL|${m[1]}|${m[2]}|${m[3]}`, count: null };
  m = /^WP_(P1|P2|DW|SK)_(\d+)_(\d+)$/.exec(c);
  if (m) return { key: `WP|${m[1]}|${m[2]}|${m[3]}`, count: null };
  return null;
}
function st11KeyFromName(name) {
  // 공백은 한 칸으로 줄여 두고(두께 "20T"가 앞 글자·숫자와 붙어 읽히지 않게), 규격을 읽을 때만 공백을 지운다.
  const spaced = String(name || '').replace(/㎜|mm/gi, '').replace(/\s+/g, ' ').toLowerCase();
  const s = spaced.replace(/\s/g, '');
  const thicknessMatch = /(?<![\d.])(\d{1,3})t(?![a-wyz])/.exec(spaced); // "200Tx600"처럼 뒤에 x가 붙는 표기도 허용
  const thickness = thicknessMatch ? thicknessMatch[1] : null;
  if (/빌트론|열반사/.test(s)) {
    const length = /x(\d+)m/.exec(s);
    const grade = /고급형/.test(s) ? 'D' : /일반형/.test(s) ? 'S' : null;
    const adhesive = /한쪽접착/.test(s) ? 'A' : /비접착/.test(s) ? 'N' : null;
    return thickness && length && grade && adhesive ? { key: `BL|${thickness}|${length[1]}|${grade}${adhesive}`, count: null } : null;
  }
  if (/벽지|고급형[12]|이중화이트|실크/.test(s)) {
    const type = /고급형1/.test(s) ? 'P1' : /고급형2/.test(s) ? 'P2' : /이중화이트/.test(s) ? 'DW' : /실크/.test(s) ? 'SK' : null;
    const length = /x(\d+(?:\.\d+)?)m/.exec(s);
    return type && thickness && length ? { key: `WP|${type}|${thickness}|${length[1].replace('.', '')}`, count: null } : null;
  }
  const material = /아이소핑크/.test(s) ? 'Iso' : /회색|네오폴|2호|2종/.test(s) ? 'Neo' : /스티로폼|백색/.test(s) ? 'St' : null;
  if (!material || !thickness) return null;
  const rest = (spaced.slice(0, thicknessMatch.index) + ' ' + spaced.slice(thicknessMatch.index + thicknessMatch[0].length)).replace(/\s/g, '');
  const size = /(\d{3,4})x(\d{3,4})/.exec(rest);
  if (!size) return null;
  // 장수는 공백을 남긴 문자열에서 읽는다 — "900x1800 10장"을 공백 없이 붙이면 "180010장"으로 읽혀 장수가 틀어진다.
  const count = /(?<!\d)(\d+)\s*장/.exec(spaced);
  return { key: `${material}${/접착/.test(s) ? 'A' : ''}|${thickness}|${size[1]}x${size[2]}`, count: count ? Number(count[1]) : null };
}
function st11NormName(text) { return String(text || '').toLowerCase().replace(/[\s()\[\]{}·_\-\/,.~★●☆※+]/g, ''); }
function match11stOptions(productId, allStoreRows, options) {
  const infos = options.map(option => ({ option, ...(st11KeyFromCode(option.code) || { key: null, count: null }) }));
  const used = new Set();
  const results = [];
  // 단열벽지는 색상 옵션이 수십 개지만 (타입·길이)마다 가격은 하나다(단가표에도 대표 코드 하나) — ESM·홈페이지 단열벽지와 같은 상황.
  // 색상별로 짝짓지 않고 (타입·두께·길이)마다 대표가 한 줄만 비교한다(아래 wallGroups). 스티로폼·아이소핑크·열반사는 그대로 옵션별 규격 매칭.
  const wallGroups = new Map();
  const storeRows = [];
  for (const row of allStoreRows) {
    const wallKey = st11KeyFromName(row.name);
    if (wallKey && wallKey.key.startsWith('WP|')) {
      if (!wallGroups.has(wallKey.key)) wallGroups.set(wallKey.key, { prefix: String(row.name).split(' / ')[0], rows: [] });
      wallGroups.get(wallKey.key).rows.push(row);
    } else storeRows.push(row);
  }
  for (const [key, group] of wallGroups) {
    const index = infos.findIndex((info, i) => info.key === key && !used.has(i));
    const live = group.rows.filter(row => row.qty !== 0 && Number.isFinite(row.price) && row.price > 0); // 품절 색상은 가격 비교에서 뺀다
    const head = { productId, store: '11st', label: `${group.prefix} · 대표가`, priceKind: '판매가', maxPrice: null };
    const colors = `색상 옵션 ${group.rows.length}개`;
    if (index < 0) { results.push({ ...head, code: null, actual: live[0]?.price ?? null, listPrice: live[0]?.price ?? null, expected: null, diff: null, status: live.length ? '단가표에 없음' : '품절', source: `매칭 안 됨 · ${colors}` }); continue; }
    used.add(index);
    const option = infos[index].option;
    const expected = Number(option.expected);
    const validExpected = expected > 0;
    const wrong = validExpected ? live.filter(row => row.price !== expected) : [];
    const shown = wrong.length ? wrong[0].price : (live[0]?.price ?? null);
    const status = option.status || !live.length ? '품절' : !validExpected ? '단가 확인 불가' : wrong.length ? '대표가 불일치' : '대표가 일치';
    results.push({ ...head, code: option.code || null, actual: shown, listPrice: shown, expected: validExpected ? expected : null, diff: validExpected && shown != null ? shown - expected : null, status, source: `대표가 검사 · ${colors}${wrong.length ? ` 중 ${wrong.length}개 가격 다름` : ' 제외(가격 하나)'}` });
  }
  for (const row of storeRows) {
    const parsed = st11KeyFromName(row.name);
    let hit = null;
    if (parsed) {
      const candidates = infos.filter((info, index) => info.key === parsed.key && !used.has(index));
      // 같은 열쇠가 둘 이상(예: 아이소핑크 900x1800 70T의 1장/3장)이면 장수로 가른다.
      hit = candidates.length > 1 ? candidates.find(info => parsed.count != null && info.count === parsed.count) : candidates[0];
    }
    // 부자재처럼 규격 열쇠가 없는 옵션(단가표 관리코드가 T_EB_D 같은 이름표)은 옵션 이름이 같은 것끼리 짝짓는다(공백·기호 무시).
    let byName = false;
    if (!hit) {
      const rowName = st11NormName(row.name);
      // 옵션 이름(option.name)뿐 아니라 11번가 스토어 옵션명(option.storeName — "1단계 / 2단계"·번호 접두어처럼 우리 이름과 다르게 올라간 것)으로도 짝짓는다.
      if (rowName) hit = infos.find((info, index) => info.key == null && !used.has(index) && [info.option.name, info.option.storeName].some(name => name && st11NormName(name) === rowName));
      // 옵션이 없는 단품 상품(수집기가 "(옵션 없음)" 한 줄로 돌려줌)은 우리 옵션이 하나뿐이면 그것과 짝짓는다.
      if (!hit && row.name === '(옵션 없음)' && infos.length === 1 && !used.has(0)) hit = infos[0];
      byName = !!hit;
    }
    const price = Number.isFinite(row.price) && row.price > 0 ? row.price : null;
    const soldOut = row.qty === 0;
    const base = { productId, store: '11st', label: row.name, actual: price, priceKind: '판매가', listPrice: price, maxPrice: null };
    if (!hit) { results.push({ ...base, code: null, expected: null, diff: null, status: soldOut ? '품절' : parsed ? '단가표에 없음' : '이름 해석 불가', source: parsed ? '매칭 안 됨' : '규격을 읽지 못함' }); continue; }
    used.add(infos.indexOf(hit));
    const expected = Number(hit.option.expected);
    const validExpected = expected > 0;
    const countNote = parsed && parsed.count != null && hit.count != null && parsed.count !== hit.count ? ` · 장수 표기 다름(스토어 ${parsed.count}장/단가표 ${hit.count}장)` : '';
    let status = hit.option.status || soldOut ? '품절' : price == null ? '가격 확인 불가' : !validExpected ? '단가 확인 불가' : price === expected ? '일치' : '불일치';
    if (status === '일치' && countNote) status = '이름 확인 필요';
    results.push({ ...base, code: hit.option.code || null, expected: validExpected ? expected : null, diff: validExpected && price != null ? price - expected : null, status, source: `${byName ? '이름 매칭' : '규격 매칭'}${countNote}` });
  }
  // 두 옵션의 스토어 가격이 서로의 단가표 가격과 정확히 맞바뀐 경우(예: 600x900이 430x430 가격, 430x430이 600x900 가격) 알려준다 —
  // 옵션 이름과 가격이 어긋나게 등록된 것으로 보이는 흔한 패턴(2026-09-30 실제 1534558353·1548926732).
  const mismatched = results.filter(row => row.status === '불일치' && row.actual != null && row.expected != null);
  mismatched.forEach(row => {
    const partner = mismatched.find(other => other !== row && other.actual === row.expected && other.expected === row.actual);
    if (partner) row.source += ` · 짝 옵션(${partner.code})과 가격이 서로 바뀐 것으로 보임`;
  });
  infos.forEach((info, index) => {
    if (used.has(index) || info.option.status) return;
    results.push({ productId, store: '11st', label: info.option.name, code: info.option.code || null, actual: null, expected: Number(info.option.expected) > 0 ? Number(info.option.expected) : null, diff: null, status: '스토어에 없음', source: '매칭 안 됨', priceKind: '판매가' });
  });
  return results;
}
async function st11TabUrl(tabId) {
  try { const tab = await chrome.tabs.get(tabId); return String(tab?.url || tab?.pendingUrl || ''); } catch { return ''; }
}
function st11ProductUrlOk(url, id) { return url.origin==='https://www.11st.co.kr' && url.pathname.replace(/\/$/,'')==='/products/'+id; }
async function inspect11st(item, supplementCatalog, mode) {
  const id = String(item.productId||'').trim();
  const url = new URL(item.productUrl || 'https://www.11st.co.kr/products/'+id);
  if (!/^\d+$/.test(id) || !st11ProductUrlOk(url, id)) throw Error('허용되지 않은 11번가 상품 주소');
  const tab = await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try {
    let scan;
    for (let n=0;n<25;n++) {
      await delay(800);
      try { scan = await chrome.tabs.sendMessage(tab.id,{type:'GET_11ST_SCAN_DATA',mode:mode==='supplement'?'supplement':'options'}); } catch {
        // 로그인 화면으로 넘어간 상품(성인 인증)은 수집기가 없어 계속 실패한다 — 몇 번 시도해 보고 바로 빠져나간다.
        if (n >= 2 && /login\\.11st\\.co\\.kr/.test(await st11TabUrl(tab.id))) break;
      }
      if (scan?.ok || scan?.error) break;
    }
    if (!scan?.ok && !scan?.error) {
      // 성인 인증이 필요한 상품(본드류 등)은 로그인 화면으로 넘어가 수집기가 없다 — 차단이 아니라 이 상품만 읽을 수 없는 것이라 검사를 멈추지 않고 표시만 한다.
      if (/login\.11st\.co\.kr/.test(await st11TabUrl(tab.id))) {
        return [{productId:id, store:'11st', status:'성인인증 필요', label:'성인 인증이 필요한 상품이라 검사하지 못했습니다', code:null, actual:null, expected:null, diff:null, source:'11번가에서 직접 확인'}];
      }
    }
    if (!scan?.ok) throw Error(scan?.error||'11번가 상품 정보 수집 실패 — 로그인·차단·삭제 여부 확인 필요');
    if (String(scan.productId)!==id) throw Error('수집 상품 주소 불일치');
    if (mode==='supplement') {
      const found = matchHkdSupplements(scan.supplements, supplementCatalog).map(row=>({productId:id, store:'11st', ...row}));
      return found.length ? found : [{productId:id, store:'11st', kind:'추가상품', label:'(추가상품 없음)', code:null, actual:null, expected:null, diff:null, status:'추가상품 없음', source:'—'}];
    }
    if (!Array.isArray(scan.rows) || !scan.rows.length) throw Error('11번가 옵션 확인 불가');
    return match11stOptions(id, scan.rows, Array.isArray(item.options)?item.options:[]);
  } finally { await chrome.tabs.remove(tab.id).catch(()=>{}); await chrome.storage.local.remove('priceCheckTab'); }
}

// 옵션 상품(단열벽지) 옵션 짝짓기 열쇠 — 단가표 이름("단열벽지 고급형1 5T x 10m")과 스토어 옵션("고급형1_5T" + "10m")을 같은 모양으로 맞춘다.
function esmOptionKey(text) { return String(text||'').replace(/단열벽지|_|\s/g,'').toLowerCase(); }
async function inspectEsmOptions(item, id, marketplace, tab) {
  let scan;
  for (let n=0;n<25;n++) {
    await delay(600);
    try { scan = await chrome.tabs.sendMessage(tab.id,{type:'GET_ESM_OPTION_SCAN_DATA'}); } catch {}
    if (scan?.ok || scan?.error) break;
  }
  if (!scan?.ok) throw Error(scan?.error||'ESM 옵션 정보 수집 실패 — 로그인·차단·삭제 여부 확인 필요');
  if (scan.marketplace!==marketplace||String(scan.productId)!==id) throw Error('수집 상품 주소 불일치');
  if (!Array.isArray(scan.rows)||!scan.rows.length) throw Error('ESM 옵션 확인 불가');
  const source = marketplace==='auction' ? '옥션 옵션(원가+추가금)' : 'G마켓 옵션';
  const options = Array.isArray(item.options) ? item.options : [];
  const used = new Set();
  const results = [];
  for (const row of scan.rows) {
    // 단열벽지는 "타입 + 사이즈", 1단 옵션 상품(2K·라이트폼)은 이름만(size가 빔). 우리 이름(option.name)이나 스토어 옵션명(option.storeName)이 같으면 짝.
    const key = row.size ? esmOptionKey(row.type)+'x'+esmOptionKey(row.size) : esmOptionKey(row.type);
    const optionIndex = options.findIndex((option,index)=>!used.has(index)&&[option.name,option.storeName].some(name=>name&&esmOptionKey(name)===key));
    const prices = (Array.isArray(row.prices)?row.prices:[]).map(Number).filter(price=>Number.isFinite(price)&&price>0);
    const label = [row.type, row.size].filter(Boolean).join(' ');
    const actual = prices.length ? prices[0] : null;
    if (optionIndex<0) { results.push({productId:id,store:marketplace,label,code:null,actual,expected:null,diff:null,status:'단가표에 없음',source:'매칭 안 됨',priceKind:'등록 판매가'}); continue; }
    used.add(optionIndex);
    const option = options[optionIndex];
    const expected = Number(option.expected);
    const validExpected = expected>0;
    // 같은 사이즈 안에서 디자인마다 추가금이 다르면(옥션) 하나라도 어긋난 값을 결과로 남긴다.
    const wrong = validExpected ? prices.find(price=>price!==expected) : undefined;
    const shown = wrong!==undefined ? wrong : actual;
    const status = option.status ? '품절' : !prices.length ? '가격 확인 불가' : !validExpected ? '단가 확인 불가' : wrong!==undefined ? '불일치' : '일치';
    results.push({productId:id,store:marketplace,label,code:option.code||null,actual:shown,expected:validExpected?expected:null,diff:validExpected&&shown!=null?shown-expected:null,status,source:prices.length>1&&wrong!==undefined?`${source} · 디자인별 가격 상이`:source,priceKind:'등록 판매가',listPrice:shown,maxPrice:null});
  }
  options.forEach((option,index)=>{
    if (used.has(index)||option.status) return;
    results.push({productId:id,store:marketplace,label:option.name,code:option.code||null,actual:null,expected:Number(option.expected)>0?Number(option.expected):null,diff:null,status:'스토어에 없음',source:'매칭 안 됨',priceKind:'등록 판매가'});
  });
  return results;
}
async function inspectEsm(item) {
  const id=String(item.productId||'').trim();
  const marketplace=item.marketplace;
  if(item.unsupported)return [{productId:id,store:marketplace,label:item.label||'상품 구성 확인 필요',code:null,actual:null,expected:null,diff:null,status:'상품 구성 확인 필요',source:'한 상품번호에 상품코드 여러 개'}];
  const url=new URL(item.productUrl);
  if(!esmProductUrlOk(url,marketplace,id))throw Error('허용되지 않은 ESM 상품 주소');
  const tab=await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try{
    if(item.optionMode)return await inspectEsmOptions(item,id,marketplace,tab);
    let scan;
    for(let n=0;n<25;n++){
      await delay(600);
      try{scan=await chrome.tabs.sendMessage(tab.id,{type:'GET_ESM_SCAN_DATA'});}catch{}
      if(scan?.ok||scan?.error)break;
    }
    if(!scan?.ok)throw Error(scan?.error||'ESM 상품 정보 수집 실패 — 로그인·차단·삭제 여부 확인 필요');
    if(scan.marketplace!==marketplace||String(scan.productId)!==id)throw Error('수집 상품 주소 불일치');
    const actual=Number(scan.registeredPrice),expected=Number(item.expected);
    if(!(actual>0))throw Error('ESM 등록 판매가 확인 불가');
    const status=!(expected>0)?'단가 확인 불가':actual===expected?'일치':'불일치';
    return [{productId:id,store:marketplace,label:item.name,code:item.code,actual,expected:expected>0?expected:null,diff:expected>0?actual-expected:null,status,source:`${marketplace==='auction'?'옥션':'G마켓'} 등록가`,priceKind:'등록 판매가',listPrice:actual,maxPrice:scan.discountedPrice||null}];
  }finally{await chrome.tabs.remove(tab.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
}
async function inspectHkd(item, supplementCatalog, mode) {
  const id = String(item.productId);
  if (!/^\d+$/.test(id)) throw Error('상품번호 오류');
  const url = new URL(item.productUrl || 'https://smartstore.naver.com/hkdy/products/'+id);
  const isHomepage = url.origin==='https://boonimall.kr';
  if (isHomepage) {
    if (url.pathname.replace(/\/$/,'')!=='/goods/view' || url.searchParams.get('no')!==id) throw Error('허용되지 않은 상품 주소');
    if (mode === 'supplement') throw Error('홈페이지 추가상품 검사는 아직 지원하지 않습니다.');
  } else if (url.origin!=='https://smartstore.naver.com' || !hkdProductPathOk(url.pathname, id)) throw Error('허용되지 않은 상품 주소');
  const store = isHomepage ? 'boonimall' : url.pathname.split('/')[1];
  const tab = await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try {
    let scan;
    for (let n=0;n<(isHomepage?20:25);n++) {
      await delay(isHomepage?500:1000);
      try { scan = await chrome.tabs.sendMessage(tab.id,{type:isHomepage?'GET_BOONIMALL_SCAN_DATA':'GET_COMPETITOR_SCAN_DATA',ignoreSupplements:true}); } catch {}
      if (isHomepage ? scan?.ok : (scan?.ok && scan.detailUrl && scan.benefitReady)) break;
    }
    if (!scan?.ok || (!isHomepage && !scan.detailUrl)) throw Error('상품 정보 수집 실패 — 로그인·차단·삭제 여부 확인 필요');
    if (!isHomepage) endpoint(scan.detailUrl,id,'products');
    if (!Array.isArray(scan.rows) || !scan.rows.length) throw Error('페이지 옵션 확인 불가');
    const pageUrl = new URL(scan.productUrl);
    if (pageUrl.origin!==url.origin || pageUrl.pathname.replace(/\/$/,'')!==url.pathname.replace(/\/$/,'')) throw Error('수집 상품 주소 불일치');
    if (isHomepage && pageUrl.searchParams.get('no')!==id) throw Error('수집 상품 주소 불일치');
    // 가격 후보(정가·즉시할인가·최대할인가 등 응답에서 읽은 값)는 상품의 첫 행에만 붙여서 결과에 남긴다 —
    // 즉시할인가를 제대로 읽었는지 검사 결과에서 바로 볼 수 있게(2026-09-29).
    // 추가상품 검사(2026-09-29)는 옵션 검사와 따로 돌린다(사용자 요청 — 한 번에 하면 결과가 많고 오래 걸린다). mode==='supplement'이면
    // 옵션은 보지 않고 이 페이지의 추가상품만 관리자 화면의 추가상품 목록과 대조한다. 추가상품이 없는 상품은 "추가상품 없음" 한 줄.
    if (mode === 'supplement') {
      if (!Array.isArray(supplementCatalog) || !supplementCatalog.length) throw Error('추가상품 목록이 없습니다');
      if (!Array.isArray(scan.supplements)) throw Error('추가상품 정보를 읽지 못했습니다 — 확장을 새로고침하세요');
      const found = matchHkdSupplements(scan.supplements, supplementCatalog).map(row=>({productId:id, store, ...row}));
      return found.length ? found : [{productId:id, store, kind:'추가상품', label:'(추가상품 없음)', code:null, actual:null, expected:null, diff:null, status:'추가상품 없음', source:'—'}];
    }
    let storeRows=scan.rows;
    if (isHomepage && item.representativeOnly && item.options.length===1) {
      const option=item.options[0];
      const fallback=storeRows.find(row=>!row.soldOut&&Number.isFinite(Number(row.finalPrice))&&Number(row.finalPrice)>0);
      const actual=Number.isFinite(Number(scan.basePrice))&&Number(scan.basePrice)>0 ? Number(scan.basePrice) : Number(fallback?.finalPrice);
      const expected=Number(option.expected);
      const validActual=Number.isFinite(actual)&&actual>0;
      const validExpected=Number.isFinite(expected)&&expected>0;
      const status=!validActual?'가격 확인 불가':!validExpected?'단가 확인 불가':actual===expected?'대표가 일치':'대표가 불일치';
      return [{
        productId:id, store, label:`${option.name} · 대표가`, code:option.code||null,
        actual:validActual?actual:null, expected:validExpected?expected:null,
        diff:validActual&&validExpected?actual-expected:null, status,
        source:`대표가 검사 · 색상 옵션 ${storeRows.length}개 제외`, priceKind:'판매가', listPrice:null, maxPrice:null
      }];
    }
    let ordered=false;
    if (isHomepage) {
      const first=matchHkdOptions(storeRows,item.options);
      const matched=first.filter(row=>row.actual!=null&&row.expected!=null&&row.source!=='매칭 안 됨').length;
      // 부니몰에는 관리코드가 노출되지 않는다. 이름으로 하나도 매칭되지 않고 양쪽 개수가 같을 때만
      // 몰별 적용 표를 만들 때 입력한 등록 순서를 보조 기준으로 쓴다.
      if (!matched && storeRows.length===item.options.length) {
        ordered=true;
        storeRows=storeRows.map((row,index)=>({...row,code:item.options[index]?.code||null}));
      }
    }
    return matchHkdOptions(storeRows, item.options).map((row,index)=>({
      productId:id, store, ...row,
      ...(isHomepage?{priceKind:'판매가',listPrice:null,maxPrice:null,source:ordered?String(row.source||'').replace('코드 매칭','등록 순서 매칭'):String(row.source||'').replace(' · 쿠폰 포함가','')} : {}),
      ...(index===0&&scan.priceInfo?{priceInfo:scan.priceInfo}:{})
    }));
  } finally { await chrome.tabs.remove(tab.id).catch(()=>{}); await chrome.storage.local.remove('priceCheckTab'); }
}

// 두께로 걸러도 후보가 여러 개 남을 수 있다 — 실사용 중 확인된 것만도: PF보드 브랜드
// 내부/외부(lx/kd/im + i|o), 규격 소형/대형(_s/_l, 또는 비드법 준불연 ib_06/ib_09),
// 신품/B급 같은 품질 등급. 셋 다 두께와는 독립된 축이라 gradeId가 뜻하는 축들로 좁혀나간다.
//
// ⚠️ 각 축을 "적용 가능하면 걸러보고, 하나도 안 남으면 그냥 포기하고 이전 상태 유지"
// 식으로 순서대로 적용했더니, 앞선 축(예: 내/외부)이 먼저 1개로 좁혀버리면 뒤 축(예:
// 규격)이 그 1개를 걸러도 될지 검증할 기회가 없어서 조용히 넘어가버리는 버그가 있었다
// (2026-09-16, LX 상품이 "대형"만 팔아서 규격 표기가 아예 없는데도 lxi_s가 lxi_l과
// 똑같이 매칭되던 문제). 그래서 이제 "이 상품 후보들 안에 그 축이 실제로 존재하는지"부터
// 먼저 확인하고, 존재하는 축들만 모아 동시에(AND) 걸러낸다 — 소형(_s)인데 후보 중
// 600x1200 표기가 하나도 없으면(=이 페이지엔 소형이 아예 없음) 억지로 대형에 매칭하지
// 않고 바로 매칭 불가로 처리한다.
function narrowToOne(candidates, gradeId) {
  if (candidates.length <= 1) return candidates[0] || null;
  const text = r => [r.optionName1, r.optionName2, r.optionName3, r.label].filter(Boolean).join(' ');
  const texts = candidates.map(text);
  const isSmallGrade = /_s$/.test(gradeId) || gradeId === 'ib_06';
  const isLargeGrade = /_l$/.test(gradeId) || gradeId === 'ib_09';

  // 규격 소형/대형 — 소형은 판매자 불문 "600x1200" 표기가 같아 그걸로 고정 판별한다.
  // 후보 중 600x1200 표기가 하나도 없으면 이 페이지엔 소형 자체가 없다는 뜻 — 소형을
  // 찾는 중이면 바로 매칭 불가, 대형을 찾는 중이면 규격 축 자체를 적용하지 않는다
  // (판매자마다 대형 표기 치수가 다 달라서 "아니면 전부 대형"이라고 단정할 수 없음).
  const hasSmallOption = texts.some(t => /600\s*[xX*×]\s*1200/.test(t));
  if (isSmallGrade && !hasSmallOption) return null;

  const checks = [];
  // 브랜드 내부/외부 — grade_id가 lx|kd|im + i(내부)|o(외부) + _s|_l 형태고, 후보 중
  // 실제로 "내"/"외" 표기가 존재할 때만(그런 축이 아예 없는 상품에 들이대지 않기 위함).
  const io = String(gradeId || '').match(/^(?:lx|kd|im)(i|o)_/);
  if (io && texts.some(t => /내|외/.test(t))) checks.push(t => (io[1] === 'i' ? /내/ : /외/).test(t));
  if (hasSmallOption) {
    if (isSmallGrade) checks.push(t => /600\s*[xX*×]\s*1200/.test(t));
    else if (isLargeGrade) checks.push(t => !/600\s*[xX*×]\s*1200/.test(t));
  }

  let scoped = candidates.filter((_, i) => checks.every(check => check(texts[i])));
  // 신품/B급처럼 등급과 무관하게 품질이 갈리는 경우 — 열위 표기가 있는 쪽을 제외한다.
  if (scoped.length > 1) {
    const normal = scoped.filter(r => !/B급|비품|리퍼|아울렛|전시|중고|하자|스크래치|흠집|반품|불량/.test(text(r)));
    if (normal.length) scoped = normal;
  }
  return scoped.length === 1 ? scoped[0] : null;
}

// 경쟁사 상품 검사(2026-09-15) — 같은 GET_COMPETITOR_SCAN_DATA 수집을 그대로 쓰되,
// 대상이 우리 매핑이 아니라 admin이 competitor_prices에 직접 기록해둔 (등급,두께)별
// 가격이다. 한 링크(모음전)에 여러 두께가 옵션으로 같이 걸려있을 수 있어 entries가
// 배열이다 — 옵션이 여러 개면 라벨에서 두께를 뽑아 유일하게 매칭될 때만 비교하고,
// 애매하면(0개/2개 이상 매칭) 추측하지 않고 "옵션 자동 매칭 불가"로 넘긴다.
async function inspectCompetitor(link, entries) {
  const url = new URL(link);
  if (url.origin !== 'https://smartstore.naver.com' || !/^\/[^/]+\/products\/\d+\/?$/.test(url.pathname)) throw Error('허용되지 않은 경쟁사 상품 주소');
  const tab = await chrome.tabs.create({url:url.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:url.href}});
  try {
    let scan;
    for (let n=0;n<25;n++) {
      await delay(1000);
      try { scan = await chrome.tabs.sendMessage(tab.id,{type:'GET_COMPETITOR_SCAN_DATA'}); } catch {}
      if (scan?.ok && scan.benefitReady && scan.detailUrl && scan.benefitUrl) break;
    }
    // 할인 없는 상품은 product-benefits 요청 자체가 발생하지 않을 수 있다. 수집기는 이때도
    // 상품 상세 응답의 salePrice로 행을 만들 수 있으므로, 충분히 기다린 뒤 유효한 행이 있으면
    // 그대로 사용한다. benefit 응답을 무조건 요구하면 정상 상품도 수집 실패가 된다.
    if (!scan?.ok || !Array.isArray(scan.rows) || !scan.rows.length) {
      const detail = scan?.error || scan?.reason;
      throw Error(`페이지 판매가 확인 불가${detail ? ` (${detail})` : ''} — 로그인·차단·삭제 여부 확인 필요`);
    }
    const rows = scan.rows;
    return entries.map(entry => {
      let matched = null;
      // rows.length===1(옵션 없음/단일가)이어도, 이 링크에 두께가 여러 개 묶여있으면(entries.length>1
      // — 모음전으로 기록해둔 경우) 그 단일가가 "이 entry의" 가격이라고 단정할 수 없다. 실제로는
      // 페이지가 딱 한 두께짜리 단품인데 나머지 두께들이 같은 링크로 잘못 기록됐을 수도 있어서,
      // 링크가 정말 단품(entries 1개)일 때만 무조건 매칭하고 그 외엔 라벨에서 두께를 뽑아 확인한다
      // (2026-09-15, 비드법 단품 링크가 여러 두께에 재사용돼 전부 "불일치"로 잘못 뜨던 문제 수정).
      if (rows.length === 1 && entries.length === 1) matched = rows[0];
      else {
        const candidates = rows.filter(r => extractThicknessMm(r.label) === entry.thickness);
        matched = narrowToOne(candidates, entry.gradeId);
      }
      if (!matched) return {...entry, actual:null, status:'옵션 자동 매칭 불가', diff:null};
      if (matched.soldOut) return {...entry, actual:null, status:'품절', diff:null};
      if (!Number.isFinite(matched.finalPrice) || matched.finalPrice <= 0) return {...entry, actual:null, status:'가격 확인 불가', diff:null};
      const status = matched.finalPrice === entry.recordedPrice ? '일치' : '불일치';
      return {...entry, actual:matched.finalPrice, status, diff: matched.finalPrice - entry.recordedPrice};
    });
  } finally { await chrome.tabs.remove(tab.id).catch(()=>{}); await chrome.storage.local.remove('priceCheckTab'); }
}

// One product per alarm; queue and fixed live snapshot survive popup/worker closure.
async function readState(){return (await chrome.storage.local.get('priceTest')).priceTest;}
async function arm(){await chrome.alarms.create(ALARM,{delayInMinutes:0.5});}

function listMapping(item){
  const m={...(item.mapping||{})};
  if(['iso','isopink'].includes(m.product_type)||[true,1,'true','1'].includes(m.is_bundle)||!(Number(m.thickness)>0)||!m.grade_id)return null;
  if(m.product_type==='pu'){
    if(!['ic','iiia','iia','id_in','id_out'].includes(m.grade_id))return null;
    m.area=Number(m.area)||2;
  }else if(m.product_type==='pf'){
    // Old single-product mappings may store a brand prefix plus a fixed area.
    if(!PF_GRADE_AREA[m.grade_id]){
      const candidates=Object.keys(PF_GRADE_AREA).filter(id=>id.startsWith(m.grade_id+'_') && Math.abs(PF_GRADE_AREA[id]-Number(m.area))<1e-8);
      if(candidates.length!==1)return null;
      m.grade_id=candidates[0];
    }
    m.area=PF_GRADE_AREA[m.grade_id];
  }else if(!(Number(m.area)>0))return null;
  m.thickness=Number(m.thickness);return m;
}
function listEligible(item){return listMapping(item)!=null;}
async function readList(url){
  const u=new URL(url);u.searchParams.delete('cp');if(!u.searchParams.has('page'))u.searchParams.set('page','1');
  if(u.origin!=='https://smartstore.naver.com'||!/^\/(energuardcompany|hkdy)\//.test(u.pathname)||u.pathname.includes('/products/'))throw Error('목록 주소 오류');
  const tab=await chrome.tabs.create({url:u.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:u.href}});
  try{
    let previousSignature=null;
    for(let n=0;n<15;n++){
      await delay(1000);
      try{const data=await chrome.tabs.sendMessage(tab.id,{type:'EG_PRICE_LIST_PAGE',targetPage:Number(u.searchParams.get('page'))||1});if(data?.currentPage===(Number(u.searchParams.get('page'))||1) && data?.products?.length){const signature=data.products.map(p=>p.productId+':'+p.price).join('|');if(signature===previousSignature)return data;previousSignature=signature;}}catch{}
    }
    return {products:[],next:null};
  }finally{await chrome.tabs.remove(tab.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
}
function pageParamOf(u){ return 'page'; }
async function listStep(state){
  const url=state.listQueue.shift();
  if(state.listVisited.includes(url))return;
  state.listVisited.push(url);
  const data=await readList(url);
  const listed=new Map(data.products.map(p=>[String(p.productId),p]));
  const hits=[],remaining=[];
  for(const item of state.items.slice(state.done)){
    const p=listed.get(String(item.productId));
    const mapping=listMapping(item);
    const expected=mapping?getTablePrice(mapping,state.pricing):null;
    // 고정 규격·두께 단품은 목록 대표가 검사로 완료한다. 옵션 전체 판정과 구분한다.
    if(p && mapping && Number.isFinite(p.price) && p.price>0){
      hits.push(item);
      const status=!(expected>0)?'단가 확인 불가':p.price===expected?'대표가 일치':'대표가 불일치';
      state.rows.push({productId:item.productId,label:(p.name||'단품')+' — 대표가(옵션 미검사)',actual:p.price,expected:expected>0?expected:null,diff:expected>0?p.price-expected:null,status,source:'상품 목록'});
    } else remaining.push(item);
  }
  state.items=[...state.items.slice(0,state.done),...hits,...remaining];state.done+=hits.length;
  state.listMatched=(state.listMatched||0)+hits.length;
  state.listNoHitStreak = hits.length>0 ? 0 : (state.listNoHitStreak||0)+1;
  if(data.next && remaining.some(listEligible) && !state.listVisited.includes(data.next))state.listQueue.push(data.next);
}
const NEXT_DELAY_MS = 1200; // 2026-09-15: 아이소핑크가 목록 검사를 못 타고 매번 상세 스캔을 도는
// 탓에 유독 느리다는 피드백 — 상품 간 고정 대기를 3초에서 줄였다. 순차 처리(동시 탭 없음)라
// 네이버 요청 빈도 자체는 안 늘어난다(직접 API 조회가 아니라 페이지 로딩 대기라 429와 무관).
async function processNext(){
  if(processing)return;
  processing=true;
  try {
    let state=await readState();
    if(!state || !state.running)return;
    const orphan=(await chrome.storage.local.get('priceCheckTab')).priceCheckTab;
    if(orphan){const old=await chrome.tabs.get(orphan.id).catch(()=>null);if(old?.url===orphan.url)await chrome.tabs.remove(orphan.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
    if(!['competitor','hkd','esm','11st','coupang'].includes(state.kind) && !state.listVisited){
      state.listVisited=[];
      // 카테고리별 목록 URL을 지정해뒀으면(state.listUrl, pricing-check-test.js의
      // CATEGORY_LIST_URL) 전체상품(/category/ALL)에서 찾는 대신 그 URL부터 시작한다 —
      // 상품 수가 훨씬 적어서 더 빠르고 확실하다(2026-09-11).
      if(state.listUrl){
        const u=new URL(state.listUrl);
        const key=pageParamOf(u);
        if(!u.searchParams.get(key))u.searchParams.set(key,'1');
        state.listQueue=[u.href];
      }else{
        const stores=[...new Set(state.items.slice(state.done).filter(listEligible).map(i=>new URL(i.productUrl||'https://smartstore.naver.com/energuardcompany/products/'+i.productId).pathname.split('/')[1]))];
        state.listQueue=stores.map(store=>'https://smartstore.naver.com/'+store+'/category/ALL?st=TOTAL&dt=BIG_IMAGE&cp=1&size=80');
      }
    }
    if(state.listQueue?.length){
      await arm();
      await listStep(state);
      const latest=await readState();
      if(latest?.runId!==state.runId)return;
      state.running=latest.running;state.reason=latest.reason;state.phase='목록 수집';
      if(state.done>=state.total){state.running=false;state.finishedAt=Date.now();state.reason='완료';}
      await save(state);
      if(state.running){await arm();setTimeout(processNext,NEXT_DELAY_MS);}else await chrome.alarms.clear(ALARM);
      return;
    }
    state.phase = state.kind==='competitor' ? '경쟁사 상품 스캔' : state.kind==='esm' ? 'ESM 등록가 검사' : state.kind==='coupang' ? '쿠팡 옵션 검사' : state.kind==='11st' ? (state.mode==='supplement' ? '11번가 추가상품 검사' : '11번가 옵션 검사') : state.kind==='hkd' ? (state.channelId==='homepage'?'홈페이지 가격 검사':state.mode==='supplement' ? '한국단열 추가상품 검사' : '한국단열 옵션 검사') : (listEligible(state.items[state.done]||{})?'단품 목록 누락 확인':'옵션별 상세 검사');
    const item=state.items[state.done];
    if(!item){state.running=false;state.finishedAt=Date.now();await save(state);return;}
    state.currentProduct = state.kind==='competitor' ? item.link : item.productId;await save(state);
    // Watchdog also recovers a worker interrupted during this product.
    await arm();
    let rows,failed=false;
    try{
      if (state.kind==='competitor') rows=await inspectCompetitor(item.link,item.entries);
      else if (state.kind==='esm') rows=await inspectEsm(item);
      else if (state.kind==='coupang') rows=await inspectCoupang(item);
      else if (state.kind==='11st') rows=await inspect11st(item,state.supplements,state.mode);
      else if (state.kind==='hkd') rows=await inspectHkd(item,state.supplements,state.mode);
      else rows=listEligible(item)?[{productId:item.productId,status:'목록 수집 누락',label:'단품 매핑 — 목록에서 가격을 찾지 못했습니다.',source:'상품 목록'}]:await inspect(item,state.pricing);
    }catch(error){
      const errorMessage=error?.message||'상품 정보 수집 실패';
      // ESM의 판매중지·삭제 상품은 해당 행만 실패로 남기고 다음 상품을 계속 검사한다.
      // 로그인·봇 확인·차단 화면은 뒤 상품도 같은 원인으로 실패하므로 기존처럼 일시정지한다.
      failed=!['esm','11st','coupang'].includes(state.kind)||/(?:사이트 확인 화면|봇|bot|차단|로그인)/i.test(errorMessage);
      rows = state.kind==='competitor'
        ? item.entries.map(e=>({...e,actual:null,diff:null,status:'수집 실패',errorMsg:errorMessage}))
        : [{productId:item.productId,productUrl:item.productUrl,store:state.kind==='coupang'?'coupang':item.marketplace||null,status:'수집 실패',label:errorMessage,source:state.kind==='esm'?(item.marketplace==='auction'?'옥션':'G마켓'):state.kind==='11st'?'11번가':state.kind==='coupang'?'쿠팡':'—',...(state.kind==='11st'?{store:'11st'}:{})}];
    }
    const latest=await readState();
    if(latest?.runId!==state.runId)return;
    state=latest;state.rows.push(...rows);state.done++;state.currentProduct=null;state.updatedAt=Date.now();
    if(failed){state.running=false;state.reason='수집 실패로 일시정지';}
    if(state.done>=state.total){state.running=false;state.finishedAt=Date.now();state.reason=failed?'검사 종료 — 수집 실패 포함':'완료';}
    await save(state);
    // 11번가도 G마켓·옥션처럼 짧은 간격으로 많이 열면 봇 차단이 걸릴 수 있어 상품 사이 대기를 늘린다.
    if(state.running){await arm();setTimeout(processNext,['11st','coupang'].includes(state.kind)?3000:NEXT_DELAY_MS);}else await chrome.alarms.clear(ALARM);
  }catch(error){const state=await readState();if(state){state.running=false;state.reason='실행 오류: '+error.message;await save(state);}await chrome.alarms.clear(ALARM);}
  finally{processing=false;}
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)processNext();});
chrome.runtime.onStartup.addListener(async()=>{const state=await readState();if(state?.running)await arm();});
// On a fresh worker instance, ensure an interrupted queue has a wake-up.
readState().then(async state=>{if(state?.running && !await chrome.alarms.get(ALARM))await arm();});
let commandBusy=false;
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='EG_PRICE_TEST')return;
  const host=new URL(sender.url||'https://invalid').hostname;
  if(!['localhost','127.0.0.1','enorangekid.github.io'].includes(host))return;
  (async()=>{
    if(message.action==='ping')return {ok:true,version:chrome.runtime.getManifest().version};
    if(message.action==='status'){
      const s=await readState();
      if(!s)return {ok:true,state:null};
      const {items,pricing,supplements,...state}=s;
      return {ok:true,state};
    }
    if(commandBusy)throw Error('요청 처리 중입니다. 잠시 후 다시 시도해주세요.');
    commandBusy=true;
    try{
      let state=await readState();
      if(message.action==='pause'){
        if(state){state.running=false;state.reason='사용자 일시정지';await save(state);}await chrome.alarms.clear(ALARM);return {ok:true};
      }
      if(message.action==='resume'){
        if(processing)throw Error('현재 상품 처리가 끝난 뒤 재개해주세요.');
        if(!state || state.done>=state.total)throw Error('재개할 검사가 없습니다.');
        state.running=true;state.reason='';await save(state);await arm();processNext();return {ok:true};
      }
      if(message.action!=='start')throw Error('지원하지 않는 요청');
      if(processing || state?.running)throw Error('검사가 이미 실행 중입니다.');
      const p=message.payload;
      if(p?.kind==='competitor'){
        if(!Array.isArray(p.items) || !p.items.length)throw Error('검사할 경쟁사 링크가 없습니다.');
        for(const it of p.items){
          const u=new URL(String(it.link||''));
          if(u.origin!=='https://smartstore.naver.com'||!/^\/[^/]+\/products\/\d+\/?$/.test(u.pathname))throw Error('허용되지 않은 경쟁사 상품 주소');
          if(!Array.isArray(it.entries)||!it.entries.length)throw Error('검사 데이터 오류');
        }
        state={runId:crypto.randomUUID(),kind:'competitor',running:true,startedAt:Date.now(),done:0,total:p.items.length,rows:[],items:p.items};
        await save(state);await arm();processNext();return {ok:true};
      }
      if(p?.kind==='esm'){
        if(!Array.isArray(p.items)||!p.items.length)throw Error('검사할 ESM 상품이 없습니다.');
        for(const it of p.items){
          const id=String(it.productId||'').trim();
          if(it.marketplace==='gmarket'&&!/^\d+$/.test(id))throw Error('G마켓 상품번호 오류');
          if(it.marketplace==='auction'&&!/^[A-Z]\d+$/.test(id))throw Error('옥션 상품번호 오류');
          if(!['gmarket','auction'].includes(it.marketplace))throw Error('ESM 판매처 오류');
          if(!it.unsupported&&!esmProductUrlOk(new URL(String(it.productUrl||'')),it.marketplace,id))throw Error('허용되지 않은 ESM 상품 주소');
          if(it.optionMode&&(!Array.isArray(it.options)||!it.options.length))throw Error('ESM 옵션 검사 데이터 오류');
        }
        const channelId='esm';
        state={runId:crypto.randomUUID(),kind:'esm',channelId,running:true,startedAt:Date.now(),done:0,total:p.items.length,rows:[],items:p.items};
        await save(state);await arm();processNext();return {ok:true};
      }
      if(p?.kind==='11st'){
        if(!Array.isArray(p.items)||!p.items.length)throw Error('검사할 11번가 상품이 없습니다.');
        const mode=p.mode==='supplement'?'supplement':'options';
        for(const it of p.items){
          const id=String(it.productId||'').trim();
          if(!/^\d+$/.test(id))throw Error('11번가 상품번호 오류');
          if(!st11ProductUrlOk(new URL(String(it.productUrl||'https://www.11st.co.kr/products/'+id)),id))throw Error('허용되지 않은 11번가 상품 주소');
          if(mode==='options'&&(!Array.isArray(it.options)||!it.options.length))throw Error('11번가 옵션 검사 데이터 오류');
        }
        if(new Set(p.items.map(i=>String(i.productId))).size!==p.items.length)throw Error('중복 상품번호');
        const supplements=Array.isArray(p.supplements)?p.supplements.slice(0,500).filter(s=>s&&typeof s.name==='string').map(s=>({code:s.code?String(s.code):null,name:String(s.name).slice(0,200),group:s.group?String(s.group).slice(0,80):null,expected:Number.isFinite(Number(s.expected))?Number(s.expected):null,use:s.use==='N'?'N':'Y'})):null;
        if(mode==='supplement'&&!(supplements&&supplements.length))throw Error('추가상품 목록이 없습니다');
        state={runId:crypto.randomUUID(),kind:'11st',channelId:'11st',mode,running:true,startedAt:Date.now(),done:0,total:p.items.length,rows:[],items:p.items,...(mode==='supplement'?{supplements}:{})};
        await save(state);await arm();processNext();return {ok:true};
      }
      if(p?.kind==='coupang'){
        if(!Array.isArray(p.items)||!p.items.length)throw Error('검사할 쿠팡 상품이 없습니다.');
        for(const it of p.items){
          const id=String(it.productId||'').trim();
          if(!/^\d+$/.test(id))throw Error('쿠팡 상품번호 오류');
          if(!coupangProductUrlOk(new URL(String(it.productUrl||`https://www.coupang.com/vp/products/${id}`)),id))throw Error('허용되지 않은 쿠팡 상품 주소');
          if(!Array.isArray(it.options)||!it.options.length||it.options.some(option=>!/^\d+$/.test(String(option.optionId||''))))throw Error('쿠팡 옵션 검사 데이터 오류');
        }
        if(new Set(p.items.map(item=>String(item.productId))).size!==p.items.length)throw Error('중복 상품번호');
        const channelId=p.channelId==='coupang_sub'?'coupang_sub':'coupang';
        state={runId:crypto.randomUUID(),kind:'coupang',channelId,running:true,startedAt:Date.now(),done:0,total:p.items.length,rows:[],items:p.items};
        await save(state);await arm();processNext();return {ok:true};
      }
      if(p?.kind==='hkd'){
        if(!Array.isArray(p.items) || !p.items.length)throw Error('검사할 상품이 없습니다.');
        for(const it of p.items){
          if(!/^\d+$/.test(String(it.productId)))throw Error('상품번호 오류');
          const u=new URL(String(it.productUrl||'https://smartstore.naver.com/hkdy/products/'+it.productId));
          const homepage=p.channelId==='homepage';
          const valid=homepage
            ? u.origin==='https://boonimall.kr'&&u.pathname.replace(/\/$/,'')==='/goods/view'&&u.searchParams.get('no')===String(it.productId)
            : u.origin==='https://smartstore.naver.com'&&hkdProductPathOk(u.pathname,String(it.productId));
          if(!valid)throw Error('허용되지 않은 상품 주소');
          if(p.mode!=='supplement'&&(!Array.isArray(it.options)||!it.options.length))throw Error('검사 데이터 오류');
        }
        if(new Set(p.items.map(i=>String(i.productId))).size!==p.items.length)throw Error('중복 상품번호');
        // 추가상품 검사(mode:'supplement') — 옵션 검사와 따로 돌린다. 추가상품 목록(코드·이름·기대가격·사용여부)이 있어야 한다.
        const supplements=Array.isArray(p.supplements)?p.supplements.slice(0,500).filter(s=>s&&typeof s.name==='string').map(s=>({code:s.code?String(s.code):null,name:String(s.name).slice(0,200),group:s.group?String(s.group).slice(0,80):null,expected:Number.isFinite(Number(s.expected))?Number(s.expected):null,use:s.use==='N'?'N':'Y'})):null;
        const mode=p.channelId==='homepage'?'options':p.mode==='supplement'?'supplement':'options';
        if(mode==='supplement'&&!(supplements&&supplements.length))throw Error('추가상품 목록이 없습니다');
        // 어느 채널(hkd 한국단열 / hkd_life 한국단열라이프)을 검사하는지 남겨 둔다 — 화면이 다른 채널의 검사 결과를 이 채널 결과로 보여주지 않게.
        const channelId=typeof p.channelId==='string'&&/^[a-z0-9_]{1,20}$/.test(p.channelId)?p.channelId:null;
        state={runId:crypto.randomUUID(),kind:'hkd',channelId,mode,running:true,startedAt:Date.now(),done:0,total:p.items.length,rows:[],items:p.items,supplements:mode==='supplement'?supplements:null};
        await save(state);await arm();processNext();return {ok:true};
      }
      if(!p?.pricing?.id || p.pricing.is_live!==true || !Array.isArray(p.items) || !p.items.length || p.items.some(i=>!/^\d+$/.test(String(i.productId)) || !i.mapping))throw Error('검사 데이터 오류');
      if(new Set(p.items.map(i=>String(i.productId))).size!==p.items.length)throw Error('중복 상품번호');
      let listUrl=null;
      if(p.listUrl){
        const u=new URL(String(p.listUrl));
        if(u.origin!=='https://smartstore.naver.com'||!/^\/(energuardcompany|hkdy)\//.test(u.pathname)||u.pathname.includes('/products/'))throw Error('카테고리 목록 URL이 올바르지 않습니다.');
        listUrl=u.href;
      }
      state={runId:crypto.randomUUID(),kind:'own',running:true,startedAt:Date.now(),liveId:p.pricing.id,done:0,total:p.items.length,rows:[],items:p.items,pricing:p.pricing,listUrl};
      await save(state);await arm();processNext();return {ok:true};
    }finally{commandBusy=false;}
  })().then(respond).catch(error=>respond({ok:false,error:error.message}));return true;
});

})();
