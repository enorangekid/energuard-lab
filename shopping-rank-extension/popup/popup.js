// popup.js — 통합 확장 팝업
// 2026-09-02: 원래 별개 확장(energuard-checker)의 popup.js였는데, anon key를 직접 입력받아
// Supabase를 호출하던 방식이 anon 권한 잠금 이후로 계속 조용히 실패하고 있었다. 이 확장으로
// 옮기면서 설정 화면을 없애고, 이미 있는 로그인 세션(service-worker.js의
// FETCH_PRICING_CHECK_DATA 메시지)으로 대신 조회하게 고쳤다 — 그래서 이 고장도 같이 고쳐짐.
// + "경쟁사 가격" 탭 추가(수집 자체는 상품 페이지 열면 자동으로 되고, 여기선 이력만 조회).

const $ = id => document.getElementById(id);

// ── 탭 전환 ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab === 'checker' ? 'paneChecker' : 'paneCompetitor').classList.add('active');
  });
});

// ════════════════════════════════════════
// 내 상품 가격 체커
// ════════════════════════════════════════
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url?.includes('smartstore.naver.com')) {
    $('pageInfo').textContent = '스마트스토어 감지됨';
    setStatus('ok', '체크 준비됨');
  } else {
    $('pageInfo').textContent = '스마트스토어 페이지 아님';
    setStatus('err', '스마트스토어 상품 목록 페이지를 열어주세요');
  }
});

async function ensureContentScript(tabId) {
  try { await chrome.tabs.sendMessage(tabId, { type: 'PING' }); return true; }
  catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['checker-content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['checker-content.css'] });
      await new Promise(r => setTimeout(r, 300));
      return true;
    } catch (e2) { return false; }
  }
}

// 2026-09-02: 콘텐츠 스크립트/서비스워커가 응답을 안 주는 경우(막 새 상품으로 넘어간 직후처럼
// 아직 준비 안 됐거나, 드물게 메시지 채널이 안 붙는 경우) 콜백이 영원히 안 오는 것처럼 보여서
// 스피너가 끝없이 도는 문제가 있었다 — 일정 시간 지나면 확실히 실패로 처리해서 재시도할 수
// 있게 타임아웃을 씌운다.
function withTimeout(promise, ms, timeoutResult) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutResult), ms)),
  ]);
}

function sendToTab(tabId, message, timeoutMs = 8000) {
  const raw = new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (res) => {
      if (chrome.runtime.lastError) { resolve({ ok: false, reason: 'no_content_script', error: chrome.runtime.lastError.message }); return; }
      resolve(res || { ok: false, reason: 'no_content_script' });
    });
  });
  return withTimeout(raw, timeoutMs, { ok: false, reason: 'timeout' });
}

function sendToServiceWorker(message, timeoutMs = 8000) {
  const raw = new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
      resolve(res || { ok: false, error: '응답 없음' });
    });
  });
  return withTimeout(raw, timeoutMs, { ok: false, error: 'timeout' });
}

$('btnCheck').addEventListener('click', async () => {
  showLoading();
  $('btnCheck').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const ready = await ensureContentScript(tab.id);
    if (!ready) { showError('페이지 접근 불가.\n스마트스토어 페이지를 새로고침 해보세요.'); return; }
    const [checkData, products] = await Promise.all([
      sendToServiceWorker({ type: 'FETCH_PRICING_CHECK_DATA' }),
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCTS' }),
    ]);
    if (!checkData.ok) { showError('단가 데이터 로드 실패.\n' + (checkData.error || '') + '\n에너가드랩에 로그인되어 있는지 확인해주세요.'); return; }
    if (!checkData.pricingData) { showError('단가 데이터가 비어있습니다.\n단가표에 원가를 입력해주세요.'); return; }
    if (!products || products.length === 0) { showError('상품을 찾을 수 없습니다.\n상품 목록 페이지인지 확인하세요.'); return; }
    const results = compareProducts(products, checkData.pricingData, checkData.mappingData);
    showResults(results);
  } catch (e) {
    showError('오류: ' + e.message);
  } finally {
    $('btnCheck').disabled = false;
  }
});

