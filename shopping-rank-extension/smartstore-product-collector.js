/* ===============================================================
   smartstore-product-collector.js — 경쟁사 상품 옵션가 수집
   2026-09-02: 상품 상세페이지 하나를 열면 페이지 스스로 아래 두 API를 호출하는데, 그걸
   smartstore-network-tap.js가 가로채서 여기로 넘겨준다 — URL을 직접 만들 필요 없음(로그인만
   되어 있으면 됨):
     1) /i/v2/channels/{channelUid}/products/{id}?withWindow=false
        → optionCombinations: [{ optionName1~3, price(추가금), stockQuantity, id }]
          price=0인 항목이 "기준 옵션", 나머지는 거기서부터의 추가금. 옵션축은 최대 3개.
     2) /i/v2/channels/{channelUid}/product-benefits/{id}
        → optimalDiscount.totalDiscountResult.summary.totalPayAmount = 할인 적용된 기준가

   최종가 계산(실측 검증됨): 최종가(옵션) = totalPayAmount(기준가) + optionCombinations[i].price
   예) 기준 3,000원 + 50T 추가금 11,000원 = 14,000원

   ⚠️ product-benefits는 사용자가 옵션을 직접 클릭하면 "선택된 옵션 기준"으로 다시 호출되어
   이미 추가금이 포함된 값을 돌려준다 — 그걸 또 기준가로 쓰면 이중계산이 난다(실사용 중 발견).
   그래서 페이지 로드 후 "첫 번째" 응답만 기준가로 쓰고 이후 응답은 무시한다.

   2026-09-02 변경: 처음엔 이 스크립트가 데이터 준비되는 즉시 화면에 패널을 띄우고 자동으로
   Supabase에 저장했는데, 사용자 요청으로 "URL 진입 시 자동"이 아니라 "확장 팝업에서 수집
   버튼을 눌러야 진행"하는 방식으로 바꿨다. 그래서 이 스크립트는 이제:
   - 페이지가 로드되면 예전처럼 네트워크 응답을 조용히 가로채서 계산까지만 해두고(캐시)
   - 화면에 아무것도 띄우지 않고, 저장도 하지 않는다
   - 팝업(popup.js)이 "GET_COMPETITOR_SCAN_DATA" 메시지를 보내면 그때 계산된 rows를 돌려준다
     (팝업이 그 rows를 SAVE_COMPETITOR_SCAN으로 service-worker.js에 보내 실제 저장한다) */
(function () {
  const TAG = "[EG-SMARTSTORE]";

  let productData = null;   // .../products/{id} 응답
  let benefitData = null;   // .../product-benefits/{id} 응답

  function isProductDetailUrl(url) {
    return /\/i\/v2\/channels\/[^/]+\/products\/\d+(\?|$)/.test(url) && !/\/(contents|verticals|category-navigations|provided-notice)/.test(url);
  }
  function isBenefitUrl(url) {
    return /\/i\/v2\/channels\/[^/]+\/product-benefits\/\d+/.test(url);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== "energuard-smartstore-network") return;

    if (isProductDetailUrl(msg.url) && msg.data?.optionCombinations !== undefined) {
      if (!productData) {
        productData = msg.data;
        console.log(TAG, "상품 상세 응답 확보(팝업에서 수집 버튼 누르면 사용됨):", productData.name);
      }
    } else if (isBenefitUrl(msg.url)) {
      // ⚠️ 옵션을 직접 클릭하면 "선택된 옵션 기준"으로 다시 호출되어 이중계산 위험 —
      // 페이지 로드 후 첫 응답만 기준가로 쓰고 이후 응답은 무시(2026-09-02 실사용 중 발견).
      if (!benefitData) {
        benefitData = msg.data;
        console.log(TAG, "할인 정보 응답 확보(최초 1회만 반영)");
      }
    }
  });

  function baseFinalPrice() {
    const fromBenefit = benefitData?.optimalDiscount?.totalDiscountResult?.summary?.totalPayAmount;
    if (fromBenefit != null) return Number(fromBenefit);
    return Number(productData?.salePrice ?? productData?.dispSalePrice ?? 0);
  }

  function buildRows() {
    const combos = productData?.optionCombinations?.length
      ? productData.optionCombinations
      : (productData?.combinationOptions?.[0]?.options || productData?.standardCombinations || []);
    const base = baseFinalPrice();

    if (!combos.length) {
      return [{ label: "(옵션 없음)", finalPrice: base, delta: 0, soldOut: (productData?.stockQuantity ?? 1) <= 0 }];
    }
    return combos.map((c) => {
      const label = [c.optionName1, c.optionName2, c.optionName3].filter(Boolean).join(" / ");
      return {
        label,
        finalPrice: base + Number(c.price || 0),
        delta: Number(c.price || 0),
        stockQuantity: c.stockQuantity,
        soldOut: (c.stockQuantity ?? 1) <= 0,
      };
    });
  }

  // 팝업의 "현재 페이지 수집" 버튼이 보내는 요청 — 지금까지 가로챈 데이터로 즉시 응답한다.
  // 페이지를 막 열자마자(응답이 아직 안 왔을 때) 누르면 ok:false로 알려준다.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "GET_COMPETITOR_SCAN_DATA") return false;
    if (!productData) {
      sendResponse({ ok: false, reason: "not_ready" });
      return false;
    }
    sendResponse({
      ok: true,
      productName: productData.name || document.title,
      storeName: productData.channel?.channelName || null,
      productUrl: location.href.split("?")[0].split("#")[0],
      rows: buildRows(),
    });
    return false;
  });
})();
