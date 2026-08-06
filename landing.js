/* ─────────────────────────────────────────
   ENERGUARD LAB — 메인 홈 화면 전용 스크립트
   (왼쪽 "키워드 Best"는 trend-widget.js 가 채웁니다)
   ───────────────────────────────────────── */

/* TOP 노출 상품 — 네이버 쇼핑 상품검색 API(openapi.naver.com/v1/search/shop.json) 종료로
   더 이상 키워드별 검색 결과를 못 가져와서, 네이버플러스스토어의 공개 BEST 상품 API
   (snxbest.naver.com, 엣지펑션 snxbest-product로 프록시)로 대체했다. "이 키워드의 1위 상품"이
   아니라 "이 카테고리에서 많이 본 상품"으로 개념이 바뀌었고, 카테고리·기간은 왼쪽 "키워드 Best"와
   같은 cat-tabs/trend-tabs(trCat/trUnit)를 그대로 공유한다. */
const SNXBEST_PRODUCT_FN_URL = SUPABASE_URL + "/functions/v1/snxbest-product";
const TOP_CARD_COUNT = 6;
const topCache = {};

async function loadTopProducts() {
  const el = document.getElementById("salesGrid");
  if (!el) return;
  const key = `${trCat}|${trUnit}`;
  if (topCache[key]) { renderSalesCards(el, topCache[key]); return; }

  if (!el.querySelector(".sales-card:not(.sales-card--skel)")) {
    el.innerHTML = skeletonCards(TOP_CARD_COUNT);
  } else {
    el.classList.add("is-loading");
  }

  try {
    const res = await fetch(SNXBEST_PRODUCT_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ category: trCat, timeUnit: trUnit, count: TOP_CARD_COUNT }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || ("HTTP " + res.status));
    topCache[key] = data.products || [];
    el.classList.remove("is-loading");
    renderSalesCards(el, topCache[key]);
  } catch (e) {
    el.classList.remove("is-loading");
    if (!el.querySelector(".sales-card:not(.sales-card--skel)")) {
      el.innerHTML = `<div class="tr-status">TOP 노출 상품을 불러오지 못했습니다: ${lsEsc(e.message || "오류")}</div>`;
    }
  }
}

function salesCard(p) {
  const thumb = p.image
    ? `<img src="${lsEsc(p.image)}" loading="lazy" alt="" onload="this.classList.add('is-loaded')">`
    : lsEsc(p.title);
  const sub = [p.mall, p.price ? Number(p.price).toLocaleString() + "원" : ""].filter(Boolean).join(" · ");
  return `
    <a class="sales-card" href="${lsEsc(p.link)}" target="_blank" rel="noopener">
      <div class="sales-thumb">${thumb}</div>
      <div class="sales-body">
        <span class="sales-badge">${p.rank}위</span>
        <div class="sales-title">${lsEsc(p.title)}</div>
        <div class="sales-sub">${lsEsc(sub)}</div>
        ${p.reviewScore ? `<div class="sales-review">★${lsEsc(p.reviewScore)} 리뷰 ${lsEsc(p.reviewCount || "0")}</div>` : ""}
      </div>
    </a>`;
}

function renderSalesCards(el, products) {
  if (!products.length) {
    el.innerHTML = `<div class="tr-status">TOP 노출 상품을 준비 중입니다.</div>`;
    el.dataset.count = "0";
    return;
  }
  el.dataset.count = String(products.length);
  el.innerHTML = products.map(salesCard).join("");
}

function skeletonCards(n) {
  return Array.from({ length: n }, () => `
    <div class="sales-card sales-card--skel">
      <div class="sales-thumb"></div>
      <div class="sales-body">
        <span class="skel skel-badge"></span>
        <div class="skel skel-line"></div>
        <div class="skel skel-line skel-line--short"></div>
      </div>
    </div>`).join("");
}

/* trend-widget.js가 카테고리·기간 탭 변경으로 왼쪽 목록을 새로 불러올 때마다
   이 위젯도 같은 카테고리·기간으로 다시 불러온다 */
function onTrendKeywords() {
  loadTopProducts();
}

function lsEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* 히어로 검색 → 랭킹추적(naver-rank.html) 페이지로 이동해 바로 분석 실행 */
const heroForm = document.getElementById("heroSearchForm");
if (heroForm) {
  heroForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const kw = document.getElementById("heroKeyword").value.trim();
    if (!kw) return;
    location.href = "naver-rank.html?keyword=" + encodeURIComponent(kw);
  });
}
