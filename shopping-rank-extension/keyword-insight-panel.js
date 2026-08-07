// 네이버 가격비교 검색 페이지에 판다랭크 패널처럼 우리 데이터를 자연스럽게 끼워 넣는다.
// 두 종류의 데이터를 합쳐서 보여준다:
// 1) Supabase에서 받는 것 — 월간 검색량/추세/연관 키워드 (naver-rank 엣지함수 keywordInsight)
// 2) 지금 로딩된 이 페이지 자체에서 바로 뽑는 것 — 경쟁지수/시장가격대/내 스토어 순위/
//    판매자별 노출 순위. parser-core.js(RankParser)로 __NEXT_DATA__를 파싱해서 얻는다
//    (page-collector.js가 순위 수집에 쓰는 것과 같은 파서 — API 호출 없이 공짜).
(function () {
  const HOST_ID = "energuard-keyword-insight";
  const CACHE_PREFIX = "energuardKeywordInsightCache:";
  const CACHE_TTL_MS = 30 * 60 * 1000; // 같은 키워드 30분 내 재방문 시 재조회 방지(Supabase 조회분만)
  const OBSERVE_MS = 15000; // 이 시간 동안만 "나중에 인라인 자리 생기면 옮기기"를 감시
  const OWN_STORE_NAMES = ["한국단열", "에너가드"]; // compact() 비교용 — naver-rank.html의 MY_STORES와 동일 기준
  const NOISE_TAGS = new Set(["오늘출발", "오늘발송"]); // report.js의 NOISE_TAGS와 동일 — 거의 모든 상품에 붙는 배송 배지

  function currentQuery() {
    try {
      return new URLSearchParams(location.search).get("query")?.trim() || "";
    } catch (_) {
      return "";
    }
  }

  function fmt(n) {
    return n == null ? "-" : Number(n).toLocaleString();
  }

  function compact(s) {
    return String(s || "").replace(/\s+/g, "").toLowerCase();
  }

  function isOwnStore(mallName) {
    const c = compact(mallName);
    return OWN_STORE_NAMES.some((name) => c.includes(name));
  }

  // 개발자도구로 확인한 실제 마크업: 안내문구는 resultSummary_result_summary__(해시) 안에
  // 있고 그 바로 다음이 필터박스다 — 판다랭크 패널이 들어가는 자리와 정확히 같은 위치.
  // 리액트 CSS 모듈 클래스라 뒤 해시는 배포마다 바뀌지만 앞부분은 안정적이라 부분일치로 잡는다.
  const NOTICE_SELECTOR = '[class*="resultSummary_result_summary__"]';

  function findInsertionPoint() {
    return document.querySelector(NOTICE_SELECTOR);
  }

  // 검색창 아래 네이버 자체 "연관" 추천칩 — 상품 카드와 같은 data-shp-contents-grp 계열
  // 속성을 쓰지만 그룹값이 "rec1"이다(nplus-collector.js에서 GNB/rec1/sch를 상품이 아닌
  // 위젯으로 걸러낼 때 이미 확인한 값, 2026-08-06). API 호출 없이 지금 로딩된 페이지에서
  // 바로 읽으므로 추가 요청이 전혀 없다(2026-08-07).
  function readNativeRelatedChips() {
    try {
      const byGroup = [...document.querySelectorAll('a[data-shp-contents-grp="rec1"]')]
        .map((a) => a.textContent.trim())
        .filter(Boolean);
      if (byGroup.length) return [...new Set(byGroup)];

      // rec1 선택자가 이 페이지(가격비교 search/all)에서는 안 맞을 수 있다 — nplus-collector.js가
      // 확인한 건 ns/search(N+스토어) 페이지였다. "연관" 라벨을 직접 찾아 그 주변 앵커를 뽑는
      // 방식으로 폴백하고, 그마저 실패하면 콘솔에 실제 data-shp-contents-grp 값들을 남겨서
      // 다음에 정확한 선택자를 알아낼 수 있게 한다(2026-08-07).
      const labelEl = [...document.querySelectorAll("*")].find(
        (el) => el.children.length === 0 && el.textContent.trim() === "연관"
      );
      if (labelEl) {
        const container = labelEl.closest("div")?.parentElement || labelEl.parentElement;
        // 캐러셀 좌우 이동 버튼("다음"/"이전")도 앵커라서 같이 잡힌다 — 실제 키워드가 아니므로 제외.
        const CONTROL_WORDS = new Set(["연관", "다음", "이전", "더보기"]);
        const fallback = [...(container?.querySelectorAll("a") || [])]
          .map((a) => a.textContent.trim())
          .filter((t) => t && !CONTROL_WORDS.has(t));
        if (fallback.length) return [...new Set(fallback)];
      }

      const groups = [...new Set(
        [...document.querySelectorAll("[data-shp-contents-grp]")]
          .map((el) => el.getAttribute("data-shp-contents-grp"))
      )];
      console.warn("[ENERGUARD] 연관검색어 칩을 못 찾음 — 발견된 data-shp-contents-grp 값:", groups);
      return [];
    } catch (error) {
      console.warn("[ENERGUARD] 연관검색어 칩 읽기 실패:", error);
      return [];
    }
  }

  // __NEXT_DATA__를 직접 읽어 지금 로딩된 상품 목록과 총 상품수를 뽑는다. page-collector.js와
  // 별개 콘텐츠스크립트지만 같은 격리 월드(world)를 쓰는 확장프로그램이라 RankParser 전역을
  // 그대로 공유해 쓸 수 있다(manifest에도 parser-core.js를 이 스크립트와 같이 등록해뒀다).
  function readPageProducts() {
    try {
      const script = document.getElementById("__NEXT_DATA__");
      if (!script || !window.RankParser) return { products: [], totalCount: null };
      const json = JSON.parse(script.textContent || "{}");
      const { products } = window.RankParser.parseNextDataProducts(json, 1);
      return { products, totalCount: findTotalCount(json) };
    } catch (_) {
      return { products: [], totalCount: null };
    }
  }

  // __NEXT_DATA__ 어딘가에 있을 "전체 결과 개수" 필드를 이름으로 찾는다(정확한 위치를 몰라도
  // totalCount류 이름의 숫자 필드를 얕은 우선순위로 탐색). 못 찾으면 null — 그땐 로딩된 목록
  // 개수로 대체한다.
  function findTotalCount(root) {
    const visited = new Set();
    let found = null;
    function visit(value, depth) {
      if (found != null || !value || typeof value !== "object" || depth > 12 || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((v) => visit(v, depth + 1));
        return;
      }
      for (const [key, val] of Object.entries(value)) {
        if (found != null) return;
        if (/^(totalCount|total_count|resultCount|result_count|totCount)$/i.test(key) && typeof val === "number" && val > 0) {
          found = val;
          return;
        }
      }
      for (const val of Object.values(value)) {
        if (found != null) return;
        visit(val, depth + 1);
      }
    }
    visit(root, 0);
    return found;
  }

  // naver-rank.html의 compScore와 동일한 로그 보간 — 상품수÷검색량 비율을 0~100점으로.
  function compScore(r) {
    if (r == null) return null;
    if (r <= 0) return 0;
    const anchors = [[0.05, 0], [0.8, 40], [3, 70], [50, 100]];
    if (r <= anchors[0][0]) return 0;
    if (r >= anchors[anchors.length - 1][0]) return 100;
    for (let i = 0; i < anchors.length - 1; i++) {
      const [r1, s1] = anchors[i];
      const [r2, s2] = anchors[i + 1];
      if (r <= r2) {
        const t = (Math.log10(r) - Math.log10(r1)) / (Math.log10(r2) - Math.log10(r1));
        return Math.round(s1 + t * (s2 - s1));
      }
    }
    return 100;
  }

  // 지금 로딩된 상품 목록에서 경쟁지수/가격대/내 스토어 순위/판매자별 노출을 계산한다.
  function buildPageInsight(monthlyTotal) {
    const { products, totalCount } = readPageProducts();
    const organic = products.filter((p) => !p.isAd);
    if (!organic.length) return null;

    const prices = organic.map((p) => p.price).filter((p) => p > 0);
    const priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;

    // 평균 구매수(네이버가 주는 "최근 6개월 구매건수")/평균 리뷰수 — 이 키워드 경쟁 상품들이
    // 평균적으로 얼마나 팔리고 후기가 쌓였는지, 가격대처럼 감을 잡게 해준다(2026-08-07,
    // report.html 상품 표의 "구매/리뷰" 컬럼을 패널에도 요약해달라는 요청으로 추가).
    const purchaseCounts = organic.map((p) => Number(p.purchaseCount) || 0);
    const reviewCounts = organic.map((p) => Number(p.reviewCount) || 0);
    const avg = (arr) => arr.length ? Math.round(arr.reduce((sum, v) => sum + v, 0) / arr.length) : null;
    const avgPurchase = avg(purchaseCounts);
    const avgReview = avg(reviewCounts);

    const productCount = totalCount != null ? totalCount : organic.length;
    const ratio = monthlyTotal > 0 ? productCount / monthlyTotal : null;
    const score = ratio != null ? compScore(ratio) : null;
    const isPageCountOnly = totalCount == null;

    let myBestRank = null;
    const mallAgg = new Map();
    let catalogIdx = 0;
    organic.forEach((p) => {
      // 가격비교(카탈로그) 통합형 카드는 원본 데이터에 판매자 정보 자체가 없다(mallName 없음).
      // 전부 "가격비교 상품" 하나로 합치면 서로 다른 상품인데 한 경쟁사처럼 부풀려 보여서,
      // 상품코드 기준으로 각각 따로 집계한다(합쳐지지 않게).
      const hasMall = !!p.mallName;
      const key = hasMall ? p.mallName : `catalog:${p.productCode || p.naverProductId || catalogIdx++}`;
      const agg = mallAgg.get(key) || { mall: hasMall ? p.mallName : "가격비교 상품", count: 0, points: 0 };
      agg.count += 1;
      // naver-rank.html의 "판매자 분석"과 같은 순위 가중 점수(influence) — 단순 개수 비율로 두면
      // 1위 상품 하나뿐인 판매자보다 50위권 상품을 여러 개 가진 판매자가 더 높게 나오는 역전이
      // 생겼다(2026-08-07, 두 화면 수치가 서로 달라 보인다는 지적으로 발견). 두 화면 기준을
      // naver-rank.html 쪽(순위 가중)으로 통일한다.
      const rank = Number(p.rank);
      if (Number.isFinite(rank) && rank > 0) agg.points += rank <= 10 ? 100 / rank : 100 / (rank + 9);
      mallAgg.set(key, agg);
      if (isOwnStore(p.mallName) && (myBestRank == null || p.rank < myBestRank)) myBestRank = p.rank;
    });
    const totalPoints = [...mallAgg.values()].reduce((sum, s) => sum + s.points, 0) || 1;
    const sellers = [...mallAgg.values()]
      .map((s) => ({ ...s, share: totalPoints ? (s.points / totalPoints * 100) : 0 }))
      .sort((a, b) => b.share - a.share);

    // 주요 카테고리 — naver-rank.html의 topCategory 계산과 동일(가장 많이 나온 카테고리 경로).
    const categoryCount = new Map();
    organic.forEach((p) => {
      const cat = String(p.categoryPath || "").trim();
      if (cat) categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    });
    const topCategory = [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // 해시태그(검색태그) 빈도 — report.html "자주 등장한 태그"와 동일 로직·동일 노이즈 필터
    // (2026-08-07, 연관키워드 탭 세 번째 데이터로 추가).
    const tagCount = new Map();
    organic.forEach((p) => {
      (Array.isArray(p.tags) ? p.tags : []).forEach((tag) => {
        if (NOISE_TAGS.has(tag)) return;
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    });
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

    return {
      priceRange, score, ratio, isPageCountOnly, myBestRank, sellers, productCount,
      organicCount: organic.length, topCategory, topTags, avgPurchase, avgReview,
    };
  }

  // 판다랭크 배지("좋음"/"보통"/"나쁨")와 같은 3단계 — compScore 앵커(40/70)에 맞춘 경계.
  function scoreGrade(score) {
    if (score == null) return null;
    if (score < 40) return { text: "좋음", cls: "good" };
    if (score < 70) return { text: "보통", cls: "mid" };
    return { text: "나쁨", cls: "bad" };
  }

  // "0.3 : 1" / "1 : 3.2" 형태 — naver-rank.html의 fmtRatio와 동일한 규칙.
  function fmtRatio(r) {
    if (r == null) return "-";
    if (r === 0) return "0 : 1";
    if (r >= 1) return (Math.round(r * 10) / 10) + " : 1";
    return "1 : " + (Math.round((1 / r) * 10) / 10);
  }

  // "1 : 262.2" 같은 숫자만 봐서는 뭐가 좋은 건지 감이 안 온다는 지적(2026-08-07) — 같은 숫자를
  // 말로 풀어서 호버 툴팁 + 카드 안 작은 캡션으로 같이 보여준다.
  function ratioHintText(r) {
    if (r == null) return "";
    if (r === 0) return "경쟁 상품이 없어요";
    if (r >= 1) return `검색 1회당 경쟁상품 ${Math.round(r * 10) / 10}개 — 적을수록 여유 있어요`;
    return `상품 1개당 검색 ${Math.round((1 / r) * 10) / 10}회 — 많을수록 여유 있어요`;
  }

  const CARD_STYLE = `
    *{box-sizing:border-box}
    .card{width:100%;padding:18px 22px;border:1px solid #dedede;border-radius:10px;background:#fff;
      color:#1d2433;font-family:Pretendard,"Noto Sans KR",Arial,sans-serif;margin:14px 0}
    .card.floating{position:fixed;right:22px;top:90px;z-index:2147483646;width:300px;
      box-shadow:0 12px 32px rgba(15,23,42,.14);margin:0;max-height:80vh;overflow-y:auto}
    .head{display:flex;align-items:center;justify-content:space-between}
    .card:not(.collapsed) .head{margin-bottom:18px}
    .brand-logo{display:flex;align-items:center;gap:8px;font-family:"Segoe UI","Pretendard","Noto Sans KR",Arial,sans-serif;
      font-weight:900;font-size:19px;letter-spacing:-.01em;color:#1d2433}
    .brand-icon{width:26px;height:26px;border-radius:7px;display:block;flex:none}
    .brand-logo span:last-child{color:#e85d2f}
    .collapse-btn{cursor:pointer;border:none;background:none;color:#98a2b3;padding:4px;display:flex;
      align-items:center;justify-content:center;border-radius:4px}
    .collapse-btn:hover{background:#f5f6f8}
    .collapse-btn svg{width:16px;height:16px;transition:transform .15s ease}
    .card.collapsed .collapse-btn svg{transform:rotate(-90deg)}
    /* .card:not(.floating) .card-body{display:flex}가 이 규칙보다 명시도가 높아져서(오늘 카드
       높이 고정 작업 중 추가됨) 접기 버튼을 눌러도 본문이 안 숨겨지는 버그가 있었다(2026-08-07
       실측 확인) — !important로 확실히 이기게 함. */
    .card-body.hidden{display:none!important}
    /* 탭을 바꿔도 카드 크기가 안 변해야 한다 — 처음엔 JS로 매번 재서 고정했는데 재렌더링
       타이밍에 따라 자꾸 깨졌고, 그다음엔 고정 min-height 숫자를 박아뒀는데 두 탭의 실제
       내용 높이가 서로 달라서(하나는 그 숫자보다 크고 하나는 작고) 탭 전환할 때마다 카드
       높이가 오락가락했다(2026-08-07 실측, "연관키워드 탭 클릭시 높이가 더 줄어든다" 지적).
       진짜 해법은 숫자를 맞히는 게 아니라, 두 탭을 같은 그리드 셀에 겹쳐놓고 안 보이는
       쪽도 visibility:hidden(=레이아웃 계산엔 포함, 화면엔 안 그림)으로만 감춰서, 카드 높이가
       "둘 중 더 큰 탭의 실제 높이"로 항상 자동으로 고정되게 만드는 것 — 어느 쪽 콘텐츠가
       나중에 늘어나거나 줄어들어도 숫자를 다시 맞출 필요가 없다.
       플로팅(좁은 고정폭) 카드는 콘텐츠 자체가 훨씬 작아서 이 락을 적용하지 않는다. */
    .card:not(.floating) .card-body{min-height:400px;display:flex;flex-direction:column}
    .card:not(.floating) .tab-panels-stack{display:grid;flex:1;min-height:0}
    .card:not(.floating) .tab-panels-stack .tab-panel{grid-area:1/1/2/2;display:flex;flex-direction:column;min-height:0}
    .card:not(.floating) .tab-panels-stack .tab-panel.hidden{visibility:hidden!important;display:flex!important;pointer-events:none}
    .tab-row{display:flex;align-items:center;justify-content:space-between;gap:16px;
      width:100%;margin:10px 0 12px}
    .tab-group{display:inline-flex;align-items:center;gap:24px;flex:none}
    .tab-btn{position:relative;display:inline-flex;align-items:center;height:30px;padding:0 0 8px;
      border:0;background:transparent;color:#aeb6c4;font-family:inherit;font-size:18px;font-weight:900;cursor:pointer}
    .tab-btn:not(.active):hover{color:#7f8795}
    .tab-btn.active{color:#07111f}
    .tab-btn.active::after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:3px;
      background:#e85d2f;border-radius:999px}
    .tab-links{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .card.floating .tab-links{display:none}
    /* item-discovery.html의 트렌드 분석 탭(.trend-tab)과 같은 뱃지 스타일 */
    .tab-link{display:inline-flex;align-items:center;height:30px;padding:0 13px;font-size:13px;
      color:#5a6378;font-weight:900;text-decoration:none;white-space:nowrap;
      border:1px solid #e8ecf2;border-radius:6px;background:#fff;
      transition:background .12s ease,color .12s ease,border-color .12s ease}
    .tab-link:hover{border-color:#c8cdd4;background:#fafbfc;color:#07111f}
    /* "키워드 분석 확인하기"만 대표 오렌지색으로 강조 — 나머지 두 뱃지는 기본 톤 유지 */
    .tab-link.primary{color:#e85d2f;border-color:#f3c9b2;background:#fff5ef}
    .tab-link.primary:hover{border-color:#e85d2f;background:#ffe9dc;color:#e85d2f}
    .tab-panel.hidden{display:none!important}
    .tab-divider{border:none;border-top:1px solid #e4e7ec;margin:0 -22px 22px;height:0}
    /* sales-analysis.html의 top3ListHtml/.summary-top3-* 를 참고했다 — 원형 순위 배지, 한 줄
       행+아래 구분선, 값/비중 두 줄 스택까지는 그대로. "더보기" 토글은 뺐다 — 펼칠 때마다
       카드가 늘어나거나(초기 버전) 늘어난 것처럼 보이는(overflow 삐져나옴) 문제가 계속
       반복돼서(2026-08-07), 상태 전환 자체를 없애고 목록을 처음부터 고정 높이 스크롤
       영역으로 바꿨다 — 항목이 몇 개든 카드 높이가 항상 똑같다. */
    .related-card-grid{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;flex:1;min-height:0}
    .card.floating .related-card-grid{flex-direction:column}
    .related-card{flex:1 1 200px;min-width:0;overflow:hidden;
      display:flex;flex-direction:column;border:1px solid #e8ecf2;border-radius:6px;padding:16px 18px}
    .related-card-title{flex:none;font-size:12px;font-weight:800;color:#5a6378;margin-bottom:12px}
    .related-rank-list{height:260px;overflow-y:auto}
    .related-rank-row{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f4f5f7}
    .related-rank-row:last-of-type{border-bottom:none}
    .related-rank-num{flex:none;width:20px;height:20px;border-radius:50%;background:#eef0f3;
      display:inline-flex;align-items:center;justify-content:center;
      font-family:Consolas,"JetBrains Mono",monospace;font-size:11px;font-weight:800;color:#5a6378}
    .related-rank-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:13px;font-weight:700;color:#1d2433}
    .related-rank-value{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;
      font-family:Consolas,"JetBrains Mono",monospace;font-size:12px;font-weight:800;color:#1d2433;white-space:nowrap}
    .related-rank-share{font-size:10.5px;font-weight:700;color:#5a6378;font-family:inherit}
    .headline{font-size:23px;font-weight:800;line-height:1.4;margin:0 0 6px}
    .category-line{font-size:12px;color:#5a6378;font-weight:600;margin:0 0 22px}
    .category-line b{color:#1d2433;font-weight:700}
    .headline b{font-weight:800}
    .headline b.up{color:#16a34a}.headline b.down{color:#dc2626}
    /* 연관키워드 탭 제안 문구 — 키워드는 브랜드 오렌지, 해시태그는 파란색으로 구분(2026-08-07) */
    .headline b.hl-kw{color:#e85d2f}
    .headline b.hl-tag{color:#0ea5e9}
    .kw{font-size:12px;color:#5a6378;font-weight:600;margin:0 0 12px}
    .up{color:#16a34a}.down{color:#dc2626}.flat{color:#667085}
    .section-title{font-size:11px;color:#5a6378;margin-bottom:8px;font-weight:700}
    .empty{font-size:12px;color:#98a2b3;padding:6px 0}
    /* vol-layout 자체가 남는 세로 공간을 흡수하게 한다 — 안 그러면 옆 탭(연관키워드 등)에 맞춰
       tab-panel이 늘어난 만큼이 카드 3칸 아랫줄과 바깥 카드 테두리 사이에 빈 띠로 그대로
       남았다(2026-08-07 지적). flex:1로 늘어난 공간을 카드 3칸 쪽으로 넘기면, 그 안의
       justify-content:space-between이 이어받아 내용 사이사이로 고르게 분산한다. */
    .vol-layout{display:flex;gap:24px;align-items:stretch;margin-bottom:16px;flex:1;min-height:0}
    .card.floating .vol-layout{flex-direction:column}
    .vol-chart-col{flex:1;min-width:0;display:flex}
    .vol-chart-box{flex:1;display:flex;flex-direction:column;justify-content:center}
    .vol-chart-wrap{position:relative}
    .vol-chart-wrap svg{display:block;width:100%;height:auto}
    .vol-tip{position:absolute;top:2px;transform:translateX(-50%);padding:5px 10px;border-radius:6px;
      background:#161a22;color:#fff;font-size:12px;font-weight:700;font-family:Consolas,monospace;
      white-space:nowrap;pointer-events:none;z-index:10}
    /* 아이템스카우트 참고 — "네이버쇼핑지표/네이버광고지표" 같은 작은 배지 타일 2칸 그리드
       (2026-08-07). */
    .badge-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .badge-tile{border:1px solid #e8ecf2;border-radius:6px;padding:10px;text-align:center}
    .badge-tile-label{font-size:11px;color:#8a94a6;font-weight:700;margin-bottom:6px}
    .badge-tile-value{font-size:13px;font-weight:800;color:#1d2433}
    /* 검색어 데이터 카드 | 노출순위 카드 | 그래프, 한 줄 3칸(2026-08-07) — 그래프도 같은
       .side-box로 감싸서 세 칸이 같은 카드 톤으로 보이게 한다. */
    .vol-side-col{width:240px;flex:none;display:flex;flex-direction:column;gap:10px}
    /* 카드 높이가 옆 칸(연관키워드 탭 등)에 맞춰 늘어나면, 내용이 위쪽에 몰리고 아래쪽에
       빈 띠가 남았다(2026-08-07 지적) — 안 내용을 위아래로 고르게 펼쳐서 빈 공간이 뭉치지
       않고 자연스럽게 분산되게 한다. */
    .vol-side-col .side-box{flex:1;display:flex;flex-direction:column;justify-content:space-between}
    .vol-side-col .sellers{flex:1;justify-content:space-between}
    .card.floating .vol-side-col{width:100%}
    .side-box{border:1px solid #e8ecf2;border-radius:6px;padding:12px 14px}
    /* 연관키워드 카드(.related-card-title 등)와 같은 톤으로 맞춤 — 제목은 옅은 회색,
       숫자값은 모노스페이스(2026-08-07, "키워드분석쪽 폰트도 연관검색어에 맞춰줘" 요청). */
    .side-box-title{display:flex;align-items:center;justify-content:space-between;
      font-size:12px;font-weight:800;color:#5a6378;margin-bottom:8px}
    .grade{font-size:11px;font-weight:800;padding:2px 7px;border-radius:5px}
    .grade.good{color:#16a34a;background:#eafaf0}
    .grade.mid{color:#d97706;background:#fef6e8}
    .grade.bad{color:#e11d48;background:#fdecef}
    .side-box-row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;
      border-top:1px solid #f4f5f7;color:#5a6378}
    .side-box-row:first-of-type{border-top:none}
    .side-box-row b{color:#1d2433;font-weight:800;font-family:Consolas,"JetBrains Mono",monospace}
    .side-box-row b.up{color:#16a34a}.side-box-row b.down{color:#dc2626}.side-box-row b.flat{color:#667085}
    .sellers{display:flex;flex-direction:column;gap:6px}
    .seller-row{display:grid;grid-template-columns:18px 1fr 60px;align-items:center;gap:8px;font-size:12px}
    .seller-rank{color:#98a2b3;font-weight:700;font-family:Consolas,"JetBrains Mono",monospace}
    .seller-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:#1d2433}
    .seller-row.mine .seller-name{color:#e85d2f;font-weight:800}
    .seller-share{text-align:right;color:#5a6378;font-family:Consolas,"JetBrains Mono",monospace}
    .seller-bar-wrap{grid-column:1 / -1;background:#f5f6f8;border-radius:3px;height:5px;overflow:hidden;margin-top:-3px}
    .seller-bar{display:block;height:100%;background:#c7cbd3}
    .seller-row.mine .seller-bar{background:#e85d2f}
  `;

  function trendPair(rows, monthsBack) {
    if (!rows || rows.length <= monthsBack) return null;
    const cur = rows[0], prev = rows[monthsBack];
    if (!(prev.total > 0)) return null;
    return (cur.total - prev.total) / prev.total * 100;
  }

  function trendText(pct) {
    if (pct == null) return { text: "-", cls: "" };
    if (pct > 5) return { text: `상승세 ▲${pct.toFixed(1)}%`, cls: "up" };
    if (pct < -5) return { text: `하락세 ▼${Math.abs(pct).toFixed(1)}%`, cls: "down" };
    return { text: "유지", cls: "flat" };
  }

  // 판다랭크의 "지난해에 비해 검색량이 -15.2% 감소했어요" 같은 큰 글씨 요약 문구.
  function headlineHtml(trendYear) {
    if (trendYear == null) return "";
    if (Math.abs(trendYear) < 0.1) return `<p class="headline">지난해와 검색량이 비슷해요.</p>`;
    const cls = trendYear > 0 ? "up" : "down";
    const verb = trendYear > 0 ? "증가" : "감소";
    return `<p class="headline">지난해에 비해 검색량이 <b class="${cls}">${Math.abs(trendYear).toFixed(1)}%</b> ${verb}했어요.</p>`;
  }

  // naver-rank.html 분석 결과 배너의 "주요 카테고리 > ..."와 같은 정보 — 지금 로딩된 페이지의
  // 일반상품 중 가장 많이 나온 카테고리 경로.
  function categoryLineHtml(topCategory) {
    if (!topCategory) return "";
    return `<p class="category-line">주요 카테고리 <b>${topCategory}</b></p>`;
  }

  const COLLAPSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // "0"이 아니라 1/2/2.5/5/10 배수로 Y축 최대값을 올림 — sales-analysis.html의 nsNiceCeil과 동일.
  function niceCeil(v) {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) { if (v <= m * pow) return m * pow; }
    return 10 * pow;
  }

  // 매출분석 > 일별 매출 차트(renderSalesTrendChart)와 같은 방식 — 격자선+Y축 눈금,
  // 최고/최저 주석, 호버 시 크로스헤어+툴팁. trendChartHtml과 bindTrendChart가 같은 기하
  // 계산을 공유해야 해서 별도 함수로 뺐다.
  // 수집이 안 된 달이 중간에 있으면 그냥 건너뛰어서, 실제로는 두 달 차이인 막대끼리 한 칸
  // (다른 구간과 같은 간격)으로 붙어 보이고 나머지 구간은 상대적으로 넓어 보였다 — 빠진 달을
  // 0으로 채워서 항상 연속된 월 시퀀스로 만든다(매출분석 일별 매출 차트의 빈 날짜 채우기와 같은 방식).
  function fillMonthGaps(ascRows) {
    if (ascRows.length < 2) return ascRows;
    const byMonth = new Map(ascRows.map((r) => [r.month, r]));
    let [y, m] = ascRows[0].month.split("-").map(Number);
    const [endY, endM] = ascRows[ascRows.length - 1].month.split("-").map(Number);
    const filled = [];
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      filled.push(byMonth.get(key) || { month: key, total: 0, missing: true });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return filled;
  }

  function trendChartGeometry(rows) {
    const raw = fillMonthGaps((rows ? [...rows].reverse() : [])
      .filter((r) => r.snapshot_month)
      .map((r) => ({ month: r.snapshot_month, total: Number(r.total) || 0 })));
    if (raw.length < 2) return null;
    // 오른쪽 사이드 박스 3개(키워드/노출비중/추가통계) 쌓은 높이와 맞춰서 배치가 어긋나
    // 보이지 않게 세로 비율을 키웠다(예전 600:220은 사이드 박스보다 훨씬 짧아서 빈 공간이 컸다).
    // padR은 매출분석 차트(renderSalesTrendChart, padR:34)와 맞춰 넉넉히 — 좁으면 맨 끝 라벨을
    // 가운데 정렬로 못 그리고 옆으로 밀어야 해서 막대와 라벨이 안 맞아 보인다.
    // padL은 Y축 숫자(보통 5~6자리, "20,000")가 안 잘릴 최소한만 — 너무 넓으면 그래프 왼쪽이
    // 헤드라인·카테고리 텍스트보다 눈에 띄게 안으로 들어가 보인다(2026-08-06 피드백).
    const W = 600, H = 310, padL = 42, padR = 34, padT = 20, padB = 30;
    const iw = W - padL - padR, ih = H - padT - padB;
    const vals = raw.map((d) => d.total);
    const yMax = niceCeil(Math.max(...vals, 1));
    const y = (v) => padT + ih - (v / yMax) * ih;
    // 막대 폭 — 데이터가 몇 달치뿐이면(예: 2개월) 칸이 넓어져서 큰 색 블록처럼 보였다 —
    // 최대 폭만 못 넘게 잡는다(iw는 이 계산에서만 쓰고, 실제 좌표축 여유엔 안 씀).
    const barW = Math.min(44, Math.max(2, iw / raw.length * 0.55));
    // x(i)를 계산할 때부터 막대 반폭만큼 안쪽으로 여유를 넣는다 — 사후에 첫/끝 막대만 따로
    // 당기면(clamp) 그 둘만 간격이 달라 보이는데(2026-08-06 확인), 처음부터 축 전체를
    // barW/2씩 줄여서 잡으면 첫 막대의 왼쪽 끝과 마지막 막대의 오른쪽 끝이 정확히 padL/W-padR에
    // 닿으면서도 막대 사이 간격은 모두 동일하게 유지된다. barW가 큰(데이터 적은) 경우에도
    // 첫 막대가 Y축 숫자 영역을 침범하지 않는다.
    const usableL = padL + barW / 2, usableR = W - padR - barW / 2;
    const x = (i) => raw.length > 1 ? usableL + (i * (usableR - usableL)) / (raw.length - 1) : (usableL + usableR) / 2;
    const barX = (i) => x(i) - barW / 2;
    const barCenterX = (i) => x(i);
    return { raw, vals, W, H, padL, padR, padT, padB, iw, ih, yMax, x, y, barW, barX, barCenterX };
  }

  const BAR_BASE = "#f6d3c2"; // 평소 막대 색(연한 톤)
  const BAR_CUR = "#e85d2f"; // 최근 달만 강조(진한 브랜드 색)
  const BAR_HOVER = "#f0a67d"; // 마우스 올렸을 때(강조 막대가 아닌 경우)

  function trendChartHtml(rows) {
    const g = trendChartGeometry(rows);
    if (!g) return `<div class="empty">검색량 스냅샷이 부족합니다.</div>`;
    const { raw, vals, W, H, padL, padR, padT, ih, yMax, x, y, barW, barX, barCenterX } = g;

    let grid = "", axisLabels = "";
    for (let s = 0; s <= 4; s++) {
      const v = (yMax * s) / 4, yy = y(v);
      grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#eef0f3" stroke-width="1"></line>`;
      axisLabels += `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#98a2b3">${Math.round(v).toLocaleString()}</text>`;
    }
    // 마지막 인덱스는 항상 강제로 넣다 보니, 그 앞의 정규 간격 라벨과 너무 가까워지면
    // (예: 36개월에 step=6인데 마지막이 35번째라 30번째 라벨과 5칸밖에 안 벌어짐) 겹쳐 보였다.
    // 마지막 라벨과 너무 가까운 정규 라벨은 건너뛴다.
    const step = Math.max(1, Math.ceil(raw.length / 6));
    const lastIdx = raw.length - 1;
    raw.forEach((d, i) => {
      const isRegular = i % step === 0;
      const isLast = i === lastIdx;
      if (!isRegular && !isLast) return;
      if (isRegular && !isLast && lastIdx - i < step * 0.6) return; // 마지막과 겹칠 만큼 가까운 정규 라벨 제외
      // 원래 점 위치(x)가 아니라 실제 막대 중심(barCenterX)에 맞춘다 — 첫/끝 막대는
      // 플롯 영역 밖으로 안 삐져나가게 안쪽으로 당겨져 있어서(barX의 clamp), 라벨도 그
      // 당겨진 위치를 따라가야 막대와 정확히 맞는다. padR도 넉넉히 잡아 가운데 정렬로 충분하다.
      axisLabels += `<text x="${barCenterX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#98a2b3">${d.month.slice(2)}</text>`;
    });

    // 선+영역 대신 막대 그래프 — 최근 달만 브랜드색으로 강조하고 나머지는 연한 톤.
    const baseY = padT + ih;
    const bars = raw.map((d, i) => {
      const bx = barX(i);
      const by = y(vals[i]);
      const bh = Math.max(0, baseY - by);
      const isCur = i === lastIdx;
      return `<rect id="volBar${i}" data-cur="${isCur ? "1" : "0"}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${isCur ? BAR_CUR : BAR_BASE}"></rect>`;
    }).join("");

    // 빈 달(0으로 채운 자리)은 최고/최저 후보에서 제외 — 안 그러면 수집 안 된 달이 항상
    // "최저"로 잡혀서 실제 데이터의 최저값이 아니라 빈 자리를 가리키게 된다.
    let maxI = -1, minI = -1;
    vals.forEach((v, i) => {
      if (raw[i].missing) return;
      if (maxI === -1 || v > vals[maxI]) maxI = i;
      if (minI === -1 || v < vals[minI]) minI = i;
    });
    const clampX = (v) => Math.min(Math.max(v, padL + 40), W - padR - 40);
    let marks = "";
    if (maxI !== -1) {
      marks += `<text x="${clampX(barCenterX(maxI)).toFixed(1)}" y="${Math.max(y(vals[maxI]) - 8, 12).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#1d2433">최고 ${raw[maxI].month.slice(2)} · ${fmt(vals[maxI])}</text>`;
    }
    if (minI !== -1 && minI !== maxI) {
      marks += `<text x="${clampX(barCenterX(minI)).toFixed(1)}" y="${Math.max(y(vals[minI]) - 8, 12).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#667085">최저 ${raw[minI].month.slice(2)} · ${fmt(vals[minI])}</text>`;
    }

    return `<div class="vol-chart-wrap">
      <svg id="volSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${grid}${axisLabels}
        ${bars}
        ${marks}
      </svg>
      <div class="vol-tip" id="volTip" style="display:none;"></div>
    </div>`;
  }

  function bindTrendChart(shadow, rows) {
    const g = trendChartGeometry(rows);
    const svg = shadow.querySelector("#volSvg");
    if (!g || !svg) return;
    const { raw, vals, W, x, barCenterX } = g;
    const tip = shadow.querySelector("#volTip");
    let hoveredI = -1;
    function resetBar(i) {
      if (i < 0) return;
      const bar = shadow.querySelector(`#volBar${i}`);
      if (bar) bar.setAttribute("fill", bar.dataset.cur === "1" ? BAR_CUR : BAR_BASE);
    }
    svg.addEventListener("mousemove", (e) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      let best = 0, bestDist = Infinity;
      raw.forEach((_, i) => {
        const d = Math.abs(x(i) - svgX);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best !== hoveredI) {
        resetBar(hoveredI);
        const bar = shadow.querySelector(`#volBar${best}`);
        if (bar && bar.dataset.cur !== "1") bar.setAttribute("fill", BAR_HOVER);
        hoveredI = best;
      }
      tip.textContent = raw[best].missing
        ? `${raw[best].month} · 데이터 없음`
        : `${raw[best].month} · ${fmt(vals[best])}회`;
      tip.style.display = "block";
      const leftPx = (barCenterX(best) / W) * rect.width;
      tip.style.left = `${Math.min(Math.max(leftPx, 50), rect.width - 50)}px`;
    });
    svg.addEventListener("mouseleave", () => {
      resetBar(hoveredI);
      hoveredI = -1;
      tip.style.display = "none";
    });
  }

  // 아이템스카우트 확장프로그램 패널 디자인을 참고해서 레이아웃을 통째로 바꿨다(2026-08-07,
  // "좀더 깔끔하고 직관적이게" 요청). 원래는 그래프를 왼쪽 넓게, 통계를 오른쪽 두 칸으로
  // 나눠 뒀는데, 참고 이미지처럼 통계를 왼쪽에 작은 카드 여러 개로 압축하고 그래프를
  // 오른쪽 넓게 배치하는 구조로 뒤집었다. 매출액·클릭량·쿠팡지표처럼 우리가 못 얻는
  // 데이터는 흉내내지 않고, 우리가 실제로 가진 값만 같은 톤으로 정리했다.
  // 검색어 데이터 카드 하나로 통합(2026-08-07, "검색어 데이터 카드 | 노출순위 카드 | 그래프
  // 일렬로 배치해달라"는 요청) — 기본정보/경쟁강도·추세 배지/시장통계를 따로따로 상자 3개로
  // 쌓지 않고 박스 하나 안에 구분선으로만 나눈다.
  function searchDataCardHtml(ad, page, trendMonth) {
    const pcPct = ad?.monthlyTotal > 0 ? Math.round((ad.monthlyPc / ad.monthlyTotal) * 100) : null;
    const moPct = pcPct != null ? 100 - pcPct : null;
    const grade = page ? scoreGrade(page.score) : null;
    const ratioHint = page ? ratioHintText(page.ratio) : "";
    const trendGrade = trendMonth.cls === "up" ? { text: "상승", cls: "good" }
      : trendMonth.cls === "down" ? { text: "하락", cls: "bad" }
      : { text: "유지", cls: "mid" };
    const priceRow = page?.priceRange
      ? `<div class="side-box-row"><span>시장 가격대</span><b>${fmt(page.priceRange.min)}~${fmt(page.priceRange.max)}원</b></div>`
      : "";
    const purchaseRow = page?.avgPurchase != null
      ? `<div class="side-box-row"><span>평균 구매수</span><b>${fmt(page.avgPurchase)}개</b></div>`
      : "";
    const reviewRow = page?.avgReview != null
      ? `<div class="side-box-row"><span>평균 리뷰수</span><b>${fmt(page.avgReview)}개</b></div>`
      : "";
    const myRankRow = page
      ? `<div class="side-box-row"><span>내 스토어 순위</span><b style="${page.myBestRank != null ? "color:#e85d2f" : ""}">${page.myBestRank != null ? page.myBestRank + "위" : "미노출"}</b></div>`
      : "";
    return `
      <div class="side-box">
        <div class="side-box-row"><span>등록 상품수</span><b>${page ? fmt(page.productCount) + "개" : "-"}</b></div>
        <div class="side-box-row"><span>월간 검색수</span><b>${ad ? fmt(ad.monthlyTotal) + "회" : "-"}</b></div>
        ${pcPct != null ? `<div class="side-box-row"><span>검색 비율</span><b>PC ${pcPct}% · 모바일 ${moPct}%</b></div>` : ""}
        <div class="badge-grid">
          <div class="badge-tile" title="${ratioHint}">
            <div class="badge-tile-label">경쟁강도</div>
            ${grade ? `<span class="grade ${grade.cls}">${grade.text}</span>` : `<span class="badge-tile-value">-</span>`}
          </div>
          <div class="badge-tile" title="${trendMonth.text}">
            <div class="badge-tile-label">검색량 추세</div>
            <span class="grade ${trendGrade.cls}">${trendGrade.text}</span>
          </div>
        </div>
        ${priceRow}
        ${purchaseRow}
        ${reviewRow}
        ${myRankRow}
      </div>`;
  }

  // 별도 탭이었던 "노출순위"를 검색량 탭 안 세 번째 컬럼으로 옮겼다 — 다른 두 사이드박스와
  // 같은 카드 스타일로 통일. 제목을 "노출 점유율"로, 10위까지로 조정(2026-08-07).
  function sellersHtml(sellers) {
    const body = !sellers || !sellers.length
      ? `<div class="empty">판매자 데이터가 없습니다.</div>`
      : `
        <div class="sellers">
          ${sellers.slice(0, 10).map((s, i) => `
            <div class="seller-row${isOwnStore(s.mall) ? " mine" : ""}">
              <span class="seller-rank">${i + 1}</span>
              <span class="seller-name">${s.mall}${isOwnStore(s.mall) ? " ★" : ""}</span>
              <span class="seller-share">${s.share.toFixed(1)}%</span>
              <span class="seller-bar-wrap"><span class="seller-bar" style="width:${s.share}%"></span></span>
            </div>`).join("")}
        </div>`;
    return `<div class="side-box"><div class="side-box-title">노출 점유율</div>${body}</div>`;
  }

  // rank-tracker.html의 "키워드 랭킹 | 아이템 추적" 탭(app-title-tab)과 같은 스타일 —
  // 라벨 굵게 + 활성 탭 밑줄. 패널 폭에 맞춰 크기만 살짝 줄였다.
  const ENERGUARD_LAB_URL = "https://enorangekid.github.io/energuard-lab/";

  function tabRowHtml(keyword) {
    // naver-rank.html은 ?keyword= 쿼리로 들어오면 그 키워드를 자동으로 검색창에 채우고 바로
    // 분석까지 실행해준다(기존 "분석 내역 복원" 기능과 같은 진입점) — 지금 보고 있는 키워드를
    // 그대로 넘겨서 클릭 한 번으로 에너가드랩에서 이어서 볼 수 있게 한다.
    const analysisUrl = `${ENERGUARD_LAB_URL}naver-rank.html?keyword=${encodeURIComponent(keyword || "")}`;
    return `<div class="tab-row">
      <div class="tab-group">
        <button type="button" class="tab-btn${activeTab === "analysis" ? " active" : ""}" data-tab="analysis">키워드분석</button>
        <button type="button" class="tab-btn${activeTab === "related" ? " active" : ""}" data-tab="related">연관키워드</button>
      </div>
      <div class="tab-links">
        <a class="tab-link primary" href="${analysisUrl}" target="_blank" rel="noopener">"${keyword}" 키워드 분석 확인하기</a>
        <a class="tab-link" href="${ENERGUARD_LAB_URL}rank-tracker.html" target="_blank" rel="noopener">상품 순위 추적하기</a>
        <a class="tab-link" href="${ENERGUARD_LAB_URL}item-discovery.html" target="_blank" rel="noopener">키워드 발굴하기</a>
      </div>
    </div>`;
  }

  function bindTabs(shadow) {
    shadow.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        shadow.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        shadow.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.tab !== activeTab));
      });
    });
  }

  // sales-analysis.html의 top3ListHtml(요약분석 "TOP3" 미니카드)을 그대로 이식 — 원형 순위
  // 배지, 한 줄 행(구분선은 border-bottom), 값/비중 두 줄 스택, "○○ 더보기 +" 토글까지 클래스명만
  // 바꿔서 동일하게 맞췄다(2026-08-07, "기존 에너가드랩 페이지랑 스타일이 조금 다르다"는 지적으로
  // sales-analysis.html 원본 코드를 직접 확인해서 재작업 — 막대그래프는 원본에 없던 걸 착각해서
  // 넣었던 것이라 제거).
  // "더보기" 버튼으로 목록을 펼치는 방식은 펼칠 때마다 카드가 늘어나거나(초기 버전) 늘어난
  // 것처럼 보이는(overflow 삐져나옴) 문제가 계속 반복됐다(2026-08-07) — 애초에 상태가 바뀌는
  // 게 문제의 근원이라, 더보기/접기 자체를 없앴다. 목록을 처음부터 고정 높이 스크롤 영역으로
  // 만들어서 항목 개수와 무관하게 카드 높이가 항상 똑같다(상태 전환이 없으니 깨질 여지도 없다).
  function rankCardHtml(title, items, { emptyText = "데이터가 없습니다.", showShare = true } = {}) {
    if (!items.length) {
      return `<div class="related-card"><div class="related-card-title">${title}</div><div class="empty">${emptyText}</div></div>`;
    }
    const rows = items.map((item, i) => `
      <div class="related-rank-row">
        <span class="related-rank-num">${i + 1}</span>
        <span class="related-rank-name">${item.label}</span>
        <span class="related-rank-value">
          ${item.valueText}
          <span class="related-rank-share">${showShare && item.share != null ? `비중 ${item.share.toFixed(1)}%` : "&nbsp;"}</span>
        </span>
      </div>`).join("");
    return `<div class="related-card">
      <div class="related-card-title">${title}</div>
      <div class="related-rank-list">${rows}</div>
    </div>`;
  }

  // 카드마다 "전체 대비 비중"을 낼 기준 모수가 없어서(예: 연관키워드 검색량은 절대적 규모라
  // 항목마다 자릿수가 천차만별), 실제로 화면에 보여줄 상위 N개(20개)의 합을 기준 삼아
  // 상대 비중으로 근사한다 — item-discovery.html류 지표 랭킹 카드와 같은 방식. value가 null인
  // 항목은 합계에서 0으로 취급되고 화면엔 "-"로 표시된다.
  function shareItems(entries, limit = 20) {
    const top = entries.slice(0, limit);
    const sum = top.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 1;
    return top.map(([label, value]) => ({
      label,
      valueText: value != null ? `${fmt(value)}회` : "-",
      share: value != null ? (Number(value) / sum * 100) : null,
    }));
  }

  const normalizeKw = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

  // "키워드분석" 탭의 headline+category-line("지난해에 비해 검색량이 X% 증가했어요" / "주요
  // 카테고리 ...")처럼, 연관키워드 탭도 데이터를 그냥 나열만 하지 않고 맨 위에서 바로 쓸 수 있는
  // 결론 한 줄을 먼저 준다 — 가장 검색량 높은 연관키워드와 가장 많이 쓰인 해시태그를 골라
  // "이거 넣어보세요" 식으로 제안한다(2026-08-07, "핵심 부분을 헤드에서 설명해주니 확 와닿는데
  // 연관키워드 쪽도 그런 게 없을까"라는 요청으로 추가).
  // 키워드 제안은 원래 에너가드랩(검색광고 API) 연관키워드 1위를 썼는데, 정확도가 떨어진다는
  // 지적으로 네이버 자체 연관검색어(nativeChips) 1위로 바꿨다 — 그마저 없을 때만 에너가드랩
  // 데이터로 폴백한다(2026-08-07).
  // 해시태그 제안에서 뺄 것들 — 검색한 키워드 자체("아이소핑크" 검색했는데 "#아이소핑크"를
  // 넣어보라는 건 이미 하고 있는 걸 다시 하라는 순환 제안이라 의미가 없고, "단열재"는 이
  // 카테고리 상품 대부분에 이미 붙어있는 너무 흔한 태그라 제안으로서 가치가 낮다(2026-08-07).
  const HEADLINE_TAG_EXCLUDE = new Set(["단열재"]);
  // 매번 1위만 보여주면 재미없다는 지적(2026-08-07) — 상위권(최대 5개) 안에서 랜덤으로 골라서
  // 새로고침/재방문할 때마다 다른 제안이 나오게 한다. 1위 후보군으로 좁혀놓은 뒤 뽑는 거라
  // 순위가 한참 밀린 이상한 후보가 나올 걱정은 없다.
  const pickRandomTop = (arr, n = 5) => {
    const top = arr.slice(0, n);
    return top.length ? top[Math.floor(Math.random() * top.length)] : undefined;
  };

  function relatedHeadlineHtml(keyword, nativeChips, related, topTags) {
    const kwPool = nativeChips.length ? nativeChips : related.map((r) => r.keyword);
    const topKw = pickRandomTop(kwPool);
    const seedNorm = normalizeKw(keyword);
    const tagPool = topTags
      .filter(([tag]) => normalizeKw(tag) !== seedNorm && !HEADLINE_TAG_EXCLUDE.has(tag))
      .map(([tag]) => tag);
    const topTag = pickRandomTop(tagPool);
    if (!topKw && !topTag) return "";
    const suggestions = [];
    if (topKw) suggestions.push(`<b class="hl-kw">${topKw}</b> 키워드를 넣어보세요`);
    if (topTag) suggestions.push(`<b class="hl-tag">#${topTag}</b> 해시태그는 어떨까요`);
    return `<p class="headline">${suggestions.join(", ")}?</p>
      <p class="category-line">에너가드랩·네이버가 제공하는 연관 데이터 기준입니다</p>`;
  }

  function relatedCardsHtml(related, nativeChips, topTags) {
    const oursItems = shareItems(related.map((r) => [r.keyword, r.total]));
    const hashtagItems = shareItems(topTags);
    // 네이버 연관검색어 자체엔 검색량이 없다 — 이미 받아온 검색광고 API 연관키워드 목록(related,
    // 최대 300개)과 이름을 대조해서, 겹치는 게 있으면 그 검색량을 그대로 가져다 쓴다(추가 API
    // 호출 없음). 전부 안 겹치면 그냥 "-"로 남는다(2026-08-07, "네이버쪽도 검색량을 뽑을 수
    // 없을까"라는 요청으로 추가 — 100% 커버는 안 되지만 공짜라 시도할 가치가 있음).
    const volByKw = new Map(related.map((r) => [normalizeKw(r.keyword), r.total]));
    const nativeItems = shareItems(nativeChips.map((c) => [c, volByKw.get(normalizeKw(c)) ?? null]));
    // 검색량이 절대값 자체로 이미 의미가 있어서(예: "월 9,700회"), 상위 20개 안에서의 상대
    // 비중까지 같이 보여줄 필요는 없다고 판단 — 해시태그만 절대값(횟수) 자체는 의미가 약해서
    // 비중을 유지한다(2026-08-07, "에너가드랩/네이버에 비중이 꼭 필요하냐"는 지적으로 결정).
    return `<div class="related-card-grid">
      ${rankCardHtml("에너가드랩", oursItems, { emptyText: "연관 키워드 데이터가 없습니다.", showShare: false })}
      ${rankCardHtml("네이버", nativeItems, { emptyText: "네이버 연관검색어를 찾지 못했습니다.", showShare: false })}
      ${rankCardHtml("해시태그", hashtagItems, { emptyText: "수집된 태그가 없습니다." })}
    </div>`;
  }

  // 삽입 위치를 찾으면 인라인 카드로, 못 찾으면 고정 카드로.
  function ensureHost() {
    document.getElementById(HOST_ID)?.remove();
    const host = document.createElement("div");
    host.id = HOST_ID;
    const insertionPoint = findInsertionPoint();
    let floating = false;
    if (insertionPoint && insertionPoint.parentElement) {
      insertionPoint.insertAdjacentElement("afterend", host);
    } else {
      host.style.cssText = "position:fixed;right:22px;top:90px;z-index:2147483646;";
      document.documentElement.appendChild(host);
      floating = true;
    }
    return { shadow: host.attachShadow({ mode: "open" }), floating };
  }

  const BRAND_ICON_URL = chrome.runtime.getURL("icon.png");

  // 헤더(로고+접기 버튼)는 로딩/완료 화면 공통. 접기 버튼은 카드를 지우지 않고 본문만
  // 숨긴다 — 상태는 collapsed 변수에 저장해서 재렌더링(캐시 도착, 늦은 상품 로딩 등) 때도 유지된다.
  function headHtml() {
    return `<div class="head">
      <span class="brand-logo"><img class="brand-icon" src="${BRAND_ICON_URL}" alt=""><span>ENERGUARD</span><span>LAB</span></span>
      <button class="collapse-btn" title="접기/펼치기" aria-label="접기/펼치기">${COLLAPSE_ICON}</button>
    </div>`;
  }

  function bindHead(shadow) {
    shadow.querySelector(".collapse-btn").addEventListener("click", () => {
      collapsed = !collapsed;
      shadow.querySelector(".card").classList.toggle("collapsed", collapsed);
      shadow.querySelector(".card-body").classList.toggle("hidden", collapsed);
    });
  }

  function renderLoading(keyword) {
    const { shadow, floating } = ensureHost();
    shadow.innerHTML = `<style>${CARD_STYLE}</style>
      <div class="card${floating ? " floating" : ""}${collapsed ? " collapsed" : ""}">
        ${headHtml()}
        <div class="card-body${collapsed ? " hidden" : ""}">
          <p class="kw">"${keyword}" 분석 중...</p>
        </div>
      </div>`;
    bindHead(shadow);
  }

  function render(keyword, data) {
    const { shadow, floating } = ensureHost();
    const ad = data?.insight?.ad;
    const trendRows = data?.trendRows || [];
    const trendMonth = trendText(trendPair(trendRows, 1));
    const trendYear = trendPair(trendRows, 12);
    const related = (ad?.related || []).filter((r) => r.keyword);
    const nativeChips = readNativeRelatedChips();
    const page = buildPageInsight(ad?.monthlyTotal ?? null);
    const topTags = page?.topTags || [];

    shadow.innerHTML = `<style>${CARD_STYLE}</style>
      <div class="card${floating ? " floating" : ""}${collapsed ? " collapsed" : ""}">
        ${headHtml()}
        <div class="card-body${collapsed ? " hidden" : ""}">
          ${tabRowHtml(keyword)}
          <hr class="tab-divider">
          <div class="tab-panels-stack">
            <div class="tab-panel${activeTab === "analysis" ? "" : " hidden"}" data-tab="analysis">
              ${headlineHtml(trendYear)}
              ${categoryLineHtml(page?.topCategory)}
              ${ad ? `
                <div class="vol-layout">
                  <div class="vol-side-col">${searchDataCardHtml(ad, page, trendMonth)}</div>
                  <div class="vol-side-col">${sellersHtml(page?.sellers)}</div>
                  <div class="vol-chart-col"><div class="side-box vol-chart-box">${trendChartHtml(trendRows)}</div></div>
                </div>
              ` : `<div class="empty">검색량 데이터를 불러오지 못했습니다.</div>`}
            </div>
            <div class="tab-panel${activeTab === "related" ? "" : " hidden"}" data-tab="related">
              ${relatedHeadlineHtml(keyword, nativeChips, related, topTags)}
              ${relatedCardsHtml(related, nativeChips, topTags)}
            </div>
          </div>
        </div>
      </div>`;
    bindHead(shadow);
    bindTabs(shadow);
    bindTrendChart(shadow, trendRows);
  }

  let collapsed = false; // 접기 상태 — 재렌더링(캐시 도착, 늦은 상품 로딩 등) 때도 유지된다
  let activeTab = "analysis"; // "analysis" | "related" — 재렌더링 때도 유지된다
  async function run() {
    const keyword = currentQuery();
    document.getElementById(HOST_ID)?.remove();
    if (!keyword) return;

    const cacheKey = CACHE_PREFIX + keyword;
    let data = null; // null = 아직 못 받음(로딩), false = 조회 실패
    try {
      const cached = await chrome.storage.local.get(cacheKey);
      const hit = cached?.[cacheKey];
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) data = hit.data;
    } catch (_) {
      // 캐시 조회 실패는 무시하고 새로 받는다
    }

    // 배치(인라인/고정)만 바뀔 때가 아니라, 같은 배치라도 __NEXT_DATA__에 상품이 늦게 채워지면
    // (경쟁지수/판매자 순위 계산 대상이 처음엔 비어있다가 뒤늦게 채워지는 경우) 다시 그려야
    // 하므로, 배치 상태 + 지금 로딩된 일반상품 개수 + 데이터 도착 여부를 합친 지문으로 비교한다.
    let lastFingerprint = "";
    function repaint() {
      const inline = !!findInsertionPoint();
      const organicCount = readPageProducts().products.filter((p) => !p.isAd).length;
      const dataState = data ? "data" : data === false ? "fail" : "loading";
      const fingerprint = `${inline}:${organicCount}:${dataState}`;
      if (fingerprint === lastFingerprint) return; // 실질적으로 달라진 게 없으면 다시 안 그림
      lastFingerprint = fingerprint;
      if (data) render(keyword, data);
      else if (data === false) render(keyword, null);
      else renderLoading(keyword);
    }
    repaint();

    if (data === null) {
      chrome.runtime.sendMessage({ type: "FETCH_KEYWORD_INSIGHT", keyword }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          data = false;
        } else {
          data = res;
          chrome.storage.local.set({ [cacheKey]: { data: res, at: Date.now() } }).catch(() => {});
        }
        repaint();
      });
    }

    // 상품 카드/필터박스가 늦게 뜨는 경우를 대비해 잠깐 동안만 감시하다가, 인라인 자리가 새로
    // 생기거나(또는 __NEXT_DATA__가 갱신돼 페이지분석 값이 채워지면) 다시 그린다.
    let debounce = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(repaint, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); clearTimeout(debounce); }, OBSERVE_MS);
  }

  run();
})();
