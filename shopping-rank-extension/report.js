const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const AUTH_KEY = "energuardSupabaseAuthSession";

const state = { rows: [], keyword: "" };
const number = new Intl.NumberFormat("ko-KR");
const money = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

async function getAuthenticatedHeaders(extra = {}) {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  let session = stored[AUTH_KEY] || null;
  if (!session?.accessToken) throw new Error("에너가드랩 로그인이 필요합니다.");

  const expiresSoon = Number(session.expiresAt || 0) <= Math.floor(Date.now() / 1000) + 60;
  if (expiresSoon) {
    if (!session.refreshToken) throw new Error("로그인 세션이 만료되었습니다. 에너가드랩에서 다시 로그인해 주세요.");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!response.ok) throw new Error("로그인 세션을 갱신하지 못했습니다. 에너가드랩에서 다시 로그인해 주세요.");
    const refreshed = await response.json();
    session = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || session.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600),
      userId: refreshed.user?.id || session.userId || "",
    };
    await chrome.storage.local.set({ [AUTH_KEY]: session });
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.accessToken}`,
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function frequency(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
}

function compact(value) {
  return String(value || "").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("ko-KR");
}

function displaySpecs(row) {
  const excluded = new Set([row.brand, row.maker].map(compact).filter(Boolean));
  const specs = Array.isArray(row.specs) ? row.specs : [];
  return specs.filter((value) => value && !excluded.has(compact(value))).join(" · ");
}

function formatRegistrationDate(value) {
  const source = String(value || "").trim();
  const digits = source.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  const date = new Date(source);
  if (!source || Number.isNaN(date.getTime())) return source || "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date).replace(/\s/g, "");
}

function currentRows() {
  return state.rows
    .filter((row) => row.keyword === state.keyword && !row.is_ad)
    .sort((a, b) => (Number(a.organic_rank) || 999999) - (Number(b.organic_rank) || 999999));
}

function renderMetrics(rows) {
  const keywordKey = compact(state.keyword);
  const titleMatches = rows.filter((row) => compact(row.product_name).includes(keywordKey)).length;
  const prices = rows.map((row) => Number(row.product_price)).filter((value) => value > 0);
  const averagePrice = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0;
  const metrics = [
    ["수집 상품", `${number.format(rows.length)}개`, ""],
    ["상품명 포함", `${number.format(titleMatches)}개`, "accent"],
    ["자사 상품", `${number.format(rows.filter((row) => row.is_target_store).length)}개`, "accent"],
    ["추적 상품", `${number.format(rows.filter((row) => row.is_tracked).length)}개`, ""],
    ["평균 판매가", averagePrice ? money.format(averagePrice) : "-", ""],
    ["수집 페이지", `${number.format(new Set(rows.map((row) => row.page_index)).size)}개`, ""],
  ];
  document.getElementById("metrics").innerHTML = metrics.map(([label, value, className]) => `
    <div class="metric"><span>${label}</span><strong class="${className}">${value}</strong></div>
  `).join("");
}

// 거의 모든 상품에 붙는 배송 배지라 "자주 등장한 태그"에서 의미 있는 신호를 가려버린다 —
// 검색 태그로서 가치가 없어 항상 제외한다(2026-08-07).
const NOISE_TAGS = new Set(["오늘출발", "오늘발송"]);
function usefulTags(tags) {
  return (Array.isArray(tags) ? tags : []).filter((tag) => !NOISE_TAGS.has(tag));
}

function renderInsights(rows) {
  const category = frequency(rows.map((row) => row.category_path))[0]?.[0] || "-";
  const malls = frequency(rows.map((row) => row.mall_name)).slice(0, 3);
  const tags = frequency(rows.flatMap((row) => usefulTags(row.tags))).slice(0, 10);
  document.getElementById("mainCategory").textContent = category;
  document.getElementById("topMalls").textContent = malls.length
    ? malls.map(([name, count]) => `${name} ${count}개`).join(" · ")
    : "-";
  document.getElementById("topTags").innerHTML = tags.length
    ? tags.map(([tag, count]) => `<span>#${escapeHtml(tag)} ${count}</span>`).join("")
    : '<span class="empty">수집된 태그가 없습니다.</span>';
}

