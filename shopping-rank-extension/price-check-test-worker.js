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

// One product per alarm; queue and fixed live snapshot survive popup/worker closure.
async function readState(){return (await chrome.storage.local.get('priceTest')).priceTest;}
async function arm(){await chrome.alarms.create(ALARM,{delayInMinutes:0.5});}

function listEligible(item){
  const m=item.mapping||{};
  // ISO single products may contain 1호/특호 choices; keep detailed inspection.
  return m.product_type!=='iso' && m.product_type!=='isopink' && !m.is_bundle && Number(m.thickness)>0 && Number(m.area)>0 && !!m.grade_id && getTablePrice(m,{})!==0;
}
async function readList(url){
  const u=new URL(url);
  if(u.origin!=='https://smartstore.naver.com'||!/^\/(energuardcompany|hkdy)\//.test(u.pathname)||u.pathname.includes('/products/'))throw Error('목록 주소 오류');
  const tab=await chrome.tabs.create({url:u.href,active:false});
  await chrome.storage.local.set({priceCheckTab:{id:tab.id,url:u.href}});
  try{
    for(let n=0;n<15;n++){
      await delay(1000);
      try{const data=await chrome.tabs.sendMessage(tab.id,{type:'EG_PRICE_LIST_PAGE'});if(data?.products?.length)return data;}catch{}
    }
    return {products:[],next:null};
  }finally{await chrome.tabs.remove(tab.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
}
async function listStep(state){
  const url=state.listQueue.shift();
  if(state.listVisited.includes(url))return;
  state.listVisited.push(url);
  const data=await readList(url);
  const listed=new Map(data.products.map(p=>[String(p.productId),p]));
  const hits=[],remaining=[];
  for(const item of state.items.slice(state.done)){
    const p=listed.get(String(item.productId));
    const expected=getTablePrice(item.mapping,state.pricing);
    // 목록에서 찾은 단품(옵션 없는 제품군)은 대표가 = 실제 판매가이므로 일치든 불일치든
    // 여기서 바로 확정한다(상세페이지 안 들어가 시간 절약 — 테스트 중 불일치가 많아도 빠름).
    // 옵션 붙는 아이소핑크 단품/모음전은 listEligible=false라 이 경로 안 탐. 목록에서
    // 못 찾았거나 이름이 모음전스러우면(remaining) 상세 스캔으로 넘긴다.
    if(p && listEligible(item) && !/모음|선택|종합/.test(p.name||'') && Number.isFinite(p.price)){
      hits.push(item);
      const status=!(expected>0)?'단가 확인 불가':p.price===expected?'일치':'불일치';
      state.rows.push({productId:item.productId,label:(p.name||'단품')+' — 대표가(옵션 미검사)',actual:p.price,expected:expected>0?expected:null,diff:expected>0?p.price-expected:null,status,source:'상품 목록'});
    } else remaining.push(item);
  }
  state.items=[...state.items.slice(0,state.done),...hits,...remaining];state.done+=hits.length;
  state.listMatched=(state.listMatched||0)+hits.length;
  // 연속으로 몇 페이지째 하나도 못 맞히면(카테고리 상품들이 이 목록에 아예 안 걸리는
  // 경우 — 예: PF보드처럼 카드가 옵션조합 대표가라 단품 매핑과 안 맞음) 끝까지 훑어봐야
  // 소용없다고 보고 목록을 포기한다. 안 그러면 최대 30페이지를 전부 열었다 닫으며
  // 진행률이 하나도 안 올라가는 것처럼 보인다(2026-09-11 PF보드 카테고리에서 실사용 중 발견).
  state.listNoHitStreak = hits.length>0 ? 0 : (state.listNoHitStreak||0)+1;
  // 다음 페이지는 카테고리 페이지의 <a> 링크(data.next)에 의존하지 않고 이 URL의 page
  // 파라미터를 직접 +1 해서 만든다 — SPA 카테고리 목록은 페이지네이션이 실제 <a href>가
  // 아니라 버튼/스크립트로 되어 있는 경우가 많아 링크 탐색이 못 찾으면 1페이지(최대 80개)
  // 만 긁고 끝나버려, 카테고리 필터로 골라낸 상품들이 뒤 페이지에 몰려있으면 전부 상세
  // 스캔으로 새는 문제가 있었다(2026-09-11).
  const prev=new URL(url);
  const curPage=Number(prev.searchParams.get('page'))||1;
  if(data.products.length>0 && curPage<30 && state.listNoHitStreak<3 && remaining.some(listEligible)){
    const nextUrl=new URL(url);
    nextUrl.searchParams.set('page',String(curPage+1));
    if(!state.listVisited.includes(nextUrl.href))state.listQueue.push(nextUrl.href);
  }
}
async function processNext(){
  if(processing)return;
  processing=true;
  try {
    let state=await readState();
    if(!state || !state.running)return;
    const orphan=(await chrome.storage.local.get('priceCheckTab')).priceCheckTab;
    if(orphan){const old=await chrome.tabs.get(orphan.id).catch(()=>null);if(old?.url===orphan.url)await chrome.tabs.remove(orphan.id).catch(()=>{});await chrome.storage.local.remove('priceCheckTab');}
    if(!state.listVisited){
      state.listVisited=[];
      const stores=[...new Set(state.items.slice(state.done).filter(listEligible).map(i=>new URL(i.productUrl||'https://smartstore.naver.com/energuardcompany/products/'+i.productId).pathname.split('/')[1]))];
      state.listQueue=stores.map(store=>'https://smartstore.naver.com/'+store+'/category/ALL?st=TOTAL&dt=BIG_IMAGE&page=1&size=80');
    }
    if(state.listQueue.length){
      await arm();
      await listStep(state);
      const latest=await readState();
      if(latest?.runId!==state.runId)return;
      state.running=latest.running;state.reason=latest.reason;state.phase='목록 수집';
      if(state.done>=state.total){state.running=false;state.finishedAt=Date.now();state.reason='완료';}
      await save(state);
      if(state.running){await arm();setTimeout(processNext,3000);}else await chrome.alarms.clear(ALARM);
      return;
    }
    state.phase='옵션 상세 검사';
    const item=state.items[state.done];
    if(!item){state.running=false;state.finishedAt=Date.now();await save(state);return;}
    state.currentProduct=item.productId;await save(state);
    // Watchdog also recovers a worker interrupted during this product.
    await arm();
    let rows,failed=false;
    try{rows=await inspect(item,state.pricing);}catch(error){failed=true;rows=[{productId:item.productId,status:'수집 실패',label:error.message}];}
    const latest=await readState();
    if(latest?.runId!==state.runId)return;
    state=latest;state.rows.push(...rows);state.done++;state.currentProduct=null;state.updatedAt=Date.now();
    if(failed){state.running=false;state.reason='수집 실패로 일시정지';}
    if(state.done>=state.total){state.running=false;state.finishedAt=Date.now();state.reason=failed?'검사 종료 — 수집 실패 포함':'완료';}
    await save(state);
    if(state.running){await arm();setTimeout(processNext,3000);}else await chrome.alarms.clear(ALARM);
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
    if(message.action==='ping')return {ok:true,version:'0.29.3'};
    if(message.action==='status'){
      const s=await readState();
      if(!s)return {ok:true,state:null};
      const {items,pricing,...state}=s;
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
      if(!p?.pricing?.id || p.pricing.is_live!==true || !Array.isArray(p.items) || !p.items.length || p.items.some(i=>!/^\d+$/.test(String(i.productId)) || !i.mapping))throw Error('검사 데이터 오류');
      if(new Set(p.items.map(i=>String(i.productId))).size!==p.items.length)throw Error('중복 상품번호');
      state={runId:crypto.randomUUID(),running:true,startedAt:Date.now(),liveId:p.pricing.id,done:0,total:p.items.length,rows:[],items:p.items,pricing:p.pricing};
      await save(state);await arm();processNext();return {ok:true};
    }finally{commandBusy=false;}
  })().then(respond).catch(error=>respond({ok:false,error:error.message}));return true;
});

})();
