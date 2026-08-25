// 쿠팡 검색결과 페이지(https://www.coupang.com/np/search)에서 상품 카드의 순위를 추출한다.
// 네이버와 달리 쿠팡은 조직검색(오가닉) 결과 링크 자체에 rank/searchRank 쿼리파라미터가
// 그대로 박혀 있어서(예: /vp/products/123?...&searchRank=3&rank=3), DOM 위치를 직접 세지
// 않고 그 값을 그대로 신뢰한다. 광고(sourceType=srp_product_ads)는 이 파라미터가 없어서
// 자연스럽게 순위 후보에서 제외된다. 2026-08-26 실제 검색결과 HTML을 사용자가 직접
// 콘솔에서 추출해 확인한 구조를 기준으로 작성함 — 쿠팡이 마크업을 바꾸면 이 파일도 갱신 필요.

function parseCoupangCard(anchor) {
  let url;
  try {
    url = new URL(anchor.getAttribute("href") || "", location.origin);
  } catch (_) {
    return null;
  }
  const idMatch = url.pathname.match(/\/vp\/products\/(\d+)/);
  if (!idMatch) return null;
  const params = url.searchParams;
  const sourceType = params.get("sourceType") || "";
  const rankParam = params.get("rank") || params.get("searchRank");
  const img = anchor.querySelector("img");
  return {
    productId: idMatch[1],
    itemId: params.get("itemId") || "",
    vendorItemId: params.get("vendorItemId") || "",
    isAd: sourceType === "srp_product_ads",
    rank: rankParam ? Number(rankParam) : null,
    productName: img?.getAttribute("alt") || "",
  };
}

function collectCoupangCards() {
  const anchors = [...document.querySelectorAll('a[href*="/vp/products/"]')];
  const cards = anchors.map(parseCoupangCard).filter(Boolean);
  // 같은 상품이 광고 슬롯 + 오가닉 목록에 중복으로 나올 수 있다 — rank가 있는(오가닉) 쪽을 우선한다.
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
    if (!products.length && /보안\s*확인|자동입력\s*방지|비정상적인\s*접근|captcha/i.test(pageText)) {
      blockedReason = "쿠팡 접속이 일시적으로 제한되었습니다(캡차로 추정). 잠시 후 다시 시도하세요.";
    } else if (!products.length) {
      blockedReason = "상품 카드를 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.";
    }
    sendResponse({ products, blockedReason, url: location.href, title: document.title });
  })();
  return true;
});