function renderRows(rows) {
  const body = document.getElementById("reportRows");
  const empty = document.getElementById("emptyState");
  empty.hidden = rows.length > 0;
  body.innerHTML = rows.map((row) => {
    const tags = usefulTags(row.tags).slice(0, 7);
    const specs = displaySpecs(row);
    const image = row.product_image
      ? `<img class="thumb" src="${escapeHtml(row.product_image)}" alt="" loading="lazy">`
      : '<div class="thumb"></div>';
    return `
      <tr class="${row.is_target_store ? "target-row" : ""}">
        <td class="rank">${number.format(row.organic_rank || 0)}</td>
        <td>${image}</td>
        <td class="product-cell">
          <a class="product-link" href="${escapeHtml(row.product_link || "#")}" target="_blank" rel="noopener">${escapeHtml(row.product_name || "상품명 없음")}</a>
          <div class="product-flags">
            ${row.is_target_store ? '<span class="flag target">자사 상품</span>' : ""}
            ${row.is_tracked ? '<span class="flag tracked">추적 상품</span>' : ""}
          </div>
        </td>
        <td class="mall">${escapeHtml(row.mall_name || "-")}</td>
        <td class="specs">${escapeHtml(specs || "-")}</td>
        <td class="tags"><div class="tag-list">${tags.length ? tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("") : '<span class="empty">-</span>'}</div></td>
        <td class="money"><strong>${row.product_price ? money.format(row.product_price) : "-"}</strong></td>
        <td class="money">${row.shipping_fee ? money.format(row.shipping_fee) : "-"}</td>
        <td class="count">${number.format(row.purchase_count || 0)}</td>
        <td class="count">${number.format(row.review_count || 0)}</td>
        <td class="date-col">${escapeHtml(formatRegistrationDate(row.registration_date))}</td>
      </tr>`;
  }).join("");
}

/* ── 키워드 검색량·노출 분석 밴드 ──
   keyword-insight-panel.js(가격비교 페이지 패널)의 차트/키워드박스/노출순위 로직을 그대로
   이식했다. 다만 페이지 insight는 라이브 __NEXT_DATA__ 대신 이 실행에서 이미 수집해둔
   shopping_search_snapshots 행(rows)으로 계산한다 — is_target_store가 이미 계산돼 있어서
   패널의 이름 매칭(OWN_STORE_NAMES) 없이 바로 쓸 수 있고, 로딩된 페이지가 아니라 수집한
   전체 페이지 기준이라 오히려 더 정확하다(2026-08-07). */
const insightCache = new Map();
let insightRenderToken = 0;

function fmtInsight(n) {
  return n == null ? "-" : Number(n).toLocaleString();
}

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

function scoreGrade(score) {
  if (score == null) return null;
  if (score < 40) return { text: "좋음", cls: "good" };
  if (score < 70) return { text: "보통", cls: "mid" };
  return { text: "나쁨", cls: "bad" };
}

function fmtRatio(r) {
  if (r == null) return "-";
  if (r === 0) return "0 : 1";
  if (r >= 1) return (Math.round(r * 10) / 10) + " : 1";
  return "1 : " + (Math.round((1 / r) * 10) / 10);
}

