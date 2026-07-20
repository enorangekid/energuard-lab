/* ─────────────────────────────────────────
   칸칸 — 단열재 적재·운임 계산기 (freight.js)
   ───────────────────────────────────────── */

console.log('freight.js 로드됨');
'use strict';

// ── 데이터 ──
const XPS_DATA = { 10:50, 20:22, 30:15, 40:12, 50:10, 60:8, 70:7, 80:6, 90:5, 100:4, 110:4, 120:4, 130:3, 140:3, 150:3, 160:3, 170:2, 180:2 };

const TRUCK_SPECS = [
  { key:'1ton',      name:'1톤 용달',  width:1600, height:2800, lenRows:3, type:'single',      floorCount:3,  safeHeight:2500 },
  { key:'1.4ton',    name:'1.4톤 용달',width:1600, height:3100, lenRows:4, type:'single',      floorCount:4,  safeHeight:2600 },
  { key:'2.5ton',    name:'2.5톤',     width:2000, height:4300, type:'mixed_2.5',              floorCount:5,  safeHeight:2800 },
  { key:'3.5ton',    name:'3.5톤',     width:2050, height:4600, type:'mixed_3.5',              floorCount:6,  safeHeight:3000 },
  { key:'5ton',      name:'5톤',       width:2300, height:6200, type:'overhang_5t',            floorCount:8,  safeHeight:3200 },
  { key:'5ton_plus', name:'5톤 장축',  width:2350, height:8000, type:'overhang_5t_plus',       floorCount:10, safeHeight:3300 },
];

const DISTANCE_RATES = [
  { label:'30km 이내',  maxKm:30,       '1ton':70000,  '1.4ton':90000,  '2.5ton':110000, '3.5ton':120000, '5ton':140000, '5ton_plus':160000 },
  { label:'50km 이내',  maxKm:50,       '1ton':80000,  '1.4ton':105000, '2.5ton':130000, '3.5ton':140000, '5ton':160000, '5ton_plus':180000 },
  { label:'70km 이내',  maxKm:70,       '1ton':90000,  '1.4ton':120000, '2.5ton':150000, '3.5ton':160000, '5ton':180000, '5ton_plus':200000 },
  { label:'90km 이내',  maxKm:90,       '1ton':100000, '1.4ton':135000, '2.5ton':170000, '3.5ton':180000, '5ton':200000, '5ton_plus':220000 },
  { label:'110km 이내', maxKm:110,      '1ton':120000, '1.4ton':155000, '2.5ton':190000, '3.5ton':200000, '5ton':220000, '5ton_plus':240000 },
  { label:'130km 이내', maxKm:130,      '1ton':140000, '1.4ton':175000, '2.5ton':210000, '3.5ton':220000, '5ton':240000, '5ton_plus':260000 },
  { label:'150km 이내', maxKm:150,      '1ton':160000, '1.4ton':195000, '2.5ton':230000, '3.5ton':240000, '5ton':260000, '5ton_plus':290000 },
  { label:'170km 이내', maxKm:170,      '1ton':180000, '1.4ton':215000, '2.5ton':250000, '3.5ton':260000, '5ton':280000, '5ton_plus':320000 },
  { label:'200km 이내', maxKm:200,      '1ton':200000, '1.4ton':235000, '2.5ton':270000, '3.5ton':280000, '5ton':310000, '5ton_plus':350000 },
  { label:'250km 이내', maxKm:250,      '1ton':220000, '1.4ton':255000, '2.5ton':290000, '3.5ton':300000, '5ton':340000, '5ton_plus':380000 },
  { label:'300km 이내', maxKm:300,      '1ton':240000, '1.4ton':280000, '2.5ton':320000, '3.5ton':330000, '5ton':370000, '5ton_plus':420000 },
  { label:'350km 이내', maxKm:350,      '1ton':260000, '1.4ton':305000, '2.5ton':350000, '3.5ton':360000, '5ton':400000, '5ton_plus':460000 },
  { label:'400km 이내', maxKm:400,      '1ton':280000, '1.4ton':330000, '2.5ton':380000, '3.5ton':400000, '5ton':440000, '5ton_plus':500000 },
  { label:'400km 초과', maxKm:Infinity, '1ton':320000, '1.4ton':375000, '2.5ton':430000, '3.5ton':450000, '5ton':500000, '5ton_plus':570000 },
];

const FACTORIES = {
  pocheoni: { lat:37.8912, lng:127.1553, name:'포천 출고', addr:'경기도 포천시 가산면 금현리 798-3' },
  paju:     { lat:37.8487, lng:126.8632, name:'파주 출고', addr:'경기도 파주시 법원읍 못말길 371-34' },
  eumseong: { lat:36.9432, lng:127.5761, name:'음성 출고', addr:'충북 음성군 금왕읍 대금로 1278번길 70-8' },
  asan:     { lat:36.8261, lng:126.9512, name:'아산 출고', addr:'충남 아산시 인주면 인주산단로 75-80' },
};

