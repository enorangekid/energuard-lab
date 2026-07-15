const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_BASE = "https://api.searchad.naver.com";
const CACHE_TABLE = "naver_ad_campaign_daily";
const COUPANG_TABLE = "coupang_ad_daily";
const COUPANG_SALES_TABLE = "coupang_sales_daily";
const COUPANG_ITEM_TABLE = "coupang_item_snapshot";
const COUPANG_PRODUCT_MAP_TABLE = "coupang_product_map";
const NAVER_PRODUCT_TABLE = "naver_product_daily";
const NAVER_VISIT_TABLE = "naver_visit_daily";
const NAVER_CUSTOMER_TABLE = "naver_customer_snapshot";

type JsonMap = Record<string, unknown>;
type QueryValue = string | string[];
type Campaign = { id: string; name: string; type: string; status: string; raw?: JsonMap };
type AdDailyRow = {
  store_name: string;
  report_date: string;
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  campaign_status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  conversion_rate: number;
  conversion_sales: number;
  purchase_conversions: number;
  purchase_sales: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function toArray(data: unknown): JsonMap[] {
  if (Array.isArray(data)) return data as JsonMap[];
  if (data && typeof data === "object") {
    const obj = data as JsonMap;
    for (const key of ["data", "content", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as JsonMap[];
    }
  }
  return [];
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateRange(body: JsonMap) {
  const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dateTo = String(body.dateTo || kstToday);
  const dateFrom = String(body.dateFrom || dateTo);
  return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
}

function listDates(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  const start = new Date(`${dateFrom}T00:00:00Z`).getTime();
  const end = new Date(`${dateTo}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return dates;
  for (let t = start; t <= end; t += 86400000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

function ymd(date: string) {
  return String(date || "").replace(/\D/g, "").slice(0, 8);
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const match = raw.match(/(\d{4})\D?(\d{2})\D?(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function getCredentials() {
  const customerId = Deno.env.get("NAVER_AD_CUSTOMER_ID") || "";
  const accessLicense = Deno.env.get("NAVER_AD_ACCESS_LICENSE") || "";
  const secretKey = Deno.env.get("NAVER_AD_SECRET_KEY") || "";
  if (!customerId || !accessLicense || !secretKey) {
    throw new Error("NAVER_AD_CUSTOMER_ID / NAVER_AD_ACCESS_LICENSE / NAVER_AD_SECRET_KEY secret이 필요합니다.");
  }
  return { customerId, accessLicense, secretKey };
}

function getSupabaseCredentials() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  return { url, key, enabled: !!url && !!key };
}

async function makeSignature(secret: string, timestamp: string, method: string, uri: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${method}.${uri}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function buildQuery(params: Record<string, QueryValue> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else query.append(key, value);
  }
  return query.toString();
}

async function adRequest(method: string, path: string, body?: unknown, params: Record<string, QueryValue> = {}) {
  const { customerId, accessLicense, secretKey } = getCredentials();
  const query = buildQuery(params);
  const timestamp = String(Date.now());
  const signature = await makeSignature(secretKey, timestamp, method, path);

  const res = await fetch(`${API_BASE}${path}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Timestamp": timestamp,
      "X-API-KEY": accessLicense,
      "X-Customer": customerId,
      "X-Signature": signature,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!res.ok) throw new Error(`네이버 검색광고 API ${res.status}: ${String(text).slice(0, 300)}`);
  return data;
}

function adFetch(path: string, params: Record<string, QueryValue> = {}) {
  return adRequest("GET", path, undefined, params);
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key, enabled } = getSupabaseCredentials();
  if (!enabled) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secret이 필요합니다.");
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase cache ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Supabase REST는 요청당 최대 1,000행만 반환하므로, 조회는 항상 이 함수로 페이지를 돌며 전부 가져온다.
async function supabaseSelectAll(path: string) {
  const all: JsonMap[] = [];
  for (let page = 0; page < 100; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const rows = toArray(await supabaseRequest(`${path}${sep}offset=${page * 1000}&limit=1000`));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function downloadReport(url: string) {
  const { customerId, accessLicense, secretKey } = getCredentials();
  const path = new URL(url).pathname;
  const timestamp = String(Date.now());
  const signature = await makeSignature(secretKey, timestamp, "GET", path);
  const res = await fetch(url, {
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": accessLicense,
      "X-Customer": customerId,
      "X-Signature": signature,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`보고서 다운로드 실패 ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

function storeCampaignKeywords(store: string) {
  const normalized = String(store || "").replace(/\s+/g, "");
  if (normalized.includes("에너가드")) return ["에너가드", "energuard"];
  if (normalized.includes("한국단열")) return ["한국단열", "한국 단열"];
  return [];
}

function filterCampaignsByStore(campaigns: Campaign[], store: string) {
  const keywords = storeCampaignKeywords(store);
  if (!keywords.length) return campaigns;
  const filtered = campaigns.filter(campaign => {
    const name = campaign.name.toLowerCase().replace(/\s+/g, "");
    return keywords.some(keyword => name.includes(keyword.toLowerCase().replace(/\s+/g, "")));
  });
  return filtered.length ? filtered : campaigns;
}

async function listCampaigns() {
  const data = await adFetch("/ncc/campaigns");
  return toArray(data)
    .filter(item => item.nccCampaignId || item.id)
    .map(item => {
      const id = String(item.nccCampaignId || item.id || "");
      return {
        id,
        name: String(item.name || item.campaignName || id || "광고 캠페인"),
        type: String(item.campaignTp || item.campaignType || item.type || "-"),
        status: String(item.status || item.userLock || "-"),
        raw: item,
      };
    });
}

async function fetchCampaignStats(campaignIds: string[], dateFrom: string, dateTo: string, daily = false) {
  const ids = campaignIds.map(id => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return [];
  const params: Record<string, QueryValue> = {
    ids,
    fields: JSON.stringify(["impCnt", "clkCnt", "ctr", "cpc", "salesAmt", "ccnt", "crto", "convAmt", "ror"]),
    timeRange: JSON.stringify({ since: dateFrom, until: dateTo }),
  };
  if (daily) params.timeIncrement = "1";
  return toArray(await adFetch("/stats", params));
}

async function ensureConversionReport(statDt: string, reportTp: string) {
  try {
    return await adRequest("POST", "/stat-reports", { reportTp, statDt }) as JsonMap;
  } catch (_) {
    const list = toArray(await adFetch("/stat-reports"));
    return list.find(item =>
      String(item.reportTp) === reportTp &&
      String(item.statDt || "").replace(/\D/g, "").slice(0, 8) === statDt
    ) || null;
  }
}

async function fetchPurchaseRowsByDate(statDt: string, reportTp = "AD_CONVERSION") {
  const created = await ensureConversionReport(statDt, reportTp);
  const jobId = String(created?.reportJobId || "");
  if (!created || !jobId) return { rows: [] as string[][], note: `${reportTp} ${statDt} 보고서 생성 실패` };

  let job = created;
  const deadline = Date.now() + 45000;
  while (["REGIST", "RUNNING", "WAITING"].includes(String(job.status)) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1200));
    job = await adFetch(`/stat-reports/${jobId}`) as JsonMap;
  }

  const status = String(job.status || "");
  let rows: string[][] = [];
  let note = "";
  if (status === "BUILT" || status === "DONE") {
    const tsv = await downloadReport(String(job.downloadUrl || ""));
    rows = tsv.split(/\r?\n/).filter(Boolean).map(line => line.split("\t"));
  } else if (status !== "NONE") {
    note = `${reportTp} ${statDt}: ${status || "시간 초과"}`;
  }
  try {
    await adRequest("DELETE", `/stat-reports/${jobId}`);
  } catch (_) { /* ignore cleanup errors */ }
  return { rows, note };
}

async function purchaseStatsByCampaign(dateFrom: string, dateTo: string) {
  const dates = listDates(dateFrom, dateTo).map(date => ymd(date));
  if (!dates.length) throw new Error("구매완료 전환 조회 기간이 올바르지 않습니다.");
  if (dates.length > 31) throw new Error("구매완료 전환은 최대 31일 범위까지 조회할 수 있습니다.");

  const byCampaign = new Map<string, { conversions: number; sales: number }>();
  const notes: string[] = [];
  // NAVERPAY_CONVERSION은 이 계정에 데이터가 없어 제외 (2026-07 검증) — 필요 시 여기에 다시 추가
  const tasks = dates.map(statDt => ({ statDt, reportTp: "AD_CONVERSION" }));
  for (let i = 0; i < tasks.length; i += 6) {
    const chunk = tasks.slice(i, i + 6);
    const results = await Promise.all(chunk.map(task => fetchPurchaseRowsByDate(task.statDt, task.reportTp)));
    results.forEach(result => {
      if (result.note) notes.push(result.note);
      result.rows.forEach(cols => {
        if (cols.length < 6) return;
        const campaignId = cols.find(col => col.startsWith("cmp-")) || "";
        if (!campaignId) return;
        const conversionType = String(cols[cols.length - 3] || "").trim().toLowerCase();
        if (conversionType !== "purchase" && conversionType !== "1") return;
        if (!byCampaign.has(campaignId)) byCampaign.set(campaignId, { conversions: 0, sales: 0 });
        const item = byCampaign.get(campaignId)!;
        item.conversions += toNumber(cols[cols.length - 2]);
        item.sales += toNumber(cols[cols.length - 1]);
      });
    });
  }
  return { byCampaign, notes };
}

function statDate(row: JsonMap) {
  return normalizeDate(
    row.dateStart || row.date || row.startDate || row.timeStart || row.period ||
    row.statDt || row.ymd || row.dateEnd || row.endDate,
  );
}

function statCampaignId(row: JsonMap) {
  return String(row.id || row.nccCampaignId || row.nccCampaignID || row.campaignId || "");
}

function blankDailyRow(store: string, date: string, campaign: Campaign): AdDailyRow {
  return {
    store_name: store,
    report_date: date,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    campaign_type: campaign.type,
    campaign_status: campaign.status,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cost: 0,
    conversions: 0,
    conversion_rate: 0,
    conversion_sales: 0,
    purchase_conversions: 0,
    purchase_sales: 0,
  };
}

function mapCacheRow(row: JsonMap): AdDailyRow {
  return {
    store_name: String(row.store_name || ""),
    report_date: normalizeDate(row.report_date) || String(row.report_date || ""),
    campaign_id: String(row.campaign_id || ""),
    campaign_name: String(row.campaign_name || ""),
    campaign_type: String(row.campaign_type || ""),
    campaign_status: String(row.campaign_status || ""),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    ctr: toNumber(row.ctr),
    cpc: toNumber(row.cpc),
    cost: toNumber(row.cost),
    conversions: toNumber(row.conversions),
    conversion_rate: toNumber(row.conversion_rate),
    conversion_sales: toNumber(row.conversion_sales),
    purchase_conversions: toNumber(row.purchase_conversions),
    purchase_sales: toNumber(row.purchase_sales),
  };
}

async function readCacheRaw(store: string, dateFrom: string, dateTo: string) {
  const query = new URLSearchParams({
    select: "*",
    store_name: `eq.${store}`,
    report_date: `gte.${dateFrom}`,
    order: "report_date.asc,campaign_name.asc",
  });
  query.append("report_date", `lte.${dateTo}`);
  return await supabaseSelectAll(`/rest/v1/${CACHE_TABLE}?${query.toString()}`);
}

// 간접전환이 클릭 후 최대 7일까지 소급 집계되므로, 최근 7일은 캐시가 있어도 갱신 대상으로 본다.
const REFRESH_WINDOW_DAYS = 7;
const STALE_AFTER_MS = 60 * 60 * 1000; // 1시간 이내 수집분은 갱신 생략

function collectTargets(rawRows: JsonMap[], dates: string[]) {
  const fetchedByDate = new Map<string, number>();
  rawRows.forEach(row => {
    const date = normalizeDate(row.report_date);
    if (!date) return;
    const fetched = new Date(String(row.fetched_at || "")).getTime() || 0;
    fetchedByDate.set(date, Math.max(fetchedByDate.get(date) || 0, fetched));
  });
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const refreshFrom = new Date(new Date(`${today}T00:00:00Z`).getTime() - (REFRESH_WINDOW_DAYS - 1) * 86400000)
    .toISOString().slice(0, 10);
  const missingDates = dates.filter(date => !fetchedByDate.has(date));
  const staleDates = dates.filter(date => {
    const fetched = fetchedByDate.get(date);
    return fetched !== undefined && date >= refreshFrom && fetched < Date.now() - STALE_AFTER_MS;
  });
  return { missingDates, staleDates };
}

async function upsertDailyRows(rows: AdDailyRow[]) {
  if (!rows.length) return;
  await supabaseRequest(`/rest/v1/${CACHE_TABLE}?on_conflict=store_name,report_date,campaign_id`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map(row => ({ ...row, fetched_at: new Date().toISOString() }))),
  });
}

function rowKey(date: string, campaignId: string) {
  return `${date}|${campaignId}`;
}

// 지정한 날짜들(연속일 필요 없음)의 지표를 네이버에서 수집한다.
// 주의: /stats는 여러 ids + timeIncrement(일별 분할) 조합을 지원하지 않아(11001),
// 날짜마다 "하루짜리 범위 요약" 호출로 일별 데이터를 얻는다.
async function fetchLiveDailyRows(store: string, campaigns: Campaign[], dates: string[]) {
  const byKey = new Map<string, AdDailyRow>();
  dates.forEach(date => campaigns.forEach(campaign => {
    byKey.set(rowKey(date, campaign.id), blankDailyRow(store, date, campaign));
  }));

  const campaignMap = new Map(campaigns.map(campaign => [campaign.id, campaign]));
  await Promise.all(dates.map(async date => {
    for (let i = 0; i < campaigns.length; i += 100) {
      const ids = campaigns.slice(i, i + 100).map(item => item.id);
      const stats = await fetchCampaignStats(ids, date, date);
      stats.forEach(stat => {
        const id = statCampaignId(stat);
        const campaign = campaignMap.get(id);
        if (!campaign) return;
        const item = byKey.get(rowKey(date, id)) || blankDailyRow(store, date, campaign);
        item.impressions = toNumber(stat.impCnt);
        item.clicks = toNumber(stat.clkCnt);
        item.ctr = toNumber(stat.ctr);
        item.cpc = toNumber(stat.cpc);
        item.cost = toNumber(stat.salesAmt);
        item.conversions = toNumber(stat.ccnt);
        item.conversion_rate = toNumber(stat.crto);
        item.conversion_sales = toNumber(stat.convAmt);
        byKey.set(rowKey(date, id), item);
      });
    }
  }));

  const purchaseNotes: string[] = [];
  const results = await Promise.all(dates.map(async date => {
    try {
      return { date, ok: true as const, result: await purchaseStatsByCampaign(date, date) };
    } catch (e) {
      return { date, ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }));
  results.forEach(item => {
    if (!item.ok) {
      purchaseNotes.push(`${item.date}: ${item.error}`);
      return;
    }
    item.result.notes.forEach(note => purchaseNotes.push(note));
    item.result.byCampaign.forEach((purchase, campaignId) => {
      const row = byKey.get(rowKey(item.date, campaignId));
      if (!row) return;
      row.purchase_conversions = purchase.conversions;
      row.purchase_sales = purchase.sales;
    });
  });

  return { rows: [...byKey.values()], purchaseNotes };
}

// 수집 액션: 미수집/갱신 대상 날짜 중 최신 순으로 maxDays개만 수집하고 남은 개수를 알려준다.
// 프론트가 remaining이 0이 될 때까지 반복 호출한다.
async function collectAds(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const store = String(body.store || "");
  const maxDays = Math.min(Math.max(Math.round(toNumber(body.maxDays)) || 5, 1), 7);
  const dates = listDates(dateFrom, dateTo);
  if (!dates.length) throw new Error("수집 기간이 올바르지 않습니다.");
  if (dates.length > 92) throw new Error("한 번에 최대 92일 범위까지만 수집할 수 있습니다.");

  const raw = await readCacheRaw(store, dateFrom, dateTo);
  const { missingDates, staleDates } = collectTargets(raw, dates);
  const targets = [...missingDates, ...staleDates].sort((a, b) => b.localeCompare(a));
  if (!targets.length) {
    return { collected: [], remaining: 0, done: true, purchaseError: "" };
  }

  const chunk = targets.slice(0, maxDays);
  const campaigns = filterCampaignsByStore(await listCampaigns(), store);
  if (!campaigns.length) throw new Error("네이버 검색광고 계정에서 조회 가능한 캠페인이 없습니다.");
  const live = await fetchLiveDailyRows(store, campaigns, chunk);
  await upsertDailyRows(live.rows);
  return {
    collected: chunk,
    remaining: targets.length - chunk.length,
    done: targets.length === chunk.length,
    purchaseError: live.purchaseNotes.join(", "),
  };
}

function aggregateDailyRows(rows: AdDailyRow[], dateFrom: string, dateTo: string, source = "cache", purchaseError = "") {
  const byCampaign = new Map<string, JsonMap>();
  rows.forEach(row => {
    if (!byCampaign.has(row.campaign_id)) {
      byCampaign.set(row.campaign_id, {
        campaignId: row.campaign_id,
        name: row.campaign_name || row.campaign_id || "광고 캠페인",
        type: row.campaign_type || "-",
        status: row.campaign_status || "-",
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cost: 0,
        conversions: 0,
        conversionRate: 0,
        conversionSales: 0,
        ror: 0,
        purchaseConversions: 0,
        purchaseSales: 0,
        purchaseRoas: 0,
      });
    }
    const item = byCampaign.get(row.campaign_id)!;
    item.impressions = toNumber(item.impressions) + row.impressions;
    item.clicks = toNumber(item.clicks) + row.clicks;
    item.cost = toNumber(item.cost) + row.cost;
    item.conversions = toNumber(item.conversions) + row.conversions;
    item.conversionSales = toNumber(item.conversionSales) + row.conversion_sales;
    item.purchaseConversions = toNumber(item.purchaseConversions) + row.purchase_conversions;
    item.purchaseSales = toNumber(item.purchaseSales) + row.purchase_sales;
  });

  const items = [...byCampaign.values()].map(item => {
    item.ctr = toNumber(item.impressions) ? (toNumber(item.clicks) / toNumber(item.impressions)) * 100 : 0;
    item.cpc = toNumber(item.clicks) ? toNumber(item.cost) / toNumber(item.clicks) : 0;
    item.conversionRate = toNumber(item.clicks) ? (toNumber(item.conversions) / toNumber(item.clicks)) * 100 : 0;
    item.ror = toNumber(item.cost) ? (toNumber(item.conversionSales) / toNumber(item.cost)) * 100 : 0;
    item.purchaseRoas = toNumber(item.cost) ? (toNumber(item.purchaseSales) / toNumber(item.cost)) * 100 : 0;
    return item;
  }).sort((a, b) => toNumber(b.cost) - toNumber(a.cost) || toNumber(b.clicks) - toNumber(a.clicks));

  const total: JsonMap = items.reduce((acc, item) => {
    acc.impressions = toNumber(acc.impressions) + toNumber(item.impressions);
    acc.clicks = toNumber(acc.clicks) + toNumber(item.clicks);
    acc.cost = toNumber(acc.cost) + toNumber(item.cost);
    acc.conversions = toNumber(acc.conversions) + toNumber(item.conversions);
    acc.conversionSales = toNumber(acc.conversionSales) + toNumber(item.conversionSales);
    acc.purchaseConversions = toNumber(acc.purchaseConversions) + toNumber(item.purchaseConversions);
    acc.purchaseSales = toNumber(acc.purchaseSales) + toNumber(item.purchaseSales);
    return acc;
  }, { name: "전체 광고", type: "-", status: "-", impressions: 0, clicks: 0, ctr: 0, cpc: 0, cost: 0, conversions: 0, conversionRate: 0, conversionSales: 0, ror: 0, purchaseConversions: 0, purchaseSales: 0, purchaseRoas: 0 });
  total.ctr = toNumber(total.impressions) ? (toNumber(total.clicks) / toNumber(total.impressions)) * 100 : 0;
  total.cpc = toNumber(total.clicks) ? toNumber(total.cost) / toNumber(total.clicks) : 0;
  total.conversionRate = toNumber(total.clicks) ? (toNumber(total.conversions) / toNumber(total.clicks)) * 100 : 0;
  total.ror = toNumber(total.cost) ? (toNumber(total.conversionSales) / toNumber(total.cost)) * 100 : 0;
  total.purchaseRoas = toNumber(total.cost) ? (toNumber(total.purchaseSales) / toNumber(total.cost)) * 100 : 0;

  return {
    dateFrom,
    dateTo,
    count: items.length,
    total,
    items,
    purchaseError,
    cache: { source, rows: rows.length },
  };
}

// 쿠팡 광고: 브라우저가 파싱한 보고서 행을 받아 일자×캠페인×광고그룹으로 합산해 저장한다.
// 같은 날짜를 다시 업로드하면 해당 날짜 데이터를 통째로 교체한다.
async function coupangUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  if (rawRows.length > 20000) throw new Error("한 번에 최대 20,000행까지 업로드할 수 있습니다.");

  const byKey = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const reportDate = normalizeDate(row.date);
    if (!reportDate) return;
    const campaign = String(row.campaign || "");
    const adGroup = String(row.adGroup || "");
    const placement = String(row.placement || "");
    const key = `${reportDate}|${campaign}|${adGroup}|${placement}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        report_date: reportDate,
        campaign,
        ad_group: adGroup,
        placement,
        ad_type: String(row.adType || ""),
        impressions: 0, clicks: 0, cost: 0, orders: 0, sales: 0, orders_1d: 0, sales_1d: 0,
        fetched_at: new Date().toISOString(),
      });
    }
    const item = byKey.get(key)!;
    item.impressions = toNumber(item.impressions) + toNumber(row.impressions);
    item.clicks = toNumber(item.clicks) + toNumber(row.clicks);
    item.cost = toNumber(item.cost) + toNumber(row.cost);
    item.orders = toNumber(item.orders) + toNumber(row.orders);
    item.sales = toNumber(item.sales) + toNumber(row.sales);
    item.orders_1d = toNumber(item.orders_1d) + toNumber(row.orders1);
    item.sales_1d = toNumber(item.sales_1d) + toNumber(row.sales1);
  });
  const rows = [...byKey.values()];
  if (!rows.length) throw new Error("날짜를 인식할 수 있는 행이 없습니다.");

  const dates = [...new Set(rows.map(row => String(row.report_date)))].sort();
  await supabaseRequest(`/rest/v1/${COUPANG_TABLE}?report_date=in.(${dates.join(",")})`, { method: "DELETE" });
  await supabaseRequest(`/rest/v1/${COUPANG_TABLE}`, {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(rows),
  });
  return { saved: rows.length, dayCount: dates.length, dateFrom: dates[0], dateTo: dates[dates.length - 1] };
}

async function coupangSummary(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const query = new URLSearchParams({
    select: "*",
    report_date: `gte.${dateFrom}`,
    order: "report_date.asc,ad_group.asc",
  });
  query.append("report_date", `lte.${dateTo}`);
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_TABLE}?${query.toString()}`);
  const items = rows.map(row => ({
    date: normalizeDate(row.report_date) || String(row.report_date || ""),
    campaign: String(row.campaign || ""),
    adGroup: String(row.ad_group || ""),
    placement: String(row.placement || ""),
    adType: String(row.ad_type || ""),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    cost: toNumber(row.cost),
    orders: toNumber(row.orders),
    sales: toNumber(row.sales),
    orders1: toNumber(row.orders_1d),
    sales1: toNumber(row.sales_1d),
  }));
  return { dateFrom, dateTo, count: items.length, items };
}

// 쿠팡 셀러 인사이트 "일별 요약" 파일 저장. 같은 날짜 재업로드 시 교체.
async function coupangSalesUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byDate = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const reportDate = normalizeDate(row.date);
    if (!reportDate) return;
    byDate.set(reportDate, {
      report_date: reportDate,
      visitors: toNumber(row.visitors),
      views: toNumber(row.views),
      carts: toNumber(row.carts),
      orders: toNumber(row.orders),
      qty: toNumber(row.qty),
      sales: toNumber(row.sales),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byDate.values()];
  if (!rows.length) throw new Error("날짜를 인식할 수 있는 행이 없습니다.");
  const dates = [...byDate.keys()].sort();
  await supabaseRequest(`/rest/v1/${COUPANG_SALES_TABLE}?report_date=in.(${dates.join(",")})`, { method: "DELETE" });
  await supabaseRequest(`/rest/v1/${COUPANG_SALES_TABLE}`, {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(rows),
  });
  return { saved: rows.length, dayCount: dates.length, dateFrom: dates[0], dateTo: dates[dates.length - 1] };
}

// "월별 바로가기"에서 어느 달에 데이터가 있는지만 확인할 때 쓴다. coupangSalesSummary처럼 전체 컬럼을
// 끌어오지 않고 report_date 하나만 선택해서 훨씬 가볍게 응답한다.
async function coupangSalesMonths(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const query = new URLSearchParams({ select: "report_date", report_date: `gte.${dateFrom}` });
  query.append("report_date", `lte.${dateTo}`);
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_SALES_TABLE}?${query.toString()}`);
  const months = new Set<string>();
  rows.forEach(row => {
    const d = normalizeDate(row.report_date);
    if (d) months.add(d.slice(0, 7));
  });
  return { months: [...months] };
}

