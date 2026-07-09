/* ─────────────────────────────────────────
   인기 쇼핑 키워드 위젯 (데이터랩 쇼핑인사이트)
   naver-rank.html · index.html 공용.
   포함하는 페이지에서 전역 SUPABASE_URL, SUPABASE_ANON_KEY 를
   미리 정의해두어야 합니다.
   ───────────────────────────────────────── */
const TREND_FN_URL = SUPABASE_URL + "/functions/v1/shopping-trend";
let trCat = "생활/건강";
let trUnit = "date";
const trCache = {};

function trToggle() {
  const w = document.getElementById("trendWidget");
  if (w) w.classList.toggle("open");
}
function trCollapse() {
  const w = document.getElementById("trendWidget");
  if (w) w.classList.remove("open");
}
function trSetCat(btn) {
  trCat = btn.dataset.cat;
  document.querySelectorAll(".tr-cat").forEach(b => b.classList.toggle("active", b === btn));
  trLoad();
}
function trSetUnit(btn) {
  trUnit = btn.dataset.unit;
  document.querySelectorAll(".tr-unit").forEach(b => b.classList.toggle("active", b === btn));
  trLoad();
}

async function trLoad() {
  const content = document.getElementById("trContent");
  if (!content) return;
  const key = trCat + "|" + trUnit;
  if (trCache[key]) { trRender(trCache[key]); return; }
  content.innerHTML = '<div class="tr-status">불러오는 중...</div>';
  try {
    const res = await fetch(TREND_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ category: trCat, timeUnit: trUnit, count: 20 }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || ("HTTP " + res.status));
    trCache[key] = data;
    trRender(data);
  } catch (e) {
    content.innerHTML = `<div class="tr-status">인기 키워드를 불러오지 못했습니다: ${trEsc(e.message || "오류")}</div>`;
  }
}

function trRender(d) {
  const meta = document.getElementById("trMeta");
  if (meta) {
    meta.textContent = `${d.category} · ${d.period.start === d.period.end ? d.period.start : d.period.start + " ~ " + d.period.end}`;
  }
  // naver-rank.html에서는 클릭 시 바로 분석 실행, index.html에서는 랭킹추적 페이지로 이동
  const goto = typeof runSearch === "function"
    ? (kw) => `runSearch('${trEsc(kw)}')`
    : (kw) => `location.href='naver-rank.html?keyword=${encodeURIComponent(kw)}'`;

  document.getElementById("trContent").innerHTML =
    '<div class="tr-list">' + d.keywords.map(k => {
      let chg;
      if (k.change === "up")        chg = `<span class="tr-chg up">▲${k.delta}</span>`;
      else if (k.change === "down") chg = `<span class="tr-chg down">▼${Math.abs(k.delta)}</span>`;
      else if (k.change === "new")  chg = `<span class="tr-chg new">NEW</span>`;
      else                          chg = `<span class="tr-chg same">-</span>`;
      return `<div class="tr-row">
        <span class="tr-rank">${k.rank}</span>
        <span class="tr-kw" onclick="${goto(k.keyword)}">${trEsc(k.keyword)}</span>
        ${chg}
      </div>`;
    }).join("") + "</div>";

  // 페이지에서 카테고리별 트렌드 키워드를 다른 위젯에도 활용할 수 있도록 훅 제공
  if (typeof onTrendKeywords === "function") onTrendKeywords(d);
}

function trEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", trLoad);