const AREA_DB = [
  {n:'서울 종로구',lat:37.5730,lng:126.9795},{n:'서울 중구',lat:37.5636,lng:126.9975},{n:'서울 용산구',lat:37.5384,lng:126.9654},{n:'서울 성동구',lat:37.5634,lng:127.0369},{n:'서울 광진구',lat:37.5384,lng:127.0822},{n:'서울 동대문구',lat:37.5744,lng:127.0396},{n:'서울 중랑구',lat:37.6063,lng:127.0927},{n:'서울 성북구',lat:37.5894,lng:127.0167},{n:'서울 강북구',lat:37.6396,lng:127.0257},{n:'서울 도봉구',lat:37.6688,lng:127.0471},{n:'서울 노원구',lat:37.6543,lng:127.0568},{n:'서울 은평구',lat:37.6177,lng:126.9227},{n:'서울 서대문구',lat:37.5791,lng:126.9368},{n:'서울 마포구',lat:37.5663,lng:126.9014},{n:'서울 양천구',lat:37.5170,lng:126.8665},{n:'서울 강서구',lat:37.5509,lng:126.8496},{n:'서울 구로구',lat:37.4954,lng:126.8875},{n:'서울 금천구',lat:37.4569,lng:126.8953},{n:'서울 영등포구',lat:37.5262,lng:126.8967},{n:'서울 동작구',lat:37.5124,lng:126.9393},{n:'서울 관악구',lat:37.4784,lng:126.9516},{n:'서울 서초구',lat:37.4837,lng:127.0324},{n:'서울 강남구',lat:37.5172,lng:127.0473},{n:'서울 송파구',lat:37.5145,lng:127.1059},{n:'서울 강동구',lat:37.5301,lng:127.1238},
  {n:'경기 수원시',lat:37.2636,lng:127.0286},{n:'경기 성남시',lat:37.4449,lng:127.1388},{n:'경기 의정부시',lat:37.7381,lng:127.0337},{n:'경기 안양시',lat:37.3943,lng:126.9568},{n:'경기 부천시',lat:37.5034,lng:126.7660},{n:'경기 광명시',lat:37.4786,lng:126.8646},{n:'경기 평택시',lat:36.9921,lng:127.1129},{n:'경기 동두천시',lat:37.9035,lng:127.0607},{n:'경기 안산시',lat:37.3219,lng:126.8308},{n:'경기 고양시',lat:37.6584,lng:126.8320},{n:'경기 과천시',lat:37.4292,lng:126.9876},{n:'경기 구리시',lat:37.5943,lng:127.1296},{n:'경기 남양주시',lat:37.6360,lng:127.2165},{n:'경기 오산시',lat:37.1500,lng:127.0772},{n:'경기 시흥시',lat:37.3800,lng:126.8030},{n:'경기 군포시',lat:37.3615,lng:126.9354},{n:'경기 의왕시',lat:37.3448,lng:126.9685},{n:'경기 하남시',lat:37.5396,lng:127.2149},{n:'경기 용인시',lat:37.2411,lng:127.1776},{n:'경기 파주시',lat:37.7600,lng:126.7797},{n:'경기 이천시',lat:37.2722,lng:127.4352},{n:'경기 안성시',lat:37.0078,lng:127.2797},{n:'경기 김포시',lat:37.6152,lng:126.7156},{n:'경기 화성시',lat:37.1993,lng:126.8317},{n:'경기 광주시',lat:37.4296,lng:127.2554},{n:'경기 양주시',lat:37.7850,lng:127.0460},{n:'경기 포천시',lat:37.8949,lng:127.2003},{n:'경기 여주시',lat:37.2983,lng:127.6376},{n:'경기 연천군',lat:38.0963,lng:127.0748},{n:'경기 가평군',lat:37.8316,lng:127.5109},{n:'경기 양평군',lat:37.4914,lng:127.4874},
  {n:'인천 중구',lat:37.4738,lng:126.6216},{n:'인천 동구',lat:37.4740,lng:126.6434},{n:'인천 미추홀구',lat:37.4638,lng:126.6503},{n:'인천 연수구',lat:37.4103,lng:126.6781},{n:'인천 남동구',lat:37.4469,lng:126.7316},{n:'인천 부평구',lat:37.5078,lng:126.7216},{n:'인천 계양구',lat:37.5376,lng:126.7376},{n:'인천 서구',lat:37.5454,lng:126.6760},{n:'인천 강화군',lat:37.7472,lng:126.4877},{n:'인천 옹진군',lat:37.4462,lng:126.3631},
  {n:'강원 춘천시',lat:37.8813,lng:127.7298},{n:'강원 원주시',lat:37.3422,lng:127.9202},{n:'강원 강릉시',lat:37.7519,lng:128.8761},{n:'강원 동해시',lat:37.5247,lng:129.1142},{n:'강원 태백시',lat:37.1636,lng:128.9856},{n:'강원 속초시',lat:38.2070,lng:128.5918},{n:'강원 삼척시',lat:37.4499,lng:129.1658},{n:'강원 홍천군',lat:37.6974,lng:127.8884},{n:'강원 횡성군',lat:37.4916,lng:127.9846},{n:'강원 영월군',lat:37.1836,lng:128.4614},{n:'강원 평창군',lat:37.3703,lng:128.3904},{n:'강원 정선군',lat:37.3802,lng:128.6602},{n:'강원 철원군',lat:38.1463,lng:127.3132},{n:'강원 화천군',lat:38.1063,lng:127.7066},{n:'강원 양구군',lat:38.1063,lng:127.9900},{n:'강원 인제군',lat:38.0692,lng:128.1700},{n:'강원 고성군',lat:38.3801,lng:128.4677},{n:'강원 양양군',lat:38.0753,lng:128.6189},
  {n:'충북 청주시',lat:36.6424,lng:127.4890},{n:'충북 충주시',lat:36.9910,lng:127.9259},{n:'충북 제천시',lat:37.1326,lng:128.1909},{n:'충북 보은군',lat:36.4893,lng:127.7295},{n:'충북 옥천군',lat:36.3062,lng:127.5706},{n:'충북 영동군',lat:36.1751,lng:127.7761},{n:'충북 증평군',lat:36.7853,lng:127.5814},{n:'충북 진천군',lat:36.8554,lng:127.4355},{n:'충북 괴산군',lat:36.8159,lng:127.7862},{n:'충북 음성군',lat:36.9402,lng:127.6932},{n:'충북 단양군',lat:36.9847,lng:128.3654},
  {n:'충남 천안시',lat:36.8151,lng:127.1139},{n:'충남 공주시',lat:36.4465,lng:127.1192},{n:'충남 보령시',lat:36.3332,lng:126.6127},{n:'충남 아산시',lat:36.7898,lng:127.0022},{n:'충남 서산시',lat:36.7846,lng:126.4503},{n:'충남 논산시',lat:36.1868,lng:127.0987},{n:'충남 계룡시',lat:36.2748,lng:127.2490},{n:'충남 당진시',lat:36.8895,lng:126.6450},{n:'충남 금산군',lat:36.1091,lng:127.4880},{n:'충남 부여군',lat:36.2754,lng:126.9093},{n:'충남 서천군',lat:36.0815,lng:126.6915},{n:'충남 청양군',lat:36.4594,lng:126.8024},{n:'충남 홍성군',lat:36.6012,lng:126.6603},{n:'충남 예산군',lat:36.6797,lng:126.8475},{n:'충남 태안군',lat:36.7458,lng:126.2982},
  {n:'대전 동구',lat:36.3122,lng:127.4544},{n:'대전 중구',lat:36.3254,lng:127.4213},{n:'대전 서구',lat:36.3554,lng:127.3831},{n:'대전 유성구',lat:36.3624,lng:127.3564},{n:'대전 대덕구',lat:36.3465,lng:127.4153},
  {n:'세종시',lat:36.4801,lng:127.2890},
  {n:'전북 전주시',lat:35.8242,lng:127.1480},{n:'전북 군산시',lat:35.9675,lng:126.7369},{n:'전북 익산시',lat:35.9483,lng:126.9577},{n:'전북 정읍시',lat:35.5699,lng:126.8486},{n:'전북 남원시',lat:35.4164,lng:127.3900},{n:'전북 김제시',lat:35.8032,lng:126.8802},{n:'전북 완주군',lat:35.9047,lng:127.1622},{n:'전북 진안군',lat:35.7918,lng:127.4242},{n:'전북 무주군',lat:35.9084,lng:127.6610},{n:'전북 장수군',lat:35.6476,lng:127.5213},{n:'전북 임실군',lat:35.6175,lng:127.2895},{n:'전북 순창군',lat:35.3742,lng:127.1369},{n:'전북 고창군',lat:35.4357,lng:126.7022},{n:'전북 부안군',lat:35.7319,lng:126.7334},
  {n:'전남 목포시',lat:34.8118,lng:126.3922},{n:'전남 여수시',lat:34.7604,lng:127.6622},{n:'전남 순천시',lat:34.9506,lng:127.4872},{n:'전남 나주시',lat:35.0160,lng:126.7107},{n:'전남 광양시',lat:34.9407,lng:127.6957},{n:'전남 담양군',lat:35.3217,lng:126.9881},{n:'전남 곡성군',lat:35.2817,lng:127.2919},{n:'전남 구례군',lat:35.2028,lng:127.4622},{n:'전남 고흥군',lat:34.6044,lng:127.2762},{n:'전남 보성군',lat:34.7713,lng:127.0800},{n:'전남 화순군',lat:35.0647,lng:126.9864},{n:'전남 장흥군',lat:34.6813,lng:126.9076},{n:'전남 강진군',lat:34.6414,lng:126.7672},{n:'전남 해남군',lat:34.5740,lng:126.5993},{n:'전남 영암군',lat:34.8000,lng:126.6967},{n:'전남 무안군',lat:34.9902,lng:126.4814},{n:'전남 함평군',lat:35.0653,lng:126.5190},{n:'전남 영광군',lat:35.2775,lng:126.5120},{n:'전남 장성군',lat:35.3018,lng:126.7899},{n:'전남 완도군',lat:34.3100,lng:126.7540},{n:'전남 진도군',lat:34.4863,lng:126.2631},{n:'전남 신안군',lat:34.8299,lng:126.1075},
  {n:'광주 동구',lat:35.1460,lng:126.9231},{n:'광주 서구',lat:35.1525,lng:126.8912},{n:'광주 남구',lat:35.1334,lng:126.9027},{n:'광주 북구',lat:35.1739,lng:126.9120},{n:'광주 광산구',lat:35.1396,lng:126.7936},
  {n:'경북 포항시',lat:36.0190,lng:129.3435},{n:'경북 경주시',lat:35.8562,lng:129.2247},{n:'경북 김천시',lat:36.1397,lng:128.1136},{n:'경북 안동시',lat:36.5684,lng:128.7294},{n:'경북 구미시',lat:36.1195,lng:128.3446},{n:'경북 영주시',lat:36.8057,lng:128.6240},{n:'경북 영천시',lat:35.9733,lng:128.9381},{n:'경북 상주시',lat:36.4108,lng:128.1588},{n:'경북 문경시',lat:36.5862,lng:128.1869},{n:'경북 경산시',lat:35.8250,lng:128.7415},{n:'경북 의성군',lat:36.3524,lng:128.6977},{n:'경북 청송군',lat:36.4355,lng:129.0571},{n:'경북 영양군',lat:36.6671,lng:129.1126},{n:'경북 영덕군',lat:36.4153,lng:129.3655},{n:'경북 청도군',lat:35.6476,lng:128.7342},{n:'경북 고령군',lat:35.7277,lng:128.2640},{n:'경북 성주군',lat:35.9195,lng:128.2829},{n:'경북 칠곡군',lat:35.9958,lng:128.4017},{n:'경북 예천군',lat:36.6573,lng:128.2969},{n:'경북 봉화군',lat:36.8932,lng:128.7329},{n:'경북 울진군',lat:36.9931,lng:129.4002},{n:'경북 울릉군',lat:37.4845,lng:130.9057},
  {n:'경남 창원시',lat:35.2280,lng:128.6811},{n:'경남 진주시',lat:35.1800,lng:128.1080},{n:'경남 통영시',lat:34.8544,lng:128.4332},{n:'경남 사천시',lat:35.0037,lng:128.0647},{n:'경남 김해시',lat:35.2285,lng:128.8893},{n:'경남 밀양시',lat:35.5036,lng:128.7467},{n:'경남 거제시',lat:34.8800,lng:128.6212},{n:'경남 양산시',lat:35.3350,lng:129.0368},{n:'경남 의령군',lat:35.3222,lng:128.2617},{n:'경남 함안군',lat:35.2725,lng:128.4070},{n:'경남 창녕군',lat:35.5446,lng:128.4927},{n:'경남 고성군',lat:34.9752,lng:128.3228},{n:'경남 남해군',lat:34.8377,lng:127.8923},{n:'경남 하동군',lat:35.0671,lng:127.7517},{n:'경남 산청군',lat:35.4152,lng:127.8739},{n:'경남 함양군',lat:35.5201,lng:127.7250},{n:'경남 거창군',lat:35.6871,lng:127.9098},{n:'경남 합천군',lat:35.5661,lng:128.1659},
  {n:'부산 중구',lat:35.1058,lng:129.0323},{n:'부산 서구',lat:35.0978,lng:129.0244},{n:'부산 동구',lat:35.1361,lng:129.0442},{n:'부산 영도구',lat:35.0909,lng:129.0706},{n:'부산 부산진구',lat:35.1599,lng:129.0533},{n:'부산 동래구',lat:35.1997,lng:129.0854},{n:'부산 남구',lat:35.1366,lng:129.0841},{n:'부산 북구',lat:35.2040,lng:128.9898},{n:'부산 해운대구',lat:35.1631,lng:129.1639},{n:'부산 사하구',lat:35.1044,lng:128.9745},{n:'부산 금정구',lat:35.2429,lng:129.0922},{n:'부산 강서구',lat:35.2127,lng:128.9810},{n:'부산 연제구',lat:35.1767,lng:129.0826},{n:'부산 수영구',lat:35.1454,lng:129.1138},{n:'부산 사상구',lat:35.1524,lng:128.9919},{n:'부산 기장군',lat:35.2449,lng:129.2224},
  {n:'대구 중구',lat:35.8694,lng:128.6061},{n:'대구 동구',lat:35.8869,lng:128.6351},{n:'대구 서구',lat:35.8718,lng:128.5593},{n:'대구 남구',lat:35.8459,lng:128.5970},{n:'대구 북구',lat:35.8849,lng:128.5829},{n:'대구 수성구',lat:35.8582,lng:128.6314},{n:'대구 달서구',lat:35.8295,lng:128.5330},{n:'대구 달성군',lat:35.7749,lng:128.4314},
  {n:'울산 중구',lat:35.5698,lng:129.3319},{n:'울산 남구',lat:35.5381,lng:129.3314},{n:'울산 동구',lat:35.5048,lng:129.4163},{n:'울산 북구',lat:35.5826,lng:129.3608},{n:'울산 울주군',lat:35.5226,lng:129.2413},
  {n:'제주 제주시',lat:33.4996,lng:126.5312},{n:'제주 서귀포시',lat:33.2541,lng:126.5600},
];

