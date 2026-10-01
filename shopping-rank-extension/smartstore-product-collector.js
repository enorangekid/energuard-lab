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
     (팝업이 그 rows를 SAVE_COMPETITOR_SCAN으로 service-worker.js에 보내 실제 저장한다)

   2026-09-02 추가 수정: 스마트스토어가 SPA라서(page-collector.js 등에서 이미 확인된 사실),
   검색/목록 페이지에서 링크 클릭으로 상품 상세페이지에 "들어와도" 브라우저가 진짜 새 페이지
   로드로 안 치는 경우가 있다 — 그러면 이 스크립트가 그 상품 페이지에서 아예 실행된 적이
   없어서(상품 상세 URL에만 설치돼있었음) 계속 "not_ready"만 뜬다(실사용 중 발견). 그래서:
   1) manifest.json에서 이 스크립트를 스마트스토어 전체 페이지에 깔아두도록 넓힘(상품 상세가
      아니어도 항상 실행 — 아래 로직이 상품 상세일 때만 동작하므로 다른 페이지에선 조용히 대기)
   2) location.href를 주기적으로 감시해서 상품번호가 바뀌면(같은 탭 안에서 SPA로 다른 상품/
      페이지로 이동) productData/benefitData를 초기화 — network-tap의 fetch/XHR 몽키패치는
      탭이 살아있는 한 계속 걸려있으므로, SPA가 새 상품 데이터를 다시 불러올 때 그 응답을
      새로 잡아낼 수 있다. */