function buildInsightPageStats(rows, monthlyTotal) {
  if (!rows.length) return null;
  const prices = rows.map((r) => Number(r.product_price)).filter((p) => p > 0);
  const priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
  const productCount = rows.length;
  const ratio = monthlyTotal > 0 ? productCount / monthlyTotal : null;
  const score = ratio != null ? compScore(ratio) : null;

  let myBestRank = null;
  const mallAgg = new Map();
  rows.forEach((r) => {
    const key = r.mall_name || `카탈로그:${r.product_code || r.naver_product_id || ""}`;
    const agg = mallAgg.get(key) || { mall: r.mall_name || "가격비교 상품", count: 0, mine: false, points: 0 };
    agg.count += 1;
    if (r.is_target_store) agg.mine = true;
    const rank = Number(r.organic_rank);
    // naver-rank.html의 "판매자 분석"과 같은 순위 가중 점수(influence)로 통일 — 단순 개수 비율은
    // 순위를 안 봐서 1위 상품 하나뿐인 판매자가 50위권 여러 개인 판매자보다 낮게 나오는 역전이
    // 있었다(2026-08-07, 같은 키워드인데 report.html과 naver-rank.html 노출순위가 서로 다르다는
    // 지적으로 발견 — 두 화면 기준을 naver-rank.html 쪽으로 통일).
    if (Number.isFinite(rank) && rank > 0) agg.points += rank <= 10 ? 100 / rank : 100 / (rank + 9);
    mallAgg.set(key, agg);
    if (r.is_target_store && Number.isFinite(rank) && (myBestRank == null || rank < myBestRank)) myBestRank = rank;
  });
  const totalPoints = [...mallAgg.values()].reduce((sum, s) => sum + s.points, 0) || 1;
  const sellers = [...mallAgg.values()]
    .map((s) => ({ ...s, share: totalPoints ? (s.points / totalPoints * 100) : 0 }))
    .sort((a, b) => b.share - a.share);

  return { priceRange, score, ratio, myBestRank, sellers, productCount };
}

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

function insightHeadlineHtml(trendYear) {
  if (trendYear == null) return "";
  if (Math.abs(trendYear) < 0.1) return `지난해와 검색량이 비슷해요.`;
  const cls = trendYear > 0 ? "up" : "down";
  const verb = trendYear > 0 ? "증가" : "감소";
  return `지난해에 비해 검색량이 <b class="${cls}">${Math.abs(trendYear).toFixed(1)}%</b> ${verb}했어요.`;
}

function insightCategoryLineHtml(topCategory) {
  if (!topCategory) return "";
  return `주요 카테고리 <b>${escapeHtml(topCategory)}</b>`;
}

function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) { if (v <= m * pow) return m * pow; }
  return 10 * pow;
}

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
  // 패널(keyword-insight-panel.js)은 W:H가 600:310(~1.94:1)인데, 그건 폭 600~700px 안팎의 좁은
  // 플로팅 카드 기준이다. report.html은 옆 사이드박스 폭(560px+간격)을 뺀 나머지가 차트 영역이라
  // 실제 렌더 폭이 900px 이상으로 훨씬 넓어서, 같은 비율을 그대로 쓰면 세로만 따라 늘어나
  // 옆 사이드박스보다 훨씬 커지고 카드 아래에 빈 여백이 크게 남았다(2026-08-07 실측 확인).
  // 넓은 레이아웃에 맞게 가로세로 비율을 더 납작하게(약 3.2:1) 잡는다.
  const W = 600, H = 190, padL = 42, padR = 34, padT = 18, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = raw.map((d) => d.total);
  const yMax = niceCeil(Math.max(...vals, 1));
  const y = (v) => padT + ih - (v / yMax) * ih;
  const barW = Math.min(44, Math.max(2, iw / raw.length * 0.55));
  const usableL = padL + barW / 2, usableR = W - padR - barW / 2;
  const x = (i) => raw.length > 1 ? usableL + (i * (usableR - usableL)) / (raw.length - 1) : (usableL + usableR) / 2;
  const barX = (i) => x(i) - barW / 2;
  const barCenterX = (i) => x(i);
  return { raw, vals, W, H, padL, padR, padT, padB, iw, ih, yMax, x, y, barW, barX, barCenterX };
}

const BAR_BASE = "#f6d3c2";
const BAR_CUR = "#e85d2f";
const BAR_HOVER = "#f0a67d";