// ── 상태 ──
let currentType     = 'XPS';
let currentFactory  = FACTORIES.pocheoni;
let currentTruckKey = '';
let destCoords      = null;

// ── 헬퍼 ──
function getSheetsPerBundle(type, thickness) {
  if (!thickness || thickness <= 0) return 0;
  if (type === 'XPS') return XPS_DATA[thickness] || Math.floor(600 / thickness);
  let s = Math.floor(600 / thickness);
  return s < 1 ? 1 : s;
}

function getBundleHeightMm(type, thickness) {
  const sheets = getSheetsPerBundle(type, thickness);
  return sheets === 0 ? 600 : thickness * sheets;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function estimateRoadKm(km) { return Math.round(km * 1.35); }

function getRateByDistance(km, truckKey) {
  for (const tier of DISTANCE_RATES) {
    if (km <= tier.maxKm) return tier[truckKey] || null;
  }
  return DISTANCE_RATES[DISTANCE_RATES.length - 1][truckKey];
}

// ── 자재 선택 콜백 ──
function onMaterialSelect(value) {
  currentType = value;
  buildRefTable();
  document.getElementById('resultPanel').style.display = 'none';
  currentTruckKey = '';
}

// ── 공장 선택 콜백 ──
function onFactorySelect(value) {
  currentFactory = FACTORIES[value];
  if (destCoords) renderFreight(document.getElementById('destAddrInput').value);
}

// ── 참고 단위표 ──
function buildRefTable() {
  const tbody = document.getElementById('refTableBody');
  tbody.innerHTML = '';
  const list = currentType === 'XPS'
    ? Object.keys(XPS_DATA)
    : [10,20,30,40,50,60,70,75,80,90,100,120,150,200,250,300];
  list.forEach(t => {
    const qty = currentType === 'XPS' ? XPS_DATA[t] : Math.floor(600/t);
    tbody.innerHTML += `<tr id="row-${t}"><td>${t}T</td><td>${qty}</td><td>${t*qty}</td></tr>`;
  });
  const t = parseInt(document.getElementById('thickness').value);
  if (t) {
    const tr = document.getElementById('row-' + t);
    if (tr) { tr.classList.add('row-active'); tr.scrollIntoView({behavior:'smooth', block:'center'}); }
  }
}

function handleInputChange() {
  const unit = document.getElementById('thicknessUnit') ? document.getElementById('thicknessUnit').value : 'mm';
  const t = toMm(document.getElementById('thickness').value, unit);
  if (t) {
    const tr = document.getElementById('row-' + t);
    if (tr) { tr.classList.add('row-active'); tr.scrollIntoView({behavior:'smooth', block:'center'}); }
  }
  buildRefTable();
}

// ── 단위 → mm 변환 ──
function toMm(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'cm') return Math.round(v * 10);
  if (unit === 'm')  return Math.round(v * 1000);
  return Math.round(v);
}