$('btnHighlight').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await ensureContentScript(tab.id);
    const [checkData, products] = await Promise.all([
      sendToServiceWorker({ type: 'FETCH_PRICING_CHECK_DATA' }),
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCTS' }),
    ]);
    if (!checkData.ok || !products) return;
    const results = compareProducts(products, checkData.pricingData, checkData.mappingData);
    await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT', results });
  } catch (e) {
    setStatus('err', '하이라이트 오류: ' + e.message);
  }
});

$('btnClear').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await ensureContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHT' });
});

// ════════════════════════════════════════
// 가격 계산 (pricing.js와 동일 규칙 — 원본 energuard-checker 로직 그대로)
// ════════════════════════════════════════
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
  ib_09: 'bead_mj', ib_06: 'bead_mj',
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
function calcIsoRealPrice(data, t) {
  const margins = data.margins || {};
  let cost;
  if (t <= 15) cost = data.cost_900_1800_thin1 || 0;
  else if (t <= 25) cost = data.cost_900_1800_thin2 || 0;
  else if (t <= 180) cost = data.cost_900_1800_mid || 0;
  else cost = data.cost_900_1800_thick || 0;
  if (!cost) return null;
  const ISO_DEFS = {10:35,20:70,30:60,40:60,50:60,60:60,70:60,80:60,90:60,100:60,110:60,120:60,130:60,140:60,150:60,160:60,170:60,180:60,190:55,200:55,210:55,220:55,230:55,240:55,250:55,260:55,270:55,280:55,290:55,300:55};
  const margin = getVal(margins, `margin_iso_t${t}`, ISO_DEFS[t] ?? 55);
  return Math.ceil(Math.round(t * (cost + margin) * 1.1) / 100) * 100;
}
function calcFrRealPrice(costPerM2, marginPerSheet, area) {
  if (!costPerM2) return null;
  const costPerSheet = Math.round(costPerM2 * area);
  const sellPerSheet = costPerSheet + marginPerSheet;
  const vatSell = Math.round(sellPerSheet * 1.1);
  return Math.ceil(vatSell / 100) * 100;
}
function getTablePrice(mapping, pricingData) {
  if (!mapping || !pricingData) return null;
  const { product_type: type, grade_id: gradeId, thickness: t, area } = mapping;
  if (!area) return null;
  const margins = pricingData.margins || {};

  if (type === 'iso') return calcIsoRealPrice(pricingData, t);

  if (type === 'bead') {
    const COST_MAP = { ia1:'bead_cost_ia1', iia1:'bead_cost_iia1', iiia2:'bead_cost_iiia2', ia2:'bead_cost_ia2', iia2:'bead_cost_iia2', iiib:'bead_cost_iiib', ib_09:'bead_cost_ib', ib_06:'bead_cost_ib' };
    const cost = pricingData[COST_MAP[gradeId]] || 0;
    const tKey = Math.min(300, Math.max(10, Math.round(t / 10) * 10));
    const marginKey = `${BEAD_MARGIN_KEY_MAP[gradeId]}_t${tKey}`;
    const margin = getVal(margins, marginKey, BEAD_FB[marginKey] ?? 0);
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
    const marginKey = `pf_m_${mk}_t${t}`;
    const margin = getVal(margins, marginKey, PF_FB[mk]?.[t] ?? 35);
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
function compareProducts(products, pricingData, mappingData) {
  return products.map(p => {
    const mapping = mappingData[p.productId];
    if (!mapping) return { ...p, status: 'unmapped', tablePrice: null };
    const tablePrice = getTablePrice(mapping, pricingData);
    if (!tablePrice) return { ...p, status: 'unknown', tablePrice: null };
    const match = p.price === tablePrice;
    return { ...p, status: match ? 'match' : 'mismatch', tablePrice, diff: p.price - tablePrice };
  });
}

// ════════════════════════════════════════
// 체커 UI
// ════════════════════════════════════════
function showLoading() { $('resultSection').innerHTML = `<div class="loading"><div class="spinner"></div>단가 데이터 로딩 중...</div>`; }
function showError(msg) {
  $('resultSection').innerHTML = `<div class="result-empty" style="color:#ef4444;">${msg.replace(/\n/g,'<br>')}</div>`;
  setStatus('err', '오류 발생');
}
function showResults(results) {
  const total = results.length;
  const matched = results.filter(r => r.status === 'match').length;
  const mismatched = results.filter(r => r.status === 'mismatch').length;
  const unmapped = results.filter(r => r.status === 'unmapped').length;

  const statusMsg = mismatched > 0 ? `체크 완료: ${mismatched}개 불일치` : unmapped === total ? '매핑 등록 필요' : '체크 완료: 전체 일치';
  setStatus(mismatched > 0 ? 'err' : 'ok', statusMsg);

  const summaryHtml = `
    <div class="result-summary">
      <div class="summary-card total"><div class="num">${total}</div><div class="lbl">전체</div></div>
      <div class="summary-card ok"><div class="num">${matched}</div><div class="lbl">일치</div></div>
      <div class="summary-card err"><div class="num">${mismatched}</div><div class="lbl">불일치</div></div>
      <div class="summary-card" style="border-color:#e2e8f0;background:#f8fafc;"><div class="num" style="color:#94a3b8;font-size:18px;">${unmapped}</div><div class="lbl">미등록</div></div>
    </div>`;

  const sorted = [
    ...results.filter(r => r.status === 'mismatch'),
    ...results.filter(r => r.status === 'match'),
    ...results.filter(r => r.status === 'unmapped'),
    ...results.filter(r => r.status === 'unknown'),
  ];

  const listHtml = sorted.map(r => {
    const shortName = r.name?.length > 35 ? r.name.slice(0,35)+'...' : (r.name || r.productId);
    if (r.status === 'mismatch') {
      const diffSign = r.diff > 0 ? '+' : '';
      return `<div class="result-item mismatch"><span class="result-badge">불일치</span><div class="result-info"><div class="result-name">${shortName}</div><div class="result-prices">쇼핑몰 ${r.price.toLocaleString()}원 · 단가표 <span class="table">${r.tablePrice.toLocaleString()}원</span> · <span class="diff">${diffSign}${r.diff.toLocaleString()}원</span></div></div></div>`;
    }
    if (r.status === 'match') {
      return `<div class="result-item match"><span class="result-badge">일치</span><div class="result-info"><div class="result-name">${shortName}</div><div class="result-prices"><span class="match">${r.price.toLocaleString()}원</span></div></div></div>`;
    }
    return `<div class="result-item unmapped"><span class="result-badge">미등록</span><div class="result-info"><div class="result-name">${shortName}</div><div class="result-prices">ID ${r.productId} · ${r.price.toLocaleString()}원</div></div></div>`;
  }).join('');

  $('resultSection').innerHTML = summaryHtml + `<div class="result-list">${listHtml}</div>`;

  if (unmapped > 0) {
    $('resultSection').insertAdjacentHTML('beforeend', `<div class="note-box">미등록 상품 ${unmapped}개는 통합 관리 시스템에서 상품번호를 등록하면 체크가 가능합니다.</div>`);
  }
}
function setStatus(type, msg) {
  const dot = $('statusDot');
  dot.className = 'status-dot' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  $('statusText').textContent = msg;
}

// ════════════════════════════════════════
// 내 상품 — 모음전(옵션형) 상품 체크
// 2026-09-02 추가: 목록 페이지의 가격 하나만 보고 비교하면, 두께 등을 옵션으로 묶어 파는
// 모음전 상품은 옵션 하나(대개 최저가 옵션)만 확인되고 나머지 옵션이 실제로 단가표랑
// 맞는지는 알 수 없었다. smartstore-product-collector.js(경쟁사 가격 수집용으로 이미
// 만든 것 — 상품 상세 API를 가로채 옵션별 최종가를 계산)를 그대로 재사용해서, "우리" 상품
// 상세페이지를 열어도 옵션별 실제가를 가져올 수 있다.
//
// 옵션 라벨 → 실제 계산 파라미터 역산은 pricing.js의 "모음전 옵션 엑셀 저장"(_doSmartStoreExport/
// _doBeadExport/_doPuExport 등)이 기준(정답)이다 — 사장님이 그 엑셀을 그대로 네이버에 업로드해서
// 옵션을 관리하시므로, 라벨 형식이 정확히 그 export 로직이 만든 그대로임이 보장된다.
//   - 아이소핑크/PU/PF/불연: 옵션축 1개(두께만), 등급은 상품 하나에 고정 → product_mapping의
//     grade_id 그대로 쓰고 라벨에서 두께만 추출(resolveOptionMapping 참고)
//   - 비드법: 옵션축 2개(종류+규격) — 등급 자체가 옵션마다 바뀐다("1종3호"/"2종2호" 등, 준불연은
//     규격이 600x1200/900x1800으로 등급을 가름) → product_mapping은 product_type='bead'만
//     있으면 되고, grade_id/thickness/area는 매번 옵션에서 새로 역산(resolveOptionMapping)
//   - PF보드: 옵션축 2개(두께+규격) — 규격(작은/큰 사이즈)에 따라 등급의 _s/_l이 갈리고 면적도
//     다름 → product_mapping의 grade_id엔 mk 접두어만(예: 'lxo') 등록, _s/_l은 옵션에서 판정
// product_mapping에 이 상품번호가 등록되어 있어야 하고, 없으면 "매핑 필요" 안내만 뜬다.
function extractThicknessMm(label) {
  const m = String(label || '').match(/(\d+)\s*T\b/i);
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

$('btnCheckBundle').addEventListener('click', async () => {
  $('btnCheckBundle').disabled = true;
  $('bundleResultSection').innerHTML = `<div class="loading"><div class="spinner"></div>옵션별 가격 확인 중...</div>`;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const idMatch = tab?.url?.match(/\/products\/(\d+)/);
    if (!idMatch) {
      $('bundleResultSection').innerHTML = `<div class="result-empty">상품 상세페이지(.../products/숫자)를 열고 다시 눌러주세요</div>`;
      return;
    }
    const productId = idMatch[1];

    const [scanData, checkData] = await Promise.all([
      sendToTab(tab.id, { type: 'GET_COMPETITOR_SCAN_DATA' }),
      sendToServiceWorker({ type: 'FETCH_PRICING_CHECK_DATA' }),
    ]);

    if (!scanData.ok) {
      const msg = scanData.reason === 'not_ready'
        ? '아직 이 페이지의 옵션 데이터를 다 못 받았습니다. 1~2초 후 다시 눌러주세요.'
        : scanData.reason === 'timeout'
          ? '응답 시간이 초과됐습니다. 페이지가 다 로드된 상태인지 확인하고 다시 눌러주세요.'
          : '페이지에서 옵션 데이터를 가져오지 못했습니다. 새로고침 후 다시 시도해주세요.';
      $('bundleResultSection').innerHTML = `<div class="result-empty">${msg}</div>`;
      return;
    }
    if (!checkData.ok) {
      $('bundleResultSection').innerHTML = `<div class="result-empty" style="color:#ef4444;">단가 데이터 로드 실패: ${checkData.error || ''}</div>`;
      return;
    }
    const mapping = checkData.mappingData[productId];
    if (!mapping) {
      $('bundleResultSection').innerHTML = `<div class="note-box">이 상품(ID ${productId})은 통합 관리 시스템의 상품 매핑에 등록되어 있지 않습니다. product_type(비드법이면 grade_id/area는 필요 없음, 그 외는 grade_id/area도 등록)을 등록해두면 옵션별 체크가 가능합니다.</div>`;
      return;
    }

    const results = scanData.rows.map((r) => {
      const resolved = resolveOptionMapping(mapping, r);
      if (!resolved) return { ...r, status: 'unknown', tablePrice: null };
      const tablePrice = getTablePrice({ product_type: mapping.product_type, grade_id: resolved.gradeId, thickness: resolved.thickness, area: resolved.area }, checkData.pricingData);
      if (!tablePrice) return { ...r, status: 'unknown', tablePrice: null };
      const match = r.finalPrice === tablePrice;
      return { ...r, thickness: resolved.thickness, tablePrice, status: match ? 'match' : 'mismatch', diff: r.finalPrice - tablePrice };
    });
    renderBundleResults(scanData.productName, results);
  } catch (e) {
    $('bundleResultSection').innerHTML = `<div class="result-empty" style="color:#ef4444;">오류: ${e.message}</div>`;
  } finally {
    $('btnCheckBundle').disabled = false;
  }
});

function renderBundleResults(productName, results) {
  const mismatched = results.filter(r => r.status === 'mismatch').length;
  const matched = results.filter(r => r.status === 'match').length;
  const unknown = results.filter(r => r.status === 'unknown').length;

  const summaryHtml = `
    <div class="result-summary">
      <div class="summary-card total"><div class="num">${results.length}</div><div class="lbl">옵션</div></div>
      <div class="summary-card ok"><div class="num">${matched}</div><div class="lbl">일치</div></div>
      <div class="summary-card err"><div class="num">${mismatched}</div><div class="lbl">불일치</div></div>
    </div>`;

  const sorted = [
    ...results.filter(r => r.status === 'mismatch'),
    ...results.filter(r => r.status === 'match'),
    ...results.filter(r => r.status === 'unknown'),
  ];
  const rowsHtml = sorted.map((r) => {
    if (r.status === 'mismatch') {
      const sign = r.diff > 0 ? '+' : '';
      return `<div class="result-item mismatch"><span class="result-badge">불일치</span><div class="result-info"><div class="result-name">${r.label}</div><div class="result-prices">쇼핑몰 ${r.finalPrice.toLocaleString()}원 · 단가표 <span class="table">${r.tablePrice.toLocaleString()}원</span> · <span class="diff">${sign}${r.diff.toLocaleString()}원</span></div></div></div>`;
    }
    if (r.status === 'match') {
      return `<div class="result-item match"><span class="result-badge">일치</span><div class="result-info"><div class="result-name">${r.label}</div><div class="result-prices"><span class="match">${r.finalPrice.toLocaleString()}원</span></div></div></div>`;
    }
    return `<div class="result-item unmapped"><span class="result-badge">확인불가</span><div class="result-info"><div class="result-name">${r.label}</div><div class="result-prices">두께 인식 실패 또는 원가 미입력 · ${(r.finalPrice ?? 0).toLocaleString()}원</div></div></div>`;
  }).join('');

  $('bundleResultSection').innerHTML = `<div class="scan-item"><div class="scan-name">${productName}</div></div>${summaryHtml}<div class="result-list">${rowsHtml}</div>`;
}

// ════════════════════════════════════════
// 경쟁사 가격 — 현재 페이지 수집(2026-09-02: 자동수집 대신 팝업 버튼으로 변경)
// ════════════════════════════════════════
function setCompStatus(type, msg) {
  const dot = $('compStatusDot');
  dot.className = 'status-dot' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  $('compStatusText').textContent = msg;
}
function fmtWon(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }

$('btnCollectHere').addEventListener('click', async () => {
  $('btnCollectHere').disabled = true;
  $('collectResultSection').innerHTML = `<div class="loading"><div class="spinner"></div>수집 중...</div>`;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('smartstore.naver.com') || !/\/products\/\d+/.test(tab.url)) {
      setCompStatus('err', '경쟁사 상품 상세페이지가 아닙니다');
      $('collectResultSection').innerHTML = `<div class="result-empty">스마트스토어 상품 상세페이지(.../products/숫자)를 열고 다시 눌러주세요</div>`;
      return;
    }
    const scanData = await sendToTab(tab.id, { type: 'GET_COMPETITOR_SCAN_DATA' });
    if (!scanData.ok) {
      const msg = scanData.reason === 'not_ready'
        ? '아직 이 페이지의 가격 데이터를 다 못 받았습니다. 1~2초 후 다시 눌러주세요.'
        : scanData.reason === 'timeout'
          ? '응답 시간이 초과됐습니다. 페이지가 다 로드된 상태인지 확인하고 다시 눌러주세요.'
          : '페이지에서 데이터를 가져오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
      setCompStatus('err', '수집 실패');
      $('collectResultSection').innerHTML = `<div class="result-empty">${msg}</div>`;
      return;
    }
    const saveRes = await sendToServiceWorker({
      type: 'SAVE_COMPETITOR_SCAN',
      payload: { productUrl: scanData.productUrl, productName: scanData.productName, storeName: scanData.storeName, rows: scanData.rows },
    });
    if (!saveRes.ok) {
      setCompStatus('err', '저장 실패');
      $('collectResultSection').innerHTML = `<div class="result-empty" style="color:#ef4444;">저장 실패: ${saveRes.error || '알 수 없는 오류'}</div>`;
      return;
    }
    const changeCount = saveRes.changes?.length || 0;
    const ambiguousCount = saveRes.ambiguous || 0;
    setCompStatus('ok', `원본 ${saveRes.savedRaw}건 저장 · 자동반영 ${saveRes.matched}건`
      + (changeCount ? ` · 변동 ${changeCount}건` : '')
      + (ambiguousCount ? ` · 규격 구분 안 됨 ${ambiguousCount}건(수동 확인 필요)` : ''));
    const diffByLabel = new Map((saveRes.changes || []).map(c => [c.label, c.diff]));
    const rowsHtml = scanData.rows.map(r => {
      const diff = diffByLabel.get(r.label);
      const diffHtml = diff ? `<span class="${diff > 0 ? 'scan-diff-up' : 'scan-diff-down'}">${diff > 0 ? '▲' : '▼'}${Math.abs(diff).toLocaleString()}</span>` : '';
      return `<div class="scan-row"${r.soldOut ? ' style="opacity:.45;"' : ''}><span>${r.label}</span><span>${r.soldOut ? '품절' : fmtWon(r.finalPrice) + ' ' + diffHtml}</span></div>`;
    }).join('');
    $('collectResultSection').innerHTML = `<div class="scan-item"><div class="scan-name">${scanData.productName}</div><div class="scan-meta">${scanData.storeName || ''}</div>${rowsHtml}</div>`;
  } catch (e) {
    setCompStatus('err', '오류: ' + e.message);
  } finally {
    $('btnCollectHere').disabled = false;
  }
});