function trendChartHtml(rows) {
  const g = trendChartGeometry(rows);
  if (!g) return `<div class="empty">검색량 스냅샷이 부족합니다.</div>`;
  const { raw, vals, W, H, padL, padR, padT, ih, yMax, y, barW, barX, barCenterX } = g;

  let grid = "", axisLabels = "";
  for (let s = 0; s <= 4; s++) {
    const v = (yMax * s) / 4, yy = y(v);
    grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#eef0f3" stroke-width="1"></line>`;
    axisLabels += `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#98a2b3">${Math.round(v).toLocaleString()}</text>`;
  }
  const step = Math.max(1, Math.ceil(raw.length / 6));
  const lastIdx = raw.length - 1;
  raw.forEach((d, i) => {
    const isRegular = i % step === 0;
    const isLast = i === lastIdx;
    if (!isRegular && !isLast) return;
    if (isRegular && !isLast && lastIdx - i < step * 0.6) return;
    axisLabels += `<text x="${barCenterX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#98a2b3">${d.month.slice(2)}</text>`;
  });

  const baseY = padT + ih;
  const bars = raw.map((d, i) => {
    const bx = barX(i);
    const by = y(vals[i]);
    const bh = Math.max(0, baseY - by);
    const isCur = i === lastIdx;
    return `<rect id="volBar${i}" data-cur="${isCur ? "1" : "0"}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${isCur ? BAR_CUR : BAR_BASE}"></rect>`;
  }).join("");

  let maxI = -1, minI = -1;
  vals.forEach((v, i) => {
    if (raw[i].missing) return;
    if (maxI === -1 || v > vals[maxI]) maxI = i;
    if (minI === -1 || v < vals[minI]) minI = i;
  });
  const clampX = (v) => Math.min(Math.max(v, padL + 40), W - padR - 40);
  let marks = "";
  if (maxI !== -1) {
    marks += `<text x="${clampX(barCenterX(maxI)).toFixed(1)}" y="${Math.max(y(vals[maxI]) - 8, 12).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#1d2433">최고 ${raw[maxI].month.slice(2)} · ${fmtInsight(vals[maxI])}</text>`;
  }
  if (minI !== -1 && minI !== maxI) {
    marks += `<text x="${clampX(barCenterX(minI)).toFixed(1)}" y="${Math.max(y(vals[minI]) - 8, 12).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#667085">최저 ${raw[minI].month.slice(2)} · ${fmtInsight(vals[minI])}</text>`;
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

function bindTrendChart(rows) {
  const g = trendChartGeometry(rows);
  const svg = document.getElementById("volSvg");
  if (!g || !svg) return;
  const { raw, vals, W, x, barCenterX } = g;
  const tip = document.getElementById("volTip");
  let hoveredI = -1;
  function resetBar(i) {
    if (i < 0) return;
    const bar = document.getElementById(`volBar${i}`);
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
      const bar = document.getElementById(`volBar${best}`);
      if (bar && bar.dataset.cur !== "1") bar.setAttribute("fill", BAR_HOVER);
      hoveredI = best;
    }
    tip.textContent = raw[best].missing
      ? `${raw[best].month} · 데이터 없음`
      : `${raw[best].month} · ${fmtInsight(vals[best])}회`;
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

function deviceSplitHtml(ad) {
  if (!ad || !(ad.monthlyTotal > 0)) return "";
  const pcPct = Math.round((ad.monthlyPc / ad.monthlyTotal) * 100);
  const moPct = 100 - pcPct;
  return `
    <div class="side-box">
      <div class="side-box-title">노출 비중</div>
      <div class="split-track">
        <span class="split-seg mobile" style="width:${moPct}%"></span>
        <span class="split-seg pc" style="width:${pcPct}%"></span>
      </div>
      <div class="split-legend">
        <span>모바일 <b>${moPct}%</b></span>
        <span>PC <b>${pcPct}%</b></span>
      </div>
    </div>`;
}

function keywordSideBoxHtml(ad, page) {
  if (!ad) return "";
  const grade = page ? scoreGrade(page.score) : null;
  return `
    <div class="side-box">
      <div class="side-box-title">키워드${grade ? `<span class="grade ${grade.cls}">${grade.text}</span>` : ""}</div>
      <div class="side-box-row"><span>월 검색량</span><b>${fmtInsight(ad.monthlyTotal)}회</b></div>
      <div class="side-box-row"><span>경쟁강도</span><b>${page ? fmtRatio(page.ratio) : "-"}</b></div>
    </div>`;
}

function extraStatsBoxHtml(trendMonth, page) {
  const priceRow = page?.priceRange
    ? `<div class="side-box-row"><span>시장 가격대</span><b>${fmtInsight(page.priceRange.min)}~${fmtInsight(page.priceRange.max)}원</b></div>`
    : "";
  const myRankRow = page
    ? `<div class="side-box-row"><span>내 스토어 순위</span><b style="${page.myBestRank != null ? "color:var(--orange)" : ""}">${page.myBestRank != null ? page.myBestRank + "위" : "미노출"}</b></div>`
    : "";
  return `
    <div class="side-box">
      <div class="side-box-row"><span>검색량 추세(전월)</span><b class="${trendMonth.cls}">${trendMonth.text}</b></div>
      ${priceRow}
      ${myRankRow}
    </div>`;
}

function sellersHtml(sellers) {
  const body = !sellers || !sellers.length
    ? `<div class="empty">판매자 데이터가 없습니다.</div>`
    : `
      <div class="sellers">
        ${sellers.slice(0, 8).map((s, i) => `
          <div class="seller-row${s.mine ? " mine" : ""}">
            <span class="seller-rank">${i + 1}</span>
            <span class="seller-name">${escapeHtml(s.mall)}${s.mine ? " ★" : ""}</span>
            <span class="seller-share">${s.share.toFixed(1)}%</span>
            <span class="seller-bar-wrap"><span class="seller-bar" style="width:${s.share}%"></span></span>
          </div>`).join("")}
      </div>`;
  return `<div class="side-box"><div class="side-box-title">노출 순위</div>${body}</div>`;
}

/* ── 광고 압박도 / 경쟁사 광고 강도 ──
   순위 계산할 땐 걸러내고 버리던 is_ad=true 행(이 실행에서 이미 수집해둔 state.rows에도,
   과거 실행분에도 shopping_search_snapshots에 그대로 쌓여있다)을 읽어서 만든다. 압박도(이
   실행/키워드 기준)는 이미 로드된 state.rows로 즉시 계산되고, 경쟁사 강도(30일 추세)만
   과거분까지 봐야 해서 별도 조회가 필요하다. */
function adPressureBadge(adCount) {
  if (adCount >= 3) return { text: "높음", cls: "bad" };
  if (adCount >= 1) return { text: "보통", cls: "mid" };
  return { text: "낮음", cls: "good" };
}

function adTrendLabel(recent, prior) {
  if (!recent && !prior) return { text: "-", cls: "flat" };
  if (!prior) return { text: "신규", cls: "up" };
  const ratio = recent / prior;
  if (ratio >= 1.5) return { text: "급증", cls: "up" };
  if (ratio <= 0.5) return { text: "급감", cls: "down" };
  return { text: "유지", cls: "flat" };
}

function adAdvertisersHtml(list) {
  const body = !list || !list.length
    ? `<div class="empty">최근 30일 안에 잡힌 광고가 없습니다.</div>`
    : `
      <div class="sellers">
        ${list.slice(0, 8).map((row, i) => `
          <div class="seller-row">
            <span class="seller-rank">${i + 1}</span>
            <span class="seller-name">${escapeHtml(row.mall)}</span>
            <span class="ad-trend-label ${row.trend.cls}">${row.trend.text}</span>
            <span class="seller-bar-wrap"><span class="seller-bar" style="width:${Math.round((row.recent / (list[0].recent || 1)) * 100)}%"></span></span>
          </div>`).join("")}
      </div>`;
  return `<div class="side-box"><div class="side-box-title">경쟁사 광고 강도<span style="font-weight:600;color:#98a2b3;">최근 30일 노출횟수</span></div>${body}</div>`;
}

async function fetchAdLeaderboard(storeName, keyword) {
  if (!storeName || !keyword) return [];
  const headers = await getAuthenticatedHeaders();
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceDate = since.toISOString().slice(0, 10);
  const query = new URLSearchParams({
    select: "mall_name,collected_date",
    store_name: `eq.${storeName}`,
    keyword: `eq.${keyword}`,
    is_ad: "eq.true",
    collected_date: `gte.${sinceDate}`,
    limit: "5000",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/shopping_search_snapshots?${query}`, { headers });
  if (!response.ok) return [];
  const rows = await response.json();

  const now = new Date();
  const cutoff30 = new Date(now); cutoff30.setDate(cutoff30.getDate() - 30);
  const counts = new Map(); // mall -> { recent, prior }
  rows.forEach((row) => {
    if (!row.mall_name) return;
    const d = new Date(row.collected_date + "T00:00:00+09:00");
    const bucket = counts.get(row.mall_name) || { recent: 0, prior: 0 };
    if (d >= cutoff30) bucket.recent += 1;
    else bucket.prior += 1;
    counts.set(row.mall_name, bucket);
  });
  return [...counts.entries()]
    .map(([mall, c]) => ({ mall, ...c, trend: adTrendLabel(c.recent, c.prior) }))
    .filter((row) => row.recent > 0 || row.prior > 0)
    .sort((a, b) => b.recent - a.recent);
}

let adLeaderRenderToken = 0;
async function loadAdBand(keyword, storeName, adCount, advertiserCount) {
  document.getElementById("adMetrics").innerHTML = [
    ["상단광고", `${number.format(adCount)}개`, adPressureBadge(adCount).cls === "bad" ? "accent" : ""],
    ["광고주", `${number.format(advertiserCount)}곳`, ""],
  ].map(([label, value, className]) => `
    <div class="metric"><span>${label}</span><strong class="${className}">${value}</strong></div>
  `).join("");

  const token = ++adLeaderRenderToken;
  document.getElementById("adLeaderCol").innerHTML = `<div class="side-box"><div class="side-box-title">경쟁사 광고 강도</div><div class="empty">불러오는 중...</div></div>`;
  const list = await fetchAdLeaderboard(storeName, keyword);
  if (token !== adLeaderRenderToken) return; // 그 사이 다른 키워드로 바뀌었으면 버림
  document.getElementById("adLeaderCol").innerHTML = adAdvertisersHtml(list);
}

async function fetchKeywordInsightData(keyword) {
  const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" });
  const normalized = keyword.replace(/\s+/g, "").toLowerCase();
  // 저장(이번 달 검색량)이 끝난 뒤에 추이를 읽어야 방금 만든 값을 놓치지 않는다 — 순차 실행
  // (service-worker.js의 fetchKeywordInsight와 동일한 레이스 컨디션 수정, 2026-08-06).
  const insightRes = await fetch(`${SUPABASE_URL}/functions/v1/naver-rank`, {
    method: "POST", headers, body: JSON.stringify({ action: "keywordInsight", keyword }),
  });
  const trendRes = await fetch(
    `${SUPABASE_URL}/rest/v1/keyword_search_volume_monthly?keyword=eq.${encodeURIComponent(normalized)}` +
    `&select=snapshot_month,total&order=snapshot_month.desc&limit=36`,
    { headers },
  );
  const insight = insightRes.ok ? await insightRes.json() : null;
  const trendRows = trendRes.ok ? await trendRes.json() : [];
  return { insight, trendRows };
}

async function loadAndRenderInsightBand(keyword, rows) {
  const band = document.getElementById("insightBand");
  const token = ++insightRenderToken;
  if (!keyword) { band.hidden = true; return; }

  let data = insightCache.get(keyword);
  if (!data) {
    try {
      data = await fetchKeywordInsightData(keyword);
      insightCache.set(keyword, data);
    } catch (error) {
      data = null;
    }
    if (token !== insightRenderToken) return; // 그 사이 다른 키워드로 바뀌었으면 버림
  }

  const ad = data?.insight?.ad;
  if (!ad) { band.hidden = true; return; }

  const trendRows = data?.trendRows || [];
  const trendMonth = trendText(trendPair(trendRows, 1));
  const trendYear = trendPair(trendRows, 12);
  const category = frequency(rows.map((row) => row.category_path))[0]?.[0] || "";
  const page = buildInsightPageStats(rows, ad.monthlyTotal ?? null);

  document.getElementById("insightHeadline").innerHTML = insightHeadlineHtml(trendYear);
  document.getElementById("insightCategoryLine").innerHTML = insightCategoryLineHtml(category);
  document.getElementById("volChartCol").innerHTML = trendChartHtml(trendRows);
  document.getElementById("volSideCol1").innerHTML =
    keywordSideBoxHtml(ad, page) + deviceSplitHtml(ad) + extraStatsBoxHtml(trendMonth, page);
  document.getElementById("volSideCol2").innerHTML = sellersHtml(page?.sellers);
  band.hidden = false;
  bindTrendChart(trendRows);
}

function render() {
  const rows = currentRows();
  const allKeywordRows = state.rows.filter((row) => row.keyword === state.keyword);
  const collectedAt = allKeywordRows[0]?.collected_at ? new Date(allKeywordRows[0].collected_at).toLocaleString("ko-KR") : "-";
  const adRows = allKeywordRows.filter((row) => row.is_ad);
  const adCount = adRows.length;
  const advertiserCount = new Set(adRows.map((row) => row.mall_name).filter(Boolean)).size;
  document.getElementById("summaryKeyword").textContent = state.keyword || "-";
  document.getElementById("summarySentence").textContent = `일반상품 ${number.format(rows.length)}개를 노출 순서대로 분석했습니다. 광고 ${number.format(adCount)}개는 순위에서 제외했습니다.`;
  document.getElementById("reportMeta").textContent = `키워드 ${state.keyword || "-"} · 수집 ${collectedAt} · 일반상품 ${number.format(rows.length)}개`;
  document.getElementById("tableDescription").textContent = `${state.keyword} 일반상품 ${number.format(rows.length)}개 · 광고 제외`;
  renderMetrics(rows);
  renderInsights(rows);
  renderRows(rows);
  loadAndRenderInsightBand(state.keyword, rows);
  loadAdBand(state.keyword, allKeywordRows[0]?.store_name || "", adCount, advertiserCount);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function createCsv() {
  const headers = ["순위", "상품명", "쇼핑몰", "스펙/속성", "검색태그", "판매가", "배송비", "구매", "리뷰", "등록일", "자사상품", "추적상품", "상품링크"];
  const lines = currentRows().map((row) => [
    row.organic_rank, row.product_name, row.mall_name,
    displaySpecs(row),
    usefulTags(row.tags).join(" "),
    row.product_price, row.shipping_fee, row.purchase_count, row.review_count,
    formatRegistrationDate(row.registration_date), row.is_target_store ? "Y" : "N", row.is_tracked ? "Y" : "N", row.product_link,
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}`;
}

async function fetchAllReportRows(runId) {
  const rows = [];
  const pageSize = 1000;
  const headers = await getAuthenticatedHeaders();
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "*",
      run_id: `eq.${runId}`,
      order: "keyword.asc,is_ad.asc,organic_rank.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shopping_search_snapshots?${query}`, {
      headers,
    });
    if (!response.ok) throw new Error(`리포트 조회 실패: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function loadReport() {
  const runId = new URLSearchParams(location.search).get("runId");
  if (!runId) throw new Error("리포트 실행 ID가 없습니다.");
  state.rows = await fetchAllReportRows(runId);
  const keywords = [...new Set(state.rows.map((row) => row.keyword).filter(Boolean))];
  state.keyword = keywords[0] || "";
  const select = document.getElementById("keywordSelect");
  select.innerHTML = keywords.map((keyword) => `<option value="${escapeHtml(keyword)}">${escapeHtml(keyword)}</option>`).join("");
  select.disabled = keywords.length < 2;
  render();
}

document.getElementById("keywordSelect").addEventListener("change", (event) => {
  state.keyword = event.target.value;
  render();
});

document.getElementById("csvButton").addEventListener("click", () => {
  const blob = new Blob([createCsv()], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `쇼핑분석_${state.keyword}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("copyButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText(createCsv().replace(/^\uFEFF/, ""));
  showToast("표 데이터를 복사했습니다.");
});

loadReport().catch((error) => {
  document.getElementById("reportMeta").textContent = error.message;
  document.getElementById("emptyState").hidden = false;
  document.querySelector(".summary-band").hidden = true;
});