// ── 계산 ──
function calculate() {
  const thicknessUnit = document.getElementById('thicknessUnit').value;
  const thickness = toMm(document.getElementById('thickness').value, thicknessUnit);
  const quantity  = parseInt(document.getElementById('quantity').value);

  if (!thickness || thickness <= 0 || !quantity || quantity <= 0) {
    alert('두께와 주문 수량을 올바르게 입력해주세요.');
    return;
  }

  const sheetsPerBundle = getSheetsPerBundle(currentType, thickness);
  const bundleHeightMm  = getBundleHeightMm(currentType, thickness);
  const bundles         = Math.floor(quantity / sheetsPerBundle);
  const remainder       = quantity % sheetsPerBundle;
  const totalBundles    = remainder > 0 ? bundles + 1 : bundles;
  const detailText      = remainder > 0 ? `정품 ${bundles}단 + 낱장 ${remainder}장` : `정품 ${bundles}단`;
  const volume          = (1.62 * (thickness/1000) * quantity).toFixed(2);

  let selectedTruck = TRUCK_SPECS[TRUCK_SPECS.length - 1];
  for (const truck of TRUCK_SPECS) {
    let maxTiers = Math.floor(truck.safeHeight / bundleHeightMm);
    if (maxTiers < 1) maxTiers = 1;
    if (truck.key === '1ton' || truck.key === '1.4ton') {
      const limit = currentType === 'XPS' ? 4 : 3;
      if (maxTiers > limit) maxTiers = limit;
    }
    if (totalBundles <= truck.floorCount * maxTiers) { selectedTruck = truck; break; }
  }

  currentTruckKey = selectedTruck.key;
  showResult(selectedTruck, totalBundles, bundleHeightMm, detailText, volume, thickness);
  addHistory(selectedTruck.name, totalBundles, detailText, volume, thickness);

  // 배송지 선택된 경우 운임 바로 표시
  if (destCoords) {
    renderFreight(document.getElementById('destAddrInput').value);
  }
}