(function () {
  const TAG = "[EG-SMARTSTORE]";

  let detailUrl = null, benefitUrl = null;
  let productData = null;   // .../products/{id} 응답
  let benefitData = null;   // .../product-benefits/{id} 응답
  let lastProductId = currentProductId();

  function currentProductId() {
    const m = location.href.match(/\/products\/(\d+)/);
    return m ? m[1] : null;
  }

  // SPA 내부 이동 감지 — pushState/replaceState는 이벤트가 안 따로 없어서 주기적으로 확인한다.
  setInterval(() => {
    const id = currentProductId();
    if (id && id !== lastProductId) {
      console.log(TAG, "다른 상품으로 이동 감지, 상태 초기화:", lastProductId, "→", id);
      lastProductId = id;
      productData = null; detailUrl = null; benefitUrl = null;
      benefitData = null;
    }
  }, 800);

  // 추가상품(선택옵션 콤보가 아니라 "장바구니에 따로 담는" 항목)의 가격 필드는 실제 응답을
  // 못 봐서 확실하지 않다 — 있을 법한 후보를 순서대로 시도(2026-09-15, 대유물류가 두께별
  // 가격을 선택옵션이 아니라 추가상품으로 나눠 파는 걸 발견해서 대응).
  function supplementPrice(sp) {
    const v = sp?.price ?? sp?.salePrice ?? sp?.dispSalePrice ?? sp?.optionPrice;
    return Number.isFinite(Number(v)) ? Number(v) : null;
  }
  function supplementName(sp) {
    return sp?.name || sp?.productName || sp?.optionName1 || null;
  }
  function thicknessOf(text) {
    const m = String(text || "").match(/(\d+)\s*T\b/i) || String(text || "").match(/(\d+)\s*(?:mm|밀리|미리)\b/i);
    return m ? Number(m[1]) : null;
  }
  function pricedSupplements(d) {
    // 운송비 선결제처럼 가격은 있지만 두께 상품이 아닌 추가 구성은 판매가 검사에서 제외한다.
    return (d?.supplementProducts || []).filter((sp) => supplementPrice(sp) > 0 && thicknessOf(supplementName(sp)) != null);
  }
  // 추가상품 전체(두께 여부와 상관없이)를 옵션 행과 따로 돌려준다 — 한국단열 검사는 지금 이걸 안 쓰지만(rows에서 뺌),
  // 나중에 추가상품만 검증해야 하는 상품이 생기면 매칭에 바로 쓸 수 있게 남겨 둔다(2026-09-29).
  // 관리코드 필드명은 확인 전이라 옵션(optionCode)과 같은 후보를 본다.
  function supplementRows(d) {
    return (d?.supplementProducts || []).map((sp) => ({
      label: supplementName(sp) || "(추가상품)",
      group: sp?.groupName || null,
      code: optionCode(sp),
      finalPrice: supplementPrice(sp),
      stockQuantity: sp?.stockQuantity,
      soldOut: (sp?.stockQuantity ?? 1) <= 0 || sp?.usable === false,
    }));
  }
  function hasOptionData(d) {
    if (d?.optionCombinations?.length || d?.combinationOptions?.[0]?.options?.length || d?.standardCombinations?.length) return true;
    // 운송비 같은 가격 없는 부가상품 하나만 있는 건 "옵션 있음"으로 안 친다 — 실제 가격이
    // 매겨진 추가상품이 2개 이상일 때만(두께별로 나눠판다고 볼 근거가 됨).
    return pricedSupplements(d).length >= 2;
  }
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

    // 일반 선택옵션이 없는 단품은 optionCombinations 필드가 응답에서 생략된다.
    // 추가 구성 상품만 있어도 기본 상품 상세 응답 자체는 유효하므로 필드 존재를 요구하지 않는다.
    if (isProductDetailUrl(msg.url) && msg.data && typeof msg.data === "object") {
      // 스마트스토어가 같은 상품 상세를 페이지 로드 중 두 번 이상 호출할 때(프리페치 등),
      // 먼저 잡힌 응답이 옵션 정보가 빠진 가벼운 버전일 수 있다 — 그걸 그대로 쓰면 실제로는
      // 두께별 옵션이 있는 상품인데도 "(옵션 없음)" 단일가로 잘못 판정된다(2026-09-15, 경쟁사
      // 가격 확인 중 옵션 상품이 단일가로 잡히던 문제). 지금 캐시에 옵션이 없고 새 응답엔
      // 있으면 그걸로 갈아끼운다 — 그 외엔 기존 "첫 응답 고정" 규칙 그대로(선택 시 재호출되는
      // 축소된 응답으로 되돌아가는 걸 막기 위함).
      if (!productData || (!hasOptionData(productData) && hasOptionData(msg.data))) {
        productData = msg.data; detailUrl = msg.url;
        console.log(TAG, "상품 상세 응답 확보(팝업에서 수집 버튼 누르면 사용됨):", productData.name, hasOptionData(productData) ? "(옵션 있음)" : "(옵션 없음)");
        // 추가상품 구조를 짐작으로 파싱하고 있어서(가격 필드명 등) 실제로 뭐가 오는지 항상
        // 그대로 찍어둔다 — 필드명이 틀렸거나 생각 못 한 항목(예: 두께 중복, 운송비 등)이
        // 섞여있으면 이 로그로 바로 확인 가능(2026-09-15, 대유물류 20T만 매칭 안 되는 문제
        // 진단 중 — 코드를 정답 데이터로 재현하면 되는데 실제론 안 되어 원본 대조가 필요함).
        if (productData.supplementProducts?.length) {
          // console.log에 객체를 그대로 넘기면 크롬이 "Array(13)"처럼 접어서 보여줘서 복사가
          // 안 된다 — 문자열로 직렬화해서 그대로 텍스트로 찍히게 한다(2026-09-15).
          console.log(TAG, "추가상품 원본(" + productData.supplementProducts.length + "개):", JSON.stringify(productData.supplementProducts, null, 1));
        }
        // 실제 검사(GET_COMPETITOR_SCAN_DATA)가 오기 전, 페이지만 열어봐도 최종 옵션 행이
        // 바로 찍히게 한다 — 산일상사처럼 optionCombinations(진짜 선택옵션, 예: "단열재 종류"
        // +"단열재 두께" 2단 드롭다운)를 쓰는 상품은 검사를 실제로 돌리지 않고 페이지만
        // 봐도 라벨이 어떻게 나오는지 바로 확인돼야 진단이 빠르다(2026-09-15).
        logFinalRows("페이지 로드 시점", buildRows());
      }
    } else if (isBenefitUrl(msg.url)) {
      // ⚠️ 옵션을 직접 클릭하면 "선택된 옵션 기준"으로 다시 호출되어 이중계산 위험 —
      // 페이지 로드 후 첫 응답만 기준가로 쓰고 이후 응답은 무시(2026-09-02 실사용 중 발견).
      if (!benefitData) {
        benefitData = msg.data; benefitUrl = msg.url;
        console.log(TAG, "할인 정보 응답 확보(최초 1회만 반영)");
      }
    }
  });

  function logFinalRows(when, rows) {
    const kind = productData?.optionCombinations?.length ? "선택옵션" : pricedSupplements(productData).length >= 2 ? "추가상품" : "단일가";
    console.log(TAG, `최종 옵션 행(${when}, ${rows.length}개, ${kind}):`,
      JSON.stringify(rows.map(r => ({ label: r.label, optionName1: r.optionName1, optionName2: r.optionName2, code: r.code, finalPrice: r.finalPrice, instantPrice: r.instantPrice, salePrice: r.salePrice, soldOut: r.soldOut })), null, 1));
    console.log(TAG, "가격 후보:", JSON.stringify(priceInfo()));
    // 옵션 관리코드 필드명을 확인하려고 첫 옵션의 원본 키를 남긴다(한국단열 검사 매칭용).
    const firstCombo = productData?.optionCombinations?.[0];
    if (firstCombo) console.log(TAG, "옵션 원본 키:", Object.keys(firstCombo).join(", "));
  }

  function baseFinalPrice() {
    const fromBenefit = benefitData?.optimalDiscount?.totalDiscountResult?.summary?.totalPayAmount;
    if (fromBenefit != null) return Number(fromBenefit);
    return Number(productData?.salePrice ?? productData?.dispSalePrice ?? 0);
  }
  // 할인 전 판매가(스토어에 입력한 판매가) — 참고용으로 같이 내보낸다.
  function baseSalePrice() {
    const v = Number(productData?.salePrice ?? productData?.dispSalePrice);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  // 즉시할인만 적용된 기준가 — 화면의 "상품 가격"(예: 할인 전 532,000원 → 상품 가격 102,000원). 알림받기·쿠폰 같은
  // 추가 혜택은 안 빠진 값이라, 그게 다 빠진 "최대할인가"(product-benefits의 totalPayAmount, 100,000원)보다 높다.
  // 한국단열 검사는 이 값으로 비교한다(2026-09-29, 5697937041처럼 알림쿠폰 2,000원이 걸린 상품이 전부 -2,000으로 나옴).
  // 상품 상세 응답의 discountedSalePrice가 그 값일 것으로 보고 쓰되(실제 응답은 이 환경에서 못 봐서 후보 필드를 순서대로
  // 본다), 최대할인가보다 낮거나 할인 전 가격보다 높으면 엉뚱한 값이라 버리고 null을 돌려준다 — 그러면 검사는 예전처럼
  // 최대할인가로 비교하면서 "쿠폰 포함가"라고 표시한다.
  function benefitPayAmount() {
    const v = Number(benefitData?.optimalDiscount?.totalDiscountResult?.summary?.totalPayAmount);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  function instantBasePrice() {
    const sale = baseSalePrice(), pay = benefitPayAmount();
    for (const raw of [productData?.discountedSalePrice, productData?.benefitsView?.discountedSalePrice, productData?.dispDiscountedSalePrice]) {
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0 && (sale == null || v <= sale) && (pay == null || v >= pay)) return v;
    }
    return null;
  }
  // 가격 후보를 그대로 남겨서 검사 결과에서 어느 값을 썼는지 볼 수 있게 한다.
  function priceInfo() {
    const pick = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => /price|discount|sale|benefit/i.test(k) && (typeof v === "number" || typeof v === "string")));
    return { salePrice: baseSalePrice(), instantBase: instantBasePrice(), benefitTotalPay: benefitPayAmount(), productPriceFields: pick(productData), benefitSummary: pick(benefitData?.optimalDiscount?.totalDiscountResult?.summary) };
  }
  // 옵션 관리코드 — 필드명이 응답마다 확실하지 않아 후보를 순서대로 본다.
  function optionCode(c) {
    const v = c?.sellerManagerCode ?? c?.sellerManagementCode ?? c?.optionManageCode ?? c?.managementCode;
    return v ? String(v).trim() : null;
  }

  // options.ignoreSupplements: 한국단열 검사는 추가상품을 옵션으로 보지 않는다 — 면테이프 같은 부속을 추가상품으로 파는데
  // 이름의 "48mm"·"100mm"(테이프 폭)가 두께로 읽혀 옵션 행으로 잡혔다(2026-09-29, 열반사단열재 그룹상품 구성 상품 전부).
  function buildRows(options = {}) {
    const combos = productData?.optionCombinations?.length
      ? productData.optionCombinations
      : (productData?.combinationOptions?.[0]?.options || productData?.standardCombinations || []);
    const base = baseFinalPrice();

    if (!combos.length) {
      // 선택옵션 콤보가 아니라, 기본 상품(예: 20T) + 추가상품(예: 30T/40T/50T…)으로 두께를
      // 나눠 파는 판매자가 있다(대유물류 확인, 2026-09-15). 추가상품은 optionCombinations의
      // "기준가+추가금" 방식이 아니라 각자 완결된 자기 가격이라 base에 더하지 않는다.
      const supplements = options.ignoreSupplements ? [] : pricedSupplements(productData);
      if (supplements.length >= 2) {
        const rows = [{ label: productData?.name || "(기본 상품)", finalPrice: base, delta: 0, soldOut: (productData?.stockQuantity ?? 1) <= 0 }];
        const baseThickness = thicknessOf(productData?.name);
        for (const sp of supplements) {
          // 대유물류처럼 기본 20T를 추가상품에도 같은 가격으로 한 번 더 넣은 경우 중복 제거.
          if (thicknessOf(supplementName(sp)) === baseThickness && supplementPrice(sp) === base) continue;
          rows.push({
            label: supplementName(sp) || "(추가상품)",
            finalPrice: supplementPrice(sp),
            delta: 0,
            stockQuantity: sp.stockQuantity,
            soldOut: (sp.stockQuantity ?? 1) <= 0 || sp.usable === false,
          });
        }
        return rows;
      }
      const sale = baseSalePrice(), instant = instantBasePrice();
      return [{ label: "(옵션 없음)", finalPrice: base, salePrice: sale, instantPrice: instant, delta: 0, soldOut: (productData?.stockQuantity ?? 1) <= 0 }];
    }
    const sale = baseSalePrice(), instant = instantBasePrice();
    return combos.map((c) => {
      const label = [c.optionName1, c.optionName2, c.optionName3].filter(Boolean).join(" / ");
      return {
        label,
        // 비드법처럼 옵션축이 2개(종류+규격)라 등급까지 옵션에 따라 달라지는 경우, 팝업의
        // "모음전 옵션 체크"가 조인된 label 문자열만으론 정확히 못 갈라서 원본 축을 따로
        // 같이 보낸다(2026-09-02, 단가표 모음전 엑셀 export 로직을 기준으로 역파싱하려면
        // optionName1/optionName2가 각각 필요함).
        optionName1: c.optionName1 || null,
        optionName2: c.optionName2 || null,
        optionName3: c.optionName3 || null,
        finalPrice: base + Number(c.price || 0),
        salePrice: sale != null ? sale + Number(c.price || 0) : null,
        instantPrice: instant != null ? instant + Number(c.price || 0) : null,
        code: optionCode(c),
        delta: Number(c.price || 0),
        stockQuantity: c.stockQuantity,
        soldOut: (c.stockQuantity ?? 1) <= 0,
      };
    });
  }

  // 옵션 항목 이름(예: "아이소핑크 두께선택") — 모음전 옵션 엑셀의 첫 열 제목이다(2026-10-01). 응답의 필드명을 이 환경에서 못 봐서
  // 후보를 순서대로 본다. 못 찾으면 [] — 그때는 화면이 제목을 따로 묻는다. optionKeys는 진단용(응답에서 "option"이 들어간 키 이름).
  // 상품 상세 API 응답에 제목이 없으면, 페이지가 처음부터 들고 있는 데이터(inline script의 __PRELOADED_STATE__ 등)에서 같은 이름의 필드를 찾는다.
  function groupNamesFromPage() {
    try {
      for (const script of document.scripts || []) {
        const text = String(script.textContent || "");
        const at = text.indexOf("optionCombinationGroupNames");
        if (at < 0) continue;
        const match = /optionCombinationGroupNames"?\s*:\s*(\{[^{}]*\})/.exec(text.slice(at, at + 600));
        if (!match) continue;
        const obj = JSON.parse(match[1].replace(/\\"/g, '"'));
        const names = [obj.optionGroupName1, obj.optionGroupName2, obj.optionGroupName3].map((v) => String(v || "").trim()).filter(Boolean);
        if (names.length) return names;
      }
    } catch { /* 못 읽으면 빈 목록 */ }
    return [];
  }
  function optionGroupNames() {
    const d = productData || {};
    const objects = [d.optionCombinationGroupNames, d.optionGroupNames, d.optionNames, d.optionCombinationGroups];
    for (const obj of objects) {
      if (Array.isArray(obj)) {
        const names = obj.map((v) => (typeof v === "string" ? v : v?.groupName || v?.name || v?.optionGroupName)).map((v) => String(v || "").trim()).filter(Boolean);
        if (names.length) return names;
      } else if (obj && typeof obj === "object") {
        const names = [obj.optionGroupName1, obj.optionGroupName2, obj.optionGroupName3].map((v) => String(v || "").trim()).filter(Boolean);
        if (names.length) return names;
      }
    }
    return groupNamesFromPage();
  }
  // 못 읽었을 때 어디에 있는지 찾는 단서 — 응답에서 "option"이 들어간 키와 값의 모양(글자 수·개수)만 남긴다(값 전체는 길어서 안 보냄).
  function optionHints() {
    const d = productData || {};
    return Object.fromEntries(Object.keys(d).filter((key) => /option|group/i.test(key)).map((key) => {
      const v = d[key];
      const shape = Array.isArray(v) ? `배열(${v.length})` : v && typeof v === "object" ? `객체{${Object.keys(v).slice(0, 6).join(",")}}` : typeof v === "string" ? `글자(${v.slice(0, 40)})` : typeof v;
      return [key, shape];
    }));
  }

  // 팝업의 "현재 페이지 수집" 버튼이 보내는 요청 — 지금까지 가로챈 데이터로 즉시 응답한다.
  // 페이지를 막 열자마자(응답이 아직 안 왔을 때) 누르면 ok:false로 알려준다.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "GET_COMPETITOR_SCAN_DATA") return false;
    if (!productData) {
      sendResponse({ ok: false, reason: "not_ready" });
      return false;
    }
    try {
      const rows = buildRows({ ignoreSupplements: msg.ignoreSupplements === true });
      logFinalRows("검사 요청 시점", rows);
      sendResponse({
        ok: true, detailUrl, benefitUrl, benefitReady: benefitData != null,
        productName: productData.name || document.title,
        storeName: productData.channel?.channelName || null,
        productUrl: location.href.split("?")[0].split("#")[0],
        rows,
        supplements: supplementRows(productData),
        priceInfo: priceInfo(),
        optionGroupNames: optionGroupNames(),
        optionKeys: Object.keys(productData || {}).filter((key) => /option/i.test(key)),
        optionHints: optionHints(),
      });
    } catch (error) {
      sendResponse({ok:false,reason:"collector_error",error:error?.message || String(error),detailUrl,benefitReady:benefitData != null});
    }
    return false;
  });
})();
