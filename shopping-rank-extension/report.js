const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";

const state = { rows: [], keyword: "" };
const number = new Intl.NumberFormat("ko-KR");
const money = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

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

function renderInsights(rows) {
  const category = frequency(rows.map((row) => row.category_path))[0]?.[0] || "-";
  const malls = frequency(rows.map((row) => row.mall_name)).slice(0, 3);
  const tags = frequency(rows.flatMap((row) => Array.isArray(row.tags) ? row.tags : [])).slice(0, 10);
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
    const tags = Array.isArray(row.tags) ? row.tags.slice(0, 7) : [];
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

function render() {
  const rows = currentRows();
  const allKeywordRows = state.rows.filter((row) => row.keyword === state.keyword);
  const collectedAt = allKeywordRows[0]?.collected_at ? new Date(allKeywordRows[0].collected_at).toLocaleString("ko-KR") : "-";
  const adCount = allKeywordRows.filter((row) => row.is_ad).length;
  document.getElementById("summaryKeyword").textContent = state.keyword || "-";
  document.getElementById("summarySentence").textContent = `일반상품 ${number.format(rows.length)}개를 노출 순서대로 분석했습니다. 광고 ${number.format(adCount)}개는 순위에서 제외했습니다.`;
  document.getElementById("reportMeta").textContent = `키워드 ${state.keyword || "-"} · 수집 ${collectedAt} · 일반상품 ${number.format(rows.length)}개`;
  document.getElementById("tableDescription").textContent = `${state.keyword} 일반상품 ${number.format(rows.length)}개 · 광고 제외`;
  renderMetrics(rows);
  renderInsights(rows);
  renderRows(rows);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function createCsv() {
  const headers = ["순위", "상품명", "쇼핑몰", "스펙/속성", "검색태그", "판매가", "배송비", "구매", "리뷰", "등록일", "자사상품", "추적상품", "상품링크"];
  const lines = currentRows().map((row) => [
    row.organic_rank, row.product_name, row.mall_name,
    displaySpecs(row),
    Array.isArray(row.tags) ? row.tags.join(" ") : "",
    row.product_price, row.shipping_fee, row.purchase_count, row.review_count,
    formatRegistrationDate(row.registration_date), row.is_target_store ? "Y" : "N", row.is_tracked ? "Y" : "N", row.product_link,
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}`;
}

async function loadReport() {
  const runId = new URLSearchParams(location.search).get("runId");
  if (!runId) throw new Error("리포트 실행 ID가 없습니다.");
  const query = new URLSearchParams({
    select: "*", run_id: `eq.${runId}`, order: "keyword.asc,is_ad.asc,organic_rank.asc", limit: "2000",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/shopping_search_snapshots?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!response.ok) throw new Error(`리포트 조회 실패: ${await response.text()}`);
  state.rows = await response.json();
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