// ── 결과 표시 ──
function showResult(vehicle, totalBundles, bundleHeightMm, detailText, volume, thickness) {
  const panel = document.getElementById('resultPanel');
  panel.style.display = 'block';

  document.getElementById('resVehicle').textContent      = vehicle.name;
  document.getElementById('resBundleDetail').textContent = detailText;
  document.getElementById('resBundle').textContent       = totalBundles + '단';
  document.getElementById('resVolume').textContent       = volume;
  document.getElementById('resVolumeUnit').style.display = volume === '—' ? 'none' : '';

  // 운임 항목 초기화 (배송지 미선택 시 숨김)
  ['freightDistanceItem','freightCostItem'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const noteEl = document.getElementById('resNote');
  if (vehicle.key === '3.5ton')
    noteEl.textContent = '※ 3.5톤 주문 시 수도권 무료배송 이벤트 진행 중입니다.';
  else if (['5ton','5ton_plus'].includes(vehicle.key))
    noteEl.textContent = '※ 5톤 이상 전국 무료배송 이벤트 진행 중입니다.';
  else
    noteEl.textContent = `※ ${currentType} ${thickness}T 기준 · 1단 높이 ${bundleHeightMm}mm`;

  setTimeout(() => panel.scrollIntoView({behavior:'smooth', block:'start'}), 100);
}

// ── Top View / Side View ──
function drawVisualization(vInfo, totalBundles, bundleHeightMm) {
  const wrap = document.querySelector('.truck-topview-wrap');
  if (!wrap) return;
  let containerWidth = wrap.clientWidth - 80;
  if (containerWidth <= 0) {
    setTimeout(() => drawVisualization(vInfo, totalBundles, bundleHeightMm), 50);
    return;
  }

  const slotW = 900, slotL = 1800;
  const singleBoxW = slotL, doubleBoxW = slotW;
  const singleRowH = slotW, doubleRowH = slotL;

  let maxTiers = Math.floor((vInfo.safeHeight || 3000) / bundleHeightMm);
  if (maxTiers < 1) maxTiers = 1;
  if (vInfo.key === '1ton' || vInfo.key === '1.4ton') {
    const limit = currentType === 'XPS' ? 4 : 3;
    if (maxTiers > limit) maxTiers = limit;
  }

  const truckBed = document.getElementById('truckBed');
  const sideview = document.getElementById('sideviewWrap');

  truckBed.innerHTML = `<div class="truck-cab">운전석</div>
    <div class="truck-dim-w">${vInfo.width}mm</div>
    <div class="truck-dim-h"><span>${vInfo.height}mm</span></div>`;
  sideview.innerHTML = `<div class="sideview-head">앞</div>
    <div class="limit-line" style="bottom:${120+16}px;"><span class="limit-label">높이 제한</span></div>`;

  document.getElementById('topViewLabel').textContent = '900×1800mm 기준';

  let fitScale = containerWidth / vInfo.width;
  if (fitScale > 0.12) fitScale = 0.12;

  truckBed.style.width  = (vInfo.width  * fitScale) + 'px';
  truckBed.style.height = (vInfo.height * fitScale) + 'px';

  let rowConfigs = [];
  if (vInfo.type === 'mixed_3.5') {
    rowConfigs = [
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH},
    ];
  } else if (vInfo.type === 'mixed_2.5') {
    rowConfigs = [
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'가로', cap:maxTiers,   mode:'single', rowH:singleRowH},
      {type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH},
    ];
  } else if (vInfo.type.includes('overhang')) {
    const cnt = vInfo.type === 'overhang_5t_plus' ? 5 : 4;
    for (let i = 0; i < cnt; i++)
      rowConfigs.push({type:'세로', cap:maxTiers*2, mode:'double', rowH:doubleRowH});
  } else {
    for (let i = 0; i < vInfo.lenRows; i++)
      rowConfigs.push({type:'가로', cap:maxTiers, mode:'single', rowH:singleRowH});
  }

  const slotMap = [];
  rowConfigs.forEach(cfg => {
    if (cfg.mode === 'double') { slotMap.push({maxH:cfg.cap/2}); slotMap.push({maxH:cfg.cap/2}); }
    else slotMap.push({maxH:cfg.cap});
  });

  const slotFill = new Array(slotMap.length).fill(0);
  let placed = 0, guard = 0;
  while (placed < totalBundles && guard < 2000) {
    for (let i = 0; i < slotMap.length; i++) {
      if (placed < totalBundles && slotFill[i] < slotMap[i].maxH) { slotFill[i]++; placed++; }
    }
    guard++;
  }

  const boxClass = currentType === 'EPS' ? 'eps' : 'xps';
  let sCursor = 0;
  rowConfigs.forEach(cfg => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'truck-row';
    rowDiv.style.height = (cfg.rowH * fitScale) + 'px';
    rowDiv.style.width  = '100%';

    const left  = slotFill[sCursor];
    const right = cfg.mode === 'double' ? slotFill[sCursor + 1] : 0;
    sCursor += cfg.mode === 'double' ? 2 : 1;

    const createBox = (cnt, mode) => {
      const box = document.createElement('div');
      box.className   = 'stack-box ' + (cnt === 0 ? 'empty' : boxClass);
      box.style.width  = ((mode === 'double' ? doubleBoxW : singleBoxW) * fitScale) + 'px';
      box.style.height = '100%';
      box.innerHTML    = `<span>${cnt > 0 ? cnt : '–'}</span>`;
      return box;
    };

    if (cfg.mode === 'double') {
      rowDiv.appendChild(createBox(left,  'double'));
      rowDiv.appendChild(createBox(right, 'double'));
    } else {
      rowDiv.appendChild(createBox(left, 'single'));
    }
    truckBed.appendChild(rowDiv);

    const maxStack = Math.max(left, right);
    const colDiv   = document.createElement('div');
    colDiv.className = 'side-col';
    const hRatio = 120 / 2500;
    for (let k = 0; k < maxStack; k++) {
      const block = document.createElement('div');
      block.className   = 'side-block ' + boxClass;
      let pxH = bundleHeightMm * hRatio;
      if (pxH < 8) pxH = 8;
      block.style.height = pxH + 'px';
      block.textContent  = k + 1;
      colDiv.appendChild(block);
    }
    colDiv.innerHTML += `<div class="side-col-label">${cfg.type.charAt(0)}</div>`;
    sideview.appendChild(colDiv);
  });
}

