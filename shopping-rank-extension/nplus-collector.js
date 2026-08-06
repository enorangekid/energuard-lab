/* N+ 스토어(snxbest.naver.com 검색 → search.shopping.naver.com/ns/search) 순위 수집.
   가격비교(/search/all)와 달리 페이지 이동이 아니라 스크롤로 이어지는 cursor 무한스크롤이라
   탭 재로딩 없이 "최초 화면(DOM) + 스크롤로 새로 잡히는 배치(네트워크)"를 합쳐서 순위를 만든다.
   - 최초 화면: 서버에서 이미 렌더링돼 있어 네트워크 탭에 안 잡힌다 → DOM(data-shp-*)에서 직접 추출.
   - 이후 배치: search-network-tap.js(이미 모든 search.shopping.naver.com/* 페이지에 주입됨)가
     window.fetch를 가로채 postMessage로 넘겨주는 paged-composite-cards 응답을 사용.
   광고 판별: 이 API의 상품 객체는 광고일 때만 cardType/adId/clickUrl/impressionEventUrl이 붙는다
   (2026-08-05 실측 확인) — DOM 쪽은 기존과 동일하게 data-shp-contents-grp="ad"로 판별. */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NETWORK_SOURCE = "energuard-search-network";
const productByKey = new Map();
let organicCount = 0;

function absoluteUrl(value) {
  const source = String(value || "").trim();
  if (!source || source === "about:blank" || source.startsWith("#") || /^javascript:/i.test(source)) return "";
  try { return new URL(source, location.href).href; } catch (_) { return source; }
}

function record(key, isAd, fields) {
  if (!key || productByKey.has(key)) return;
  if (!isAd) organicCount += 1;
  productByKey.set(key, { isAd, rank: isAd ? null : organicCount, ...fields });
}

/* ── 최초 화면(DOM) 추출 — parser-core.js(RankParser)의 판별 로직을 그대로 재사용 ── */
function parseDetailAttribute(element, name) {
  return RankParser.toDetailMap(element.getAttribute(name) || "[]");
}

// N+스토어 카드의 data-shp-contents-dtl에는 chnl_prod_nm(몰 이름) 자체가 없다(2026-08-06 실측
// 확인) — 카드 루트를 찾아 화면에 보이는 텍스트에서 스토어명을 직접 찾는다.
function normalizeStoreName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase("ko-KR");
}

function findCardRoot(anchor) {
  const direct = anchor.closest("li");
  if (direct) return direct;
  let node = anchor.parentElement;
  for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
    if ((node.innerText || "").trim().length > 20) return node;
  }
  return anchor.parentElement;
}

function findStoreNameInCard(root, storeName) {
  if (!root || !storeName) return "";
  const target = normalizeStoreName(storeName);
  const candidates = root.querySelectorAll('a, span, [class*="mall"], [class*="store"]');
  for (const element of candidates) {
    const text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (text && text.length <= 60 && normalizeStoreName(text) === target) return text;
  }
  return "";
}

function extractInitialDom(storeName) {
  const anchors = [...document.querySelectorAll('a[data-shp-contents-grp][data-shp-contents-dtl]')]
    // 상단 GNB(내비게이션 바)·rec1(연관검색어 추천 칩)도 같은 선택자에 걸리는데 제목이 없는
    // 가짜 항목이다(2026-08-06 실측 확인, organicRank가 20 가까이 밀리는 원인이었음) —
    // 진짜 상품 카드만 inventory="prod"로 표시된다.
    .filter((anchor) => anchor.getAttribute("data-shp-inventory") === "prod");
  anchors.forEach((anchor) => {
    const group = anchor.getAttribute("data-shp-contents-grp") || "";
    const type = anchor.getAttribute("data-shp-contents-type") || "";
    const detail = parseDetailAttribute(anchor, "data-shp-contents-dtl");
    const isAd = RankParser.isAdRecord({ group, type, href: anchor.href });
    const productCode = String(detail.chnl_prod_no || "").trim();
    const naverProductId = String(detail.catalog_nv_mid || anchor.getAttribute("data-shp-contents-id") || "").trim();
    const key = productCode || naverProductId || anchor.href;
    if (!key) return;
    const image = anchor.querySelector("img");
    const mallName = detail.chnl_prod_nm || findStoreNameInCard(findCardRoot(anchor), storeName);
    record(key, isAd, {
      productCode,
      naverProductId,
      title: detail.prod_nm || image?.alt || "",
      price: Number(detail.price) || 0,
      image: absoluteUrl(image?.currentSrc || image?.getAttribute("src") || ""),
      link: absoluteUrl(anchor.href),
      mallName,
      reviewScore: null,
      reviewCount: null,
    });
  });
}