async function coupangSalesSummary(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const query = new URLSearchParams({ select: "*", report_date: `gte.${dateFrom}`, order: "report_date.asc" });
  query.append("report_date", `lte.${dateTo}`);
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_SALES_TABLE}?${query.toString()}`);
  const items = rows.map(row => ({
    date: normalizeDate(row.report_date) || String(row.report_date || ""),
    visitors: toNumber(row.visitors),
    views: toNumber(row.views),
    carts: toNumber(row.carts),
    orders: toNumber(row.orders),
    qty: toNumber(row.qty),
    sales: toNumber(row.sales),
  }));
  return { dateFrom, dateTo, count: items.length, items };
}

// 쿠팡 셀러 인사이트 "상품별" 파일 저장 — 날짜 컬럼이 없어 업로드 시 지정한 기간의 스냅샷으로 저장.
async function coupangItemUpload(body: JsonMap) {
  const periodFrom = normalizeDate(body.periodFrom);
  const periodTo = normalizeDate(body.periodTo);
  if (!periodFrom || !periodTo) throw new Error("스냅샷 기간(periodFrom/periodTo)이 필요합니다.");
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byOption = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const optionId = String(row.optionId || "").trim();
    if (!optionId) return;
    byOption.set(optionId, {
      period_from: periodFrom,
      period_to: periodTo,
      option_id: optionId,
      option_name: String(row.optionName || ""),
      product_name: String(row.productName || ""),
      product_id: String(row.productId || ""),
      category: String(row.category || ""),
      sales: toNumber(row.sales),
      orders: toNumber(row.orders),
      qty: toNumber(row.qty),
      visitors: toNumber(row.visitors),
      views: toNumber(row.views),
      carts: toNumber(row.carts),
      item_winner_ratio: toNumber(row.itemWinner),
      cancel_amount: toNumber(row.cancelAmount),
      cancel_qty: toNumber(row.cancelQty),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byOption.values()];
  if (!rows.length) throw new Error("옵션 ID를 인식할 수 있는 행이 없습니다.");
  await supabaseRequest(`/rest/v1/${COUPANG_ITEM_TABLE}?period_from=eq.${periodFrom}&period_to=eq.${periodTo}`, { method: "DELETE" });
  await supabaseRequest(`/rest/v1/${COUPANG_ITEM_TABLE}`, {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(rows),
  });
  return { saved: rows.length, periodFrom, periodTo };
}

async function coupangItemPeriods() {
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_ITEM_TABLE}?select=period_from,period_to&order=period_from.desc,period_to.desc`);
  const seen = new Set<string>();
  const periods: { from: string; to: string }[] = [];
  rows.forEach(row => {
    const from = normalizeDate(row.period_from);
    const to = normalizeDate(row.period_to);
    const key = `${from}|${to}`;
    if (!from || !to || seen.has(key)) return;
    seen.add(key);
    periods.push({ from, to });
  });
  periods.sort((a, b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from));
  return { periods };
}