// ── Canvas 등각 도면 ──
function drawIsoStack(thickness, type) {
  const sheets = getSheetsPerBundle(type, thickness);
  if (!sheets) return;
  const canvas = document.getElementById('isoCanvas');
  if (!canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const startX = canvas.width / 2, startY = 70, w = 150;
  const totalMm = thickness * sheets;
  const totalH  = (totalMm / 600) * 140;
  const sheetH  = totalH / sheets;

  const isXPS       = type === 'XPS';
  const topColor    = isXPS ? '#F8BBD0' : '#ECEFF1';
  const rightColor  = isXPS ? '#F48FB1' : '#CFD8DC';
  const leftColor   = isXPS ? '#FCE4EC' : '#F5F5F5';
  const strokeColor = isXPS ? '#C2185B' : '#546E7A';

  ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeColor;
  const p1={x:startX,y:startY}, p2={x:startX+w,y:startY+w/2}, p3={x:startX,y:startY+w}, p4={x:startX-w,y:startY+w/2};
  const b2={x:p2.x,y:p2.y+totalH}, b3={x:p3.x,y:p3.y+totalH}, b4={x:p4.x,y:p4.y+totalH};

  ctx.fillStyle=topColor;   ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=leftColor;  ctx.beginPath(); ctx.moveTo(p4.x,p4.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(b3.x,b3.y); ctx.lineTo(b4.x,b4.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=rightColor; ctx.beginPath(); ctx.moveTo(p3.x,p3.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(b2.x,b2.y); ctx.lineTo(b3.x,b3.y); ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.lineWidth=0.5; ctx.fillStyle=strokeColor; ctx.font='11px Pretendard,sans-serif'; ctx.textAlign='left';
  for (let i=1; i<=sheets; i++) {
    const y = i * sheetH;
    ctx.beginPath(); ctx.moveTo(p3.x,p3.y+y); ctx.lineTo(p2.x,p2.y+y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p4.x,p4.y+y); ctx.lineTo(p3.x,p3.y+y); ctx.stroke();
    if (i===Math.ceil(sheets/2)) ctx.fillText(thickness+'T', p3.x+10, p3.y+y-5);
  }

  ctx.strokeStyle='#555'; ctx.fillStyle='#555'; ctx.lineWidth=1;
  const dimX = p2.x + 18;
  ctx.beginPath(); ctx.moveTo(dimX,p2.y); ctx.lineTo(dimX,b2.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dimX-3,p2.y); ctx.lineTo(dimX+3,p2.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dimX-3,b2.y); ctx.lineTo(dimX+3,b2.y); ctx.stroke();
  ctx.textAlign='left'; ctx.fillText(`${totalMm}mm`, dimX+5, (p2.y+b2.y)/2+4);

  document.getElementById('bundleInfoText').textContent = `${thickness}T × ${sheets}장`;
}

// ── 배송지 검색 토글 ──
function toggleAddrSearch() {
  const box = document.getElementById('addrSearchBox');
  const isOpen = box.classList.contains('open');
  if (isOpen) {
    box.classList.remove('open');
  } else {
    box.classList.add('open');
    setTimeout(() => document.getElementById('addrKeywordInput').focus(), 50);
  }
}

function clearAddr() {
  destCoords = null;
  document.getElementById('destAddrInput').value = '';
  document.getElementById('addrClearBtn').style.display = 'none';
  document.getElementById('addrSearchBox').classList.remove('open');
  document.getElementById('addrKeywordInput').value = '';
  document.getElementById('addrResultList').innerHTML = '<div class="addr-empty">시·도 + 시·군·구 형식으로 입력 후 확인을 누르세요</div>';
  document.getElementById('freightWrap').style.display = 'none';
  ['freightDistanceItem','freightCostItem'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function searchAreaDB(query) {
  const q = query.replace(/\s+/g, ' ').trim();
  let results = AREA_DB.filter(a => a.n.includes(q) || q.includes(a.n.split(' ')[1] || ''));
  if (results.length === 0) {
    const tokens = q.split(' ').filter(t => t.length >= 2);
    results = AREA_DB.filter(a => tokens.some(t => a.n.includes(t)));
  }
  return results.slice(0, 8);
}

function confirmAddr() {
  const query = document.getElementById('addrKeywordInput').value.trim();
  if (!query) return;
  const list    = document.getElementById('addrResultList');
  list.innerHTML = '';
  const results  = searchAreaDB(query);

  if (results.length === 0) {
    list.innerHTML = '<div class="addr-empty">일치하는 지역이 없습니다.<br>시·도 + 시·군·구 형식으로 입력해보세요</div>';
    return;
  }

  results.forEach(area => {
    const row = document.createElement('div');
    row.className = 'addr-result-item';
    row.innerHTML = `<div class="addr-result-name"><span class="addr-tag">지역</span>${area.n}</div>`;
    row.addEventListener('click', () => applyArea(area));
    list.appendChild(row);
  });
}

function applyArea(area) {
  destCoords = {lat: area.lat, lng: area.lng};
  document.getElementById('addrSearchBox').classList.remove('open');
  document.getElementById('destAddrInput').value = area.n;
  document.getElementById('addrClearBtn').style.display = 'flex';
  // 계산 이미 완료된 상태면 바로 운임 표시
  if (currentTruckKey) renderFreight(area.n);
}

// ── 운임 계산 및 표시 ──
function renderFreight(destName) {
  if (!destCoords || !currentTruckKey) return;

  const straightKm  = haversineKm(currentFactory.lat, currentFactory.lng, destCoords.lat, destCoords.lng);
  const roadKm      = estimateRoadKm(straightKm);
  const cost        = getRateByDistance(roadKm, currentTruckKey);

  const freightWrap = document.getElementById('freightWrap');
  freightWrap.style.display = 'flex';

  // result-detail-card 안 운임 항목 표시
  ['freightDistanceItem','freightCostItem'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  document.getElementById('routeDistance').textContent = `약 ${roadKm}km`;

  if (cost !== null) {
    document.getElementById('freightCost').textContent = cost.toLocaleString() + ' 원';
    document.getElementById('freightNote').textContent =
      `※ ${currentFactory.name} → ${destName} 약 ${roadKm}km 기준 (직선거리 × 1.35 추정). 실제 운임은 ±10% 차이가 날 수 있습니다.`;
  } else {
    document.getElementById('freightCost').textContent = '별도 문의';
    document.getElementById('freightNote').textContent = '※ 장거리 구간으로 별도 협의가 필요합니다. 031-511-0377';
  }

  renderRateTable(roadKm);
  setTimeout(() => freightWrap.scrollIntoView({behavior:'smooth', block:'nearest'}), 150);
}

function renderRateTable(currentKm) {
  const tbody = document.getElementById('rateTableRows');
  if (!tbody) return;
  tbody.innerHTML = DISTANCE_RATES.map((tier, idx) => {
    const prevMax  = idx > 0 ? DISTANCE_RATES[idx-1].maxKm : 0;
    const isActive = currentKm !== undefined && currentKm > prevMax && currentKm <= tier.maxKm;
    const cells    = ['1ton','1.4ton','2.5ton','3.5ton','5ton','5ton_plus'].map(k =>
      `<td>${Math.round((tier[k]||0) / 10000)}만원~</td>`
    ).join('');
    return `<tr${isActive ? ' class="rate-active"' : ''}><td>${tier.label}</td>${cells}</tr>`;
  }).join('');
}

function toggleRateTable() {
  const body = document.getElementById('rateTableBody');
  const btn  = document.getElementById('rateToggleBtn');
  const txt  = document.getElementById('rateTableToggleText');
  const open = body.classList.toggle('open');
  btn.classList.toggle('open', open);
  txt.textContent = open ? '차량별 거리 구간 요금표 닫기' : '차량별 거리 구간 요금표 보기';
  if (open && !document.getElementById('rateTableRows').innerHTML) renderRateTable();
}

// ── 히스토리 ──
function addHistory(vehicleName, totalBundles, detailText, volume, thickness) {
  const list = document.getElementById('calcHistoryList');
  if (!list) return;
  const empty = list.querySelector('.history-empty');
  if (empty) empty.remove();
  list.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));

  const now     = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} `
    + `${now.getHours() >= 12 ? 'PM' : 'AM'} `
    + `${String(now.getHours()%12||12).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const item = document.createElement('div');
  item.className = 'history-item active';
  item.innerHTML = `
    <div class="history-date">${dateStr}</div>
    <div class="history-calc-name">단열재 적재·운임 계산기</div>
    <div class="history-result-label">${vehicleName} · ${totalBundles}단</div>
    <div class="history-detail">
      <div class="detail-row"><span class="detail-key">두께:</span><span class="detail-val">${thickness}mm</span></div>
      <div class="detail-row"><span class="detail-key">적재:</span><span class="detail-val">${detailText}</span></div>
      <div class="detail-row"><span class="detail-key">부피:</span><span class="detail-val">${volume}m³</span></div>
    </div>
  `;
  list.insertBefore(item, list.firstChild);
}

// ── 전체 초기화 ──
function resetAll() {
  document.getElementById('thickness').value = '50';
  document.getElementById('quantity').value  = '50';
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('freightWrap').style.display  = 'none';
  currentTruckKey = '';

  // 자재 드롭다운 초기화 (XPS)
  currentType = 'XPS';
  document.getElementById('materialType').value = 'XPS';
  document.getElementById('materialBtn').querySelector('span').textContent = '압출법단열재 (XPS)';
  document.getElementById('materialList').querySelectorAll('.custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === 'XPS');
  });

  // 공장 드롭다운 초기화 (포천)
  currentFactory = FACTORIES.pocheoni;
  document.getElementById('factoryValue').value = 'pocheoni';
  document.getElementById('factoryBtn').querySelector('span').textContent = '포천 — 경기 포천시 가산면 금현리';
  document.getElementById('factoryList').querySelectorAll('.custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === 'pocheoni');
  });

  clearAddr();
  buildRefTable();
}

// ── CSS 추가: 배송지 인풋 행 ──
(function injectAddrInputStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .addr-input-row {
      display: flex;
      align-items: center;
      gap: 0;
      position: relative;
    }
    .addr-input-row .addr-input-readonly {
      flex: 1;
      cursor: pointer;
      padding-right: 36px;
    }
    .btn-addr-clear {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 13px;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      transition: background var(--transition);
    }
    .btn-addr-clear:hover { background: var(--color-border); }
  `;
  document.head.appendChild(style);
})();

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initCustomSelect('materialWrap', 'materialBtn', 'materialList', 'materialType', onMaterialSelect);
  initCustomSelect('factoryWrap',  'factoryBtn',  'factoryList',  'factoryValue', onFactorySelect);
  buildRefTable();

  document.getElementById('thickness').addEventListener('input', handleInputChange);
  document.getElementById('destAddrInput').addEventListener('click', toggleAddrSearch);
  document.getElementById('addrClearBtn').addEventListener('click', clearAddr);
  document.getElementById('addrKeywordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmAddr();
  });
  document.getElementById('addrConfirmBtn').addEventListener('click', confirmAddr);
  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('rateToggleBtn').addEventListener('click', toggleRateTable);
});
