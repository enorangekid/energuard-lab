const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const AUTH_KEY = "energuardSupabaseAuthSession";

const money = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const state = { rows: [], keyword: "" };

async function getAuthenticatedHeaders() {
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
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
}

function currentRows() {
  return state.rows
    .filter((row) => row.keyword === state.keyword && row.product_code)
    .sort((a, b) => (Number(a.rank) || 999999) - (Number(b.rank) || 999999));
}

function renderTable() {
  const rows = currentRows();
  document.getElementById("tableTitle").textContent = `"${state.keyword}" 검색결과 상품`;
  const tbody = document.getElementById("reportRows");
  const emptyState = document.getElementById("emptyState");
  if (!rows.length) {
    tbody.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="rank">${row.rank ?? "-"}</td>
      <td>${row.product_image ? `<img class="thumb" src="${escapeHtml(row.product_image)}" alt="" loading="lazy">` : ""}</td>
      <td class="product-cell">
        <a class="product-link" href="${escapeHtml(row.product_link || "#")}" target="_blank" rel="noopener">${escapeHtml(row.product_name || "-")}</a>
      </td>
      <td class="money">${row.product_price ? money.format(row.product_price) : "-"}</td>
    </tr>
  `).join("");
}

function renderKeywordSelect() {
  const keywords = [...new Set(state.rows.map((row) => row.keyword))];
  const select = document.getElementById("keywordSelect");
  select.innerHTML = keywords.map((kw) => `<option value="${escapeHtml(kw)}">${escapeHtml(kw)}</option>`).join("");
  state.keyword = keywords[0] || "";
  select.value = state.keyword;
  select.addEventListener("change", () => {
    state.keyword = select.value;
    renderTable();
  });
}

async function load() {
  const params = new URLSearchParams(location.search);
  const storeName = params.get("storeName") || "";
  const collectedDate = params.get("date") || "";
  const keywords = (params.get("keywords") || "").split(",").map((k) => k.trim()).filter(Boolean);
  const meta = document.getElementById("reportMeta");

  if (!storeName || !collectedDate || !keywords.length) {
    meta.textContent = "리포트 정보가 부족합니다.";
    return;
  }
  meta.textContent = `${storeName} · ${collectedDate} · 키워드 ${keywords.length}개`;

  const keywordFilter = encodeURIComponent(`(${keywords.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",")})`);
  const url = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?source=eq.nplus_store` +
    `&store_name=eq.${encodeURIComponent(storeName)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&keyword=in.${keywordFilter}` +
    `&select=keyword,rank,product_code,product_name,product_image,product_link,product_price` +
    `&order=keyword.asc,rank.asc`;

  try {
    const headers = await getAuthenticatedHeaders();
    const res = await fetch(url, {
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    state.rows = await res.json();
    renderKeywordSelect();
    renderTable();
  } catch (error) {
    meta.textContent = `결과를 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`;
  }
}

load();
