// 쿠팡 검색결과 페이지(https://www.coupang.com/np/search)에서 상품 카드의 순위를 추출한다.
// 처음엔 조직검색 결과 링크에 박혀있는 rank/searchRank 쿼리파라미터를 그대로 믿었는데
// (사용자가 콘솔로 뽑아준 실제 링크 샘플엔 있었음), 2026-08-26에 셀러랭크(sellerrank.kr)
// 확장프로그램을 압축해제해서 코드를 확인해보니 그 회사도 이 파라미터를 안 믿고 광고가
// 아닌 카드를 DOM 순서대로 직접 세어서 순위를 매기고 있었다 — URL 파라미터는 사용자가 직접
// 검색창에 입력해서 들어온 세션에만 붙고, 자동화된 직접 URL 접근 시엔 없을 수도 있다는
// 뜻이라 더 안전한 이 방식(직접 카운팅)으로 바꿨다. 상품 식별(productId/itemId/vendorItemId)과
// 광고 판정(sourceType=srp_product_ads)은 실제 캡처한 마크업으로 검증된 부분이라 그대로 둔다.

function parseCoupangHref(hrefRaw) {
  let url;
  try {
    url = new URL(hrefRaw || "", location.origin);
  } catch (_) {
    return null;
  }
  const idMatch = url.pathname.match(/\/vp\/products\/(\d+)/);
  if (!idMatch) return null;
  const params = url.searchParams;
  const sourceType = params.get("sourceType") || "";
  return {
    productId: idMatch[1],
    itemId: params.get("itemId") || "",
    vendorItemId: params.get("vendorItemId") || "",
    isAd: sourceType === "srp_product_ads",
  };
}

// DOM에 나온 순서 그대로, 광고가 아닌 카드만 1부터 순서를 매긴다(셀러랭크와 동일 원칙).
// 같은 상품이 광고 슬롯 + 오가닉 목록에 중복으로 나오는 경우, 광고 쪽은 순위 카운트에서
// 제외되고 오가닉 쪽에서만 순위가 매겨진다. 같은 상품이 오가닉에도 중복 등장하면 먼저
// 나온(더 높은) 순위를 유지한다.
function collectCoupangCards() {
  const anchors = [...document.querySelectorAll('a[href*="/vp/products/"]')];
  const cards = [];
  const seen = new Set(); // 이미 순위를 매긴 productId|itemId|vendorItemId
  let organic = 0;
  anchors.forEach((anchor) => {
    const parsed = parseCoupangHref(anchor.getAttribute("href"));
    if (!parsed) return;
    const key = `${parsed.productId}|${parsed.itemId}|${parsed.vendorItemId}`;
    const img = anchor.querySelector("img");
    let rank = null;
    if (!parsed.isAd) {
      if (!seen.has(key)) {
        organic += 1;
        seen.add(key);
      }
      rank = organic;
    }
    cards.push({
      ...parsed, rank,
      productName: img?.getAttribute("alt") || "",
    });
  });
  // 같은 key가 여러 번 나온 경우 "가장 먼저(가장 높은 순위)" 매겨진 값만 남긴다.
  const byKey = new Map();
  cards.forEach((card) => {
    const key = `${card.productId}|${card.itemId}|${card.vendorItemId}`;
    const existing = byKey.get(key);
    if (!existing || (existing.rank == null && card.rank != null)) byKey.set(key, card);
  });
  return [...byKey.values()];
}

// 상품 카드 앵커 자체는 초기 렌더에 대부분 존재하지만(이미지만 lazy), 혹시 몰라 잠깐 폴링한다.
async function waitForCoupangCards(timeoutMs = 8000) {
  const start = Date.now();
  let last = [];
  while (Date.now() - start < timeoutMs) {
    last = collectCoupangCards();
    if (last.length >= 10) return last;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return last;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_COUPANG_PAGE") return false;
  (async () => {
    const first = await waitForCoupangCards();
    // 페이지 하단 카드가 아직 안 잡혔을 수 있어 한 번 끝까지 스크롤 후 재수집해서 더 많은 쪽을 쓴다.
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = collectCoupangCards();
    const products = after.length > first.length ? after : first;

    const pageText = (document.body?.innerText || "").slice(0, 3000);
    let blockedReason = "";
    // 2026-08-26 실측: 로그인 안 된 상태에서 2페이지 이상으로 넘어가면 상품이 있는 검색어인데도
    // 쿠팡이 "검색결과가 없습니다"를 띄운다(셀러랭크 확장프로그램도 같은 증상을 "로그인/인증
    // 필요"로 안내함) — 캡차와는 다른 신호라 따로 구분해서 사용자가 원인을 바로 알 수 있게 한다.
    if (!products.length && /보안\s*확인|자동입력\s*방지|비정상적인\s*접근|captcha/i.test(pageText)) {
      blockedReason = "쿠팡 접속이 일시적으로 제한되었습니다(캡차로 추정). 잠시 후 다시 시도하세요.";
    } else if (!products.length && /검색결과가\s*없습니다|다른\s*검색어를\s*입력/.test(pageText)) {
      blockedReason = "2페이지 이상은 쿠팡 로그인이 필요합니다 — 이 브라우저에서 쿠팡에 로그인한 뒤 다시 시도해 주세요.";
    } else if (!products.length) {
      blockedReason = "상품 카드를 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.";
    }
    sendResponse({ products, blockedReason, url: location.href, title: document.title });
  })();
  return true;
});