/* ── 이후 배치(네트워크 응답) 추출 ── */
function isAdCard(p) {
  return !!(p.cardType || p.adId || p.clickUrl || p.impressionEventUrl);
}

function ingestNetworkPayload(url, data) {
  if (!/paged-composite-cards/i.test(String(url || ""))) return;
  const list = data?.data?.data;
  if (!Array.isArray(list)) return;
  list.forEach((entry) => {
    const p = entry?.card?.product;
    if (!p) return;
    // DOM 쪽(extractInitialDom)과 동일하게 productCode(chnl_prod_no)를 우선한다 — nvMid는
    // 가격비교 ID처럼 상품마다 계속 바뀔 수 있어 우선순위가 서로 다르면 같은 상품이
    // 최초화면(DOM)과 스크롤 배치(네트워크)에서 서로 다른 키로 중복 집계된다.
    const key = String(p.channelProductId || p.nvMid || "");
    record(key, isAdCard(p), {
      productCode: String(p.channelProductId || ""),
      naverProductId: String(p.nvMid || ""),
      title: p.productName || "",
      price: Number(p.discountedSalePrice ?? p.salePrice) || 0,
      image: absoluteUrl(p.images?.[0]?.imageUrl || ""),
      link: absoluteUrl(p.productUrl?.pcUrl || p.productUrl?.mobileUrl || ""),
      mallName: p.mallName || "",
      reviewScore: p.averageReviewScore ?? null,
      reviewCount: p.totalReviewCount ?? null,
    });
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== NETWORK_SOURCE) return;
  ingestNetworkPayload(event.data.url, event.data.data);
});

async function scrollAndCollect(targetRank, maxAttempts = 40) {
  let attempts = 0;
  let stableRounds = 0;
  let lastOrganicCount = organicCount;
  while (attempts < maxAttempts && organicCount < targetRank) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(650);
    attempts += 1;
    if (organicCount === lastOrganicCount) {
      stableRounds += 1;
      if (stableRounds >= 4) break; // 몇 번을 더 내려도 안 늘어나면 검색결과 끝
    } else {
      stableRounds = 0;
    }
    lastOrganicCount = organicCount;
  }
  window.scrollTo(0, 0);
}

// 고정 대기(900ms)로는 검색어에 따라 최초화면 렌더 속도가 달라 카드를 놓치는 경우가 있었다
// (2026-08-05 실측 확인) — 카드 개수가 더 늘지 않고 안정될 때까지 폴링해서 기다린다.
// ⚠ GNB(내비게이션)·rec1(추천칩)·sch(자동완성) 같은 비상품 위젯은 진짜 상품 그리드보다 먼저
// 뜨고 먼저 안정되기 때문에, 전체 앵커 개수로 판단하면 상품 그리드가 아직 로딩 중인데도
// "안정됐다"고 착각해 너무 일찍 추출해버린다(2026-08-06 실측 확인) — 반드시 inventory="prod"인
// 진짜 상품 카드 개수만으로 안정화를 판단한다.
async function waitForInitialCards(maxWaitMs = 8000) {
  const started = Date.now();
  let lastCount = -1;
  let stableRounds = 0;
  while (Date.now() - started < maxWaitMs) {
    const count = document.querySelectorAll('a[data-shp-inventory="prod"][data-shp-contents-dtl]').length;
    if (count > 0 && count === lastCount) {
      stableRounds += 1;
      if (stableRounds >= 5) return; // 5번 연속(약 750ms) 상품 카드 개수가 안 늘어나면 렌더 완료로 간주
    } else {
      stableRounds = 0;
    }
    lastCount = count;
    await sleep(150);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_NPLUS_PAGE") return false;
  (async () => {
    const targetRank = Number(message.targetRank) || 200;
    await waitForInitialCards();
    extractInitialDom(String(message.storeName || ""));
    await scrollAndCollect(targetRank);
    const products = [...productByKey.values()];
    const pageText = (document.body?.innerText || "").slice(0, 3000);
    let blockedReason = "";
    if (!products.length && /보안\s*확인을\s*완료|실제\s*사용자임을\s*확인|스팸을\s*방지/.test(pageText)) {
      blockedReason = "네이버 보안 확인(캡차) 화면이 떴습니다. 직접 인증한 뒤 다시 시도하세요.";
    } else if (!products.length && /NAVER\s*로그인|로그인/.test(document.title + pageText)) {
      blockedReason = "네이버 로그인이 필요합니다.";
    } else if (!products.length && /접속이 일시적으로 제한|서비스 이용이 제한/.test(pageText)) {
      blockedReason = "네이버 쇼핑 접속이 제한되었습니다. 잠시 후 다시 시도하세요.";
    } else if (!products.length) {
      blockedReason = "상품 카드를 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.";
    }
    sendResponse({ products, blockedReason, organicCount, url: location.href, title: document.title });
  })();
  return true;
});