// 쿠팡 상품목록(Wing "가격/재고 관리" 다운로드)을 옵션ID 기준으로 통째로 교체한다.
// 노출상품ID가 바뀌면 이 목록을 다시 업로드해서 갱신하는 구조라, 스냅샷이 아니라
// "현재 상태 하나"만 유지한다(매번 전체 삭제 후 새로 채움).
async function coupangProductMapUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byOption = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const optionId = String(row.optionId || "").trim();
    if (!optionId) return;
    byOption.set(optionId, {
      option_id: optionId,
      product_id: String(row.productId || ""),
      vendor_product_id: String(row.vendorProductId || ""),
      product_name: String(row.productName || ""),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byOption.values()];
  if (!rows.length) throw new Error("옵션 ID를 인식할 수 있는 행이 없습니다.");
  await supabaseRequest(`/rest/v1/${COUPANG_PRODUCT_MAP_TABLE}?option_id=not.is.null`, { method: "DELETE" });
  for (let i = 0; i < rows.length; i += 1000) {
    await supabaseRequest(`/rest/v1/${COUPANG_PRODUCT_MAP_TABLE}`, {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 1000)),
    });
  }
  return { saved: rows.length };
}

async function coupangProductMapAll() {
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_PRODUCT_MAP_TABLE}?select=option_id,product_id,vendor_product_id`);
  return {
    items: rows.map(row => ({
      optionId: String(row.option_id || ""),
      productId: String(row.product_id || ""),
      vendorProductId: String(row.vendor_product_id || ""),
    })),
  };
}

async function coupangItemSummary(body: JsonMap) {
  const periodFrom = normalizeDate(body.periodFrom);
  const periodTo = normalizeDate(body.periodTo);
  if (!periodFrom || !periodTo) throw new Error("스냅샷 기간이 필요합니다.");
  const query = new URLSearchParams({
    select: "*",
    period_from: `eq.${periodFrom}`,
    period_to: `eq.${periodTo}`,
    order: "sales.desc,views.desc",
  });
  const rows = await supabaseSelectAll(`/rest/v1/${COUPANG_ITEM_TABLE}?${query.toString()}`);
  const items = rows.map(row => ({
    optionId: String(row.option_id || ""),
    optionName: String(row.option_name || ""),
    productName: String(row.product_name || ""),
    category: String(row.category || ""),
    sales: toNumber(row.sales),
    orders: toNumber(row.orders),
    qty: toNumber(row.qty),
    visitors: toNumber(row.visitors),
    views: toNumber(row.views),
    carts: toNumber(row.carts),
    itemWinner: toNumber(row.item_winner_ratio),
    cancelAmount: toNumber(row.cancel_amount),
    cancelQty: toNumber(row.cancel_qty),
  }));
  return { periodFrom, periodTo, count: items.length, items };
}

// ─── 네이버 스마트스토어 판매분석 (비즈어드바이저 엑셀 업로드) ───

async function insertRowsChunked(table: string, rows: JsonMap[]) {
  for (let i = 0; i < rows.length; i += 5000) {
    await supabaseRequest(`/rest/v1/${table}`, {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 5000)),
    });
  }
}

async function deleteDateRange(table: string, dates: string[]) {
  const exactDates = [...new Set(dates)].sort();
  if (!exactDates.length) return;
  await supabaseRequest(
    `/rest/v1/${table}?report_date=in.(${exactDates.join(",")})`,
    { method: "DELETE" },
  );
}

// 상품성과 파일(일별 × 채널상품, "전체" 행 포함). 같은 날짜 재업로드 시 교체.
async function naverProductUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byKey = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const reportDate = normalizeDate(row.date);
    const productId = String(row.productId || "").trim();
    if (!reportDate || !productId) return;
    byKey.set(`${reportDate}|${productId}`, {
      report_date: reportDate,
      product_id: productId,
      product_name: String(row.productName || ""),
      pay_count: toNumber(row.payCount),
      refund_count: toNumber(row.refundCount),
      sales_total: toNumber(row.salesTotal),
      sales_net: toNumber(row.salesNet),
      refund_amount: toNumber(row.refundAmount),
      qty: toNumber(row.qty),
      refund_qty: toNumber(row.refundQty),
      visits: toNumber(row.visits),
      conversion: toNumber(row.conversion),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byKey.values()];
  if (!rows.length) throw new Error("날짜/상품을 인식할 수 있는 행이 없습니다.");
  const dates = [...new Set(rows.map(row => String(row.report_date)))];
  await deleteDateRange(NAVER_PRODUCT_TABLE, dates);
  await insertRowsChunked(NAVER_PRODUCT_TABLE, rows);
  const sorted = dates.sort();
  return { saved: rows.length, dayCount: dates.length, dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
}

// 유입경로 파일(일별 × 경로 3단계, "전체" 행 포함)
async function naverVisitUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byKey = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const reportDate = normalizeDate(row.date);
    if (!reportDate) return;
    const path1 = String(row.path1 || "-");
    const path2 = String(row.path2 || "-");
    const path3 = String(row.path3 || "-");
    byKey.set(`${reportDate}|${path1}|${path2}|${path3}`, {
      report_date: reportDate,
      path1, path2, path3,
      visits: toNumber(row.visits),
      pay_count: toNumber(row.payCount),
      conversion: toNumber(row.conversion),
      sales_total: toNumber(row.salesTotal),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byKey.values()];
  if (!rows.length) throw new Error("날짜를 인식할 수 있는 행이 없습니다.");
  const dates = [...new Set(rows.map(row => String(row.report_date)))];
  await deleteDateRange(NAVER_VISIT_TABLE, dates);
  await insertRowsChunked(NAVER_VISIT_TABLE, rows);
  const sorted = dates.sort();
  return { saved: rows.length, dayCount: dates.length, dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
}

// 고객 파일(행마다 기간이 들어있는 월별 스냅샷 × 고객분류)
async function naverCustomerUpload(body: JsonMap) {
  const rawRows = Array.isArray(body.rows) ? body.rows as JsonMap[] : [];
  if (!rawRows.length) throw new Error("업로드할 행이 없습니다.");
  const byKey = new Map<string, JsonMap>();
  rawRows.forEach(row => {
    const periodFrom = normalizeDate(row.periodFrom);
    const periodTo = normalizeDate(row.periodTo);
    const segment = String(row.segment || "").trim();
    if (!periodFrom || !periodTo || !segment) return;
    byKey.set(`${periodFrom}|${periodTo}|${segment}`, {
      period_from: periodFrom,
      period_to: periodTo,
      segment,
      visitor_count: toNumber(row.visitors),
      payer_count: toNumber(row.payers),
      conversion: toNumber(row.conversion),
      sales_total: toNumber(row.salesTotal),
      avg_payment: toNumber(row.avgPayment),
      fetched_at: new Date().toISOString(),
    });
  });
  const rows = [...byKey.values()];
  if (!rows.length) throw new Error("기간/고객분류를 인식할 수 있는 행이 없습니다.");
  const periods = [...new Set(rows.map(row => `${row.period_from}|${row.period_to}`))];
  for (const period of periods) {
    const [from, to] = period.split("|");
    await supabaseRequest(`/rest/v1/${NAVER_CUSTOMER_TABLE}?period_from=eq.${from}&period_to=eq.${to}`, { method: "DELETE" });
  }
  await insertRowsChunked(NAVER_CUSTOMER_TABLE, rows);
  return { saved: rows.length, periodCount: periods.length };
}

// 조회: 일별 합계("전체" 행) + 상품별 집계 + 유입경로 집계 + 고객 스냅샷을 한 번에 반환
// "월별 바로가기"에서 어느 달에 데이터가 있는지만 확인할 때 쓴다. naverStatSummary는 상품별·유입경로별·
// 고객 스냅샷까지 한꺼번에 조회/집계해서 무거우므로, report_date 하나만 선택하는 가벼운 버전을 따로 둔다.
async function naverStatMonths(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const query = new URLSearchParams({ select: "report_date", report_date: `gte.${dateFrom}` });
  query.append("report_date", `lte.${dateTo}`);
  const rows = await supabaseSelectAll(`/rest/v1/${NAVER_PRODUCT_TABLE}?${query.toString()}`);
  const months = new Set<string>();
  rows.forEach(row => {
    const d = normalizeDate(row.report_date);
    if (d) months.add(d.slice(0, 7));
  });
  return { months: [...months] };
}

async function naverStatSummary(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);

  const q1 = new URLSearchParams({ select: "*", report_date: `gte.${dateFrom}`, order: "report_date.asc" });
  q1.append("report_date", `lte.${dateTo}`);
  const prodRows = await supabaseSelectAll(`/rest/v1/${NAVER_PRODUCT_TABLE}?${q1.toString()}`);
  const daily: JsonMap[] = [];
  const byProduct = new Map<string, JsonMap>();
  prodRows.forEach(row => {
    const item = {
      date: normalizeDate(row.report_date) || String(row.report_date || ""),
      productId: String(row.product_id || ""),
      productName: String(row.product_name || ""),
      payCount: toNumber(row.pay_count),
      refundCount: toNumber(row.refund_count),
      salesTotal: toNumber(row.sales_total),
      salesNet: toNumber(row.sales_net),
      refundAmount: toNumber(row.refund_amount),
      qty: toNumber(row.qty),
      refundQty: toNumber(row.refund_qty),
      visits: toNumber(row.visits),
      conversion: toNumber(row.conversion),
    };
    if (item.productId === "전체" || item.productName === "전체") {
      daily.push(item);
      return;
    }
    if (!byProduct.has(item.productId)) {
      byProduct.set(item.productId, {
        productId: item.productId, productName: item.productName,
        payCount: 0, refundCount: 0, salesTotal: 0, salesNet: 0, refundAmount: 0,
        qty: 0, refundQty: 0, visits: 0, conversion: 0,
      });
    }
    const acc = byProduct.get(item.productId)!;
    acc.productName = item.productName || acc.productName;
    acc.payCount = toNumber(acc.payCount) + item.payCount;
    acc.refundCount = toNumber(acc.refundCount) + item.refundCount;
    acc.salesTotal = toNumber(acc.salesTotal) + item.salesTotal;
    acc.salesNet = toNumber(acc.salesNet) + item.salesNet;
    acc.refundAmount = toNumber(acc.refundAmount) + item.refundAmount;
    acc.qty = toNumber(acc.qty) + item.qty;
    acc.refundQty = toNumber(acc.refundQty) + item.refundQty;
    acc.visits = toNumber(acc.visits) + item.visits;
  });
  const products = [...byProduct.values()].map(item => {
    item.conversion = toNumber(item.visits) ? (toNumber(item.payCount) / toNumber(item.visits)) * 100 : 0;
    return item;
  }).sort((a, b) => toNumber(b.salesTotal) - toNumber(a.salesTotal));

  const q2 = new URLSearchParams({ select: "*", report_date: `gte.${dateFrom}`, order: "report_date.asc" });
  q2.append("report_date", `lte.${dateTo}`);
  const visitRows = await supabaseSelectAll(`/rest/v1/${NAVER_VISIT_TABLE}?${q2.toString()}`);
  const byPath = new Map<string, JsonMap>();
  visitRows.forEach(row => {
    const path1 = String(row.path1 || "-");
    if (path1 === "전체") return;
    const path2 = String(row.path2 || "-");
    const key = `${path1}|${path2}`;
    if (!byPath.has(key)) byPath.set(key, { path1, path2, visits: 0, payCount: 0, conversion: 0, salesTotal: 0 });
    const acc = byPath.get(key)!;
    acc.visits = toNumber(acc.visits) + toNumber(row.visits);
    acc.payCount = toNumber(acc.payCount) + toNumber(row.pay_count);
    acc.salesTotal = toNumber(acc.salesTotal) + toNumber(row.sales_total);
  });
  const visitPaths = [...byPath.values()].map(item => {
    item.conversion = toNumber(item.visits) ? (toNumber(item.payCount) / toNumber(item.visits)) * 100 : 0;
    return item;
  }).sort((a, b) => toNumber(b.visits) - toNumber(a.visits));

  const custRows = await supabaseSelectAll(`/rest/v1/${NAVER_CUSTOMER_TABLE}?select=*&order=period_to.desc,period_from.desc`);
  const seen = new Set<string>();
  const customerPeriods: { from: string; to: string }[] = [];
  custRows.forEach(row => {
    const from = normalizeDate(row.period_from);
    const to = normalizeDate(row.period_to);
    const key = `${from}|${to}`;
    if (!from || !to || seen.has(key)) return;
    seen.add(key);
    customerPeriods.push({ from, to });
  });
  const requested = String(body.customerPeriod || "");
  let customerPeriod = customerPeriods.some(p => `${p.from}|${p.to}` === requested) ? requested : "";
  if (!customerPeriod) {
    const exact = customerPeriods.find(p => p.from === dateFrom && p.to === dateTo);
    customerPeriod = exact ? `${exact.from}|${exact.to}` : (customerPeriods.length ? `${customerPeriods[0].from}|${customerPeriods[0].to}` : "");
  }
  const segmentOrder: Record<string, number> = { "전체합산": 0, "신규": 1, "재구매": 2 };
  const customer = customerPeriod
    ? custRows
      .filter(row => `${normalizeDate(row.period_from)}|${normalizeDate(row.period_to)}` === customerPeriod)
      .map(row => ({
        segment: String(row.segment || ""),
        visitors: toNumber(row.visitor_count),
        payers: toNumber(row.payer_count),
        conversion: toNumber(row.conversion),
        salesTotal: toNumber(row.sales_total),
        avgPayment: toNumber(row.avg_payment),
      }))
      .sort((a, b) => (segmentOrder[a.segment] ?? 9) - (segmentOrder[b.segment] ?? 9))
    : [];

  return { dateFrom, dateTo, daily, products, visitPaths, customerPeriods, customerPeriod, customer };
}

// 조회 액션: 네이버 API를 전혀 호출하지 않고 캐시 테이블만 읽는다. 수집은 collect 액션으로 분리.
async function campaignSummary(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const store = String(body.store || "");
  const dates = listDates(dateFrom, dateTo);
  const raw = await readCacheRaw(store, dateFrom, dateTo);
  const { missingDates, staleDates } = collectTargets(raw, dates);
  const result = aggregateDailyRows(raw.map(mapCacheRow), dateFrom, dateTo, "cache");
  return { ...result, missingDates, staleDates };
}

async function dailySummary(body: JsonMap) {
  const { dateFrom, dateTo } = dateRange(body);
  const store = String(body.store || "");
  const dates = listDates(dateFrom, dateTo);
  const raw = await readCacheRaw(store, dateFrom, dateTo);
  const { missingDates, staleDates } = collectTargets(raw, dates);
  const cachedRows = raw.map(mapCacheRow);
  const byDate = new Map<string, JsonMap>();
  cachedRows.forEach(row => {
    if (!byDate.has(row.report_date)) {
      byDate.set(row.report_date, { date: row.report_date, cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionSales: 0, purchaseConversions: 0, purchaseSales: 0 });
    }
    const item = byDate.get(row.report_date)!;
    item.impressions = toNumber(item.impressions) + row.impressions;
    item.clicks = toNumber(item.clicks) + row.clicks;
    item.cost = toNumber(item.cost) + row.cost;
    item.conversions = toNumber(item.conversions) + row.conversions;
    item.conversionSales = toNumber(item.conversionSales) + row.conversion_sales;
    item.purchaseConversions = toNumber(item.purchaseConversions) + row.purchase_conversions;
    item.purchaseSales = toNumber(item.purchaseSales) + row.purchase_sales;
  });
  const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { dateFrom, dateTo, count: rows.length, rows, missingDates, staleDates };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "summary");
    if (action === "health") {
      getCredentials();
      return json({ ok: true, cache: getSupabaseCredentials().enabled });
    }
    if (action === "listCampaigns") return json({ items: await listCampaigns() });
    if (action === "summary" || action === "campaignSummary") return json(await campaignSummary(body));
    if (action === "collect") return json(await collectAds(body));
    if (action === "coupangUpload") return json(await coupangUpload(body));
    if (action === "coupangSummary") return json(await coupangSummary(body));
    if (action === "coupangSalesUpload") return json(await coupangSalesUpload(body));
    if (action === "coupangSalesSummary") return json(await coupangSalesSummary(body));
    if (action === "coupangSalesMonths") return json(await coupangSalesMonths(body));
    if (action === "coupangItemUpload") return json(await coupangItemUpload(body));
    if (action === "coupangItemPeriods") return json(await coupangItemPeriods());
    if (action === "coupangItemSummary") return json(await coupangItemSummary(body));
    if (action === "coupangProductMapUpload") return json(await coupangProductMapUpload(body));
    if (action === "coupangProductMapAll") return json(await coupangProductMapAll());
    if (action === "naverProductUpload") return json(await naverProductUpload(body));
    if (action === "naverVisitUpload") return json(await naverVisitUpload(body));
    if (action === "naverCustomerUpload") return json(await naverCustomerUpload(body));
    if (action === "naverStatSummary") return json(await naverStatSummary(body));
    if (action === "naverStatMonths") return json(await naverStatMonths(body));
    if (action === "daily") return json(await dailySummary(body));
    if (action === "purchaseDebug") {
      const statDt = String(body.statDt || ymd(new Date(Date.now() + 9 * 3600 * 1000 - 86400000).toISOString().slice(0, 10))).replace(/\D/g, "").slice(0, 8);
      const reportTp = String(body.reportTp || "AD_CONVERSION");
      const result = await fetchPurchaseRowsByDate(statDt, reportTp);
      return json({ statDt, reportTp, note: result.note, rowCount: result.rows.length, sample: result.rows.slice(0, 10) });
    }
    return json({ error: "지원하지 않는 action입니다." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
