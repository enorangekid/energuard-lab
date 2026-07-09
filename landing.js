/* ─────────────────────────────────────────
   ENERGUARD LAB — 메인 홈 화면 전용 스크립트
   (키워드 Best는 trend-widget.js 가 실데이터로 채워줍니다)
   ───────────────────────────────────────── */

/* TOP 노출 상품 — naver-rank 엣지펑션 배치 모드 재사용.
   [로딩 UX 원칙]
   1) 키워드 조합별 결과를 메모리 캐시 → 방문했던 탭은 재요청 없이 즉시 렌더
   2) 이미 카드가 떠 있으면 지우지 않고 흐리게(is-loading)만 표시 후 도착 시 교체
      → innerHTML을 로딩 문구로 갈아끼우며 생기던 높이 붕괴(출렁임) 제거
   3) 최초 진입에만 카드와 동일 크기의 스켈레톤을 그려 높이를 선확보 */
const FN_URL = SUPABASE_URL + "/functions/v1/naver-rank";
const FALLBACK_TOP_KEYWORDS = ["비데", "안마의자", "금고", "멀티탭", "텀블러", "빨래건조대", "차량용방향제", "스타벅스텀블러"];
let topGridToken = 0;
const topCache = {};        // { "kw1|kw2|...": results }
let lastKeywordsKey = null; // 현재 그리드에 렌더된 키워드 조합
const TOP_CARD_COUNT = 6;
const TOP_CANDIDATE_COUNT = 20;
let fallbackTopResults = null;

async function fetchTopProducts(keywords) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ keywords }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data.results || [];
}

function salesCard({ keyword, product }) {
  const thumb = product.image
    ? `<img src="${lsEsc(product.image)}" loading="lazy" alt="" onload="this.classList.add('is-loaded')">`
    : lsEsc(keyword);
  return `
    <a class="sales-card" href="${lsEsc(product.link)}" target="_blank" rel="noopener">
      <div class="sales-thumb">${thumb}</div>
      <div class="sales-body">
        <span class="sales-badge">${lsEsc(keyword)} 1위</span>
        <div class="sales-title">${lsEsc(product.title)}</div>
        <div class="sales-sub">${lsEsc(product.mall)} · ${product.price ? product.price.toLocaleString() + "원" : ""}</div>
      </div>
    </a>`;
}

function normalizeTopResults(keywords, results) {
  const byKeyword = new Map();
  (results || []).forEach(item => {
    if (item && item.keyword) byKeyword.set(item.keyword, item);
  });
  return keywords.map(keyword =>
    byKeyword.get(keyword) || { keyword, product: null }
  );
}

function pickDisplayResults(results) {
  const seen = new Set();
  return results.filter(item => {
    if (!item || !item.product) return false;
    const id = item.product.link || item.product.title || item.keyword;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, TOP_CARD_COUNT);
}

function hasLoadedCard(el) {
  return !!el.querySelector(".sales-card:not(.sales-card--skel)");
}

function hasAnyProduct(results) {
  return (results || []).some(item => item && item.product);
}

function holdGridHeight(el) {
  if (hasLoadedCard(el)) {
    el.style.setProperty("--sales-grid-height", `${Math.round(el.getBoundingClientRect().height)}px`);
  }
}

function releaseGridHeight(el) {
  requestAnimationFrame(() => el.style.removeProperty("--sales-grid-height"));
}

function renderSalesCards(el, results) {
  el.dataset.count = String(results.length);
  el.innerHTML = results.map(salesCard).join("");
}

async function getFallbackTopResults() {
  if (!fallbackTopResults) {
    fallbackTopResults = pickDisplayResults(normalizeTopResults(
      FALLBACK_TOP_KEYWORDS,
      await fetchTopProducts(FALLBACK_TOP_KEYWORDS)
    ));
  }
  return fallbackTopResults;
}

async function fillTopResults(results) {
  const productResults = pickDisplayResults(results);
  if (productResults.length >= TOP_CARD_COUNT) return productResults.slice(0, TOP_CARD_COUNT);

  const used = new Set(productResults.map(item => item.keyword + "|" + (item.product.link || item.product.title || "")));
  const fillers = (await getFallbackTopResults()).filter(item => {
    const id = item.keyword + "|" + (item.product.link || item.product.title || "");
    if (used.has(id)) return false;
    used.add(id);
    return true;
  });

  return productResults
    .concat(fillers)
    .slice(0, TOP_CARD_COUNT);
}

/* 실제 카드와 동일한 골격의 스켈레톤 → 첫 로드에도 그리드 높이가 유지됨 */
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

async function renderTopGrid(keywords) {
  const el = document.getElementById("salesGrid");
  if (!el || !keywords.length) return;
  const candidateKeywords = keywords.slice(0, TOP_CANDIDATE_COUNT);
  const key = candidateKeywords.join("|");

  /* 동일 키워드 조합이 이미 화면에 있으면 아무것도 안 함 */
  if (key === lastKeywordsKey) return;

  const token = ++topGridToken;

  /* 캐시 히트 → 네트워크 없이 즉시 교체 */
  if (topCache[key]) {
    lastKeywordsKey = key;
    el.classList.remove("is-loading");
    renderSalesCards(el, topCache[key]);
    releaseGridHeight(el);
    return;
  }

  /* 기존 카드가 있으면 유지한 채 흐림 처리, 없으면(최초) 스켈레톤 */
  if (hasLoadedCard(el)) {
    holdGridHeight(el);
    el.classList.add("is-loading");
  } else {
    el.innerHTML = skeletonCards(TOP_CARD_COUNT);
  }

  try {
    const results = await fillTopResults(pickDisplayResults(
      normalizeTopResults(candidateKeywords, await fetchTopProducts(candidateKeywords))
    ));
    if (token !== topGridToken) return; // 이후 탭 전환으로 무효화된 응답
    if (!hasAnyProduct(results)) {
      el.classList.remove("is-loading");
      releaseGridHeight(el);
      if (!hasLoadedCard(el)) {
        el.dataset.count = "0";
        el.innerHTML = `<div class="tr-status">TOP 노출 상품을 준비 중입니다.</div>`;
      }
      return;
    }
    topCache[key] = results;
    lastKeywordsKey = key;
    el.classList.remove("is-loading");
    renderSalesCards(el, results);
    releaseGridHeight(el);
  } catch (e) {
    if (token !== topGridToken) return;
    el.classList.remove("is-loading");
    releaseGridHeight(el);
    /* 기존 카드가 떠 있었다면 굳이 지우지 않고 그대로 둠 (조용한 실패) */
    if (!hasLoadedCard(el)) {
      el.dataset.count = "0";
      el.innerHTML = `<div class="tr-status">TOP 노출 상품을 불러오지 못했습니다: ${lsEsc(e.message || "오류")}</div>`;
    }
  }
}

/* 실제 트렌드 키워드가 도착하기 전에는 임의 키워드 상품을 먼저 보여주지 않는다. */
const initialSalesGrid = document.getElementById("salesGrid");
if (initialSalesGrid) {
  initialSalesGrid.innerHTML = skeletonCards(TOP_CARD_COUNT);
}

/* trend-widget.js가 카테고리별 트렌드 키워드를 새로 불러올 때마다 호출된다 */
function onTrendKeywords(d) {
  const keywords = (d.keywords || []).slice(0, TOP_CANDIDATE_COUNT).map(k => k.keyword).filter(Boolean);
  if (keywords.length) renderTopGrid(keywords);
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