// ════════════════════════════════════════
// 경쟁사 가격 — 최근 수집 이력 조회
// ════════════════════════════════════════
$('btnRefreshScans').addEventListener('click', async () => {
  $('scanSection').innerHTML = `<div class="loading"><div class="spinner"></div>불러오는 중...</div>`;
  const res = await sendToServiceWorker({ type: 'FETCH_COMPETITOR_SCAN_HISTORY', limit: 30 });
  if (!res.ok) {
    $('scanSection').innerHTML = `<div class="result-empty" style="color:#ef4444;">${res.error || '조회 실패'}<br>에너가드랩에 로그인되어 있는지 확인해주세요.</div>`;
    return;
  }
  if (!res.rows?.length) {
    $('scanSection').innerHTML = `<div class="result-empty">아직 수집된 경쟁사 가격이 없습니다.<br>경쟁사 상품 페이지를 열어보세요.</div>`;
    return;
  }
  // 상품(product_url)별로 묶어서, 최근 것부터 카드로 보여줌
  const byProduct = new Map();
  res.rows.forEach(r => {
    if (!byProduct.has(r.product_url)) byProduct.set(r.product_url, { name: r.product_name, store: r.store_name, collectedAt: r.collected_at, options: [] });
    byProduct.get(r.product_url).options.push(r);
  });
  const html = [...byProduct.entries()].map(([url, p]) => {
    const rows = p.options.slice(0, 6).map(o => {
      const diffHtml = o.price_diff ? `<span class="${o.price_diff > 0 ? 'scan-diff-up' : 'scan-diff-down'}">${o.price_diff > 0 ? '▲' : '▼'}${Math.abs(o.price_diff).toLocaleString()}</span>` : '';
      return `<div class="scan-row"><span>${o.option_label || '-'}</span><span>${(o.final_price ?? 0).toLocaleString()}원 ${diffHtml}</span></div>`;
    }).join('');
    const more = p.options.length > 6 ? `<div class="scan-meta">외 ${p.options.length - 6}개 옵션</div>` : '';
    return `<div class="scan-item">
      <div class="scan-name">${p.name || url}</div>
      <div class="scan-meta">${p.store || ''} · ${new Date(p.collectedAt).toLocaleString('ko-KR')}</div>
      ${rows}${more}
    </div>`;
  }).join('');
  $('scanSection').innerHTML = html;
});
