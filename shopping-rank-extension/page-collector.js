function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATUS_HOST_ID = "energuard-shopping-rank-status";

function renderCollectionStatus(state = {}) {
  let host = document.getElementById(STATUS_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = STATUS_HOST_ID;
    host.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box} .panel{width:260px;padding:15px 16px 14px;border:1px solid #394150;border-radius:7px;background:#101318;color:#fff;box-shadow:0 12px 32px rgba(15,23,42,.26);font-family:Pretendard,"Noto Sans KR",Arial,sans-serif;letter-spacing:0}
        .panel.running{border-color:#12a150}.panel.error{border-color:#ef5b2a}.head{display:flex;align-items:center;justify-content:space-between;gap:12px}.title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}.dot{width:9px;height:9px;border:2px solid #101318;border-radius:50%;background:#98a2b3;box-shadow:0 0 0 1px #98a2b3}.running .dot{background:#1ec96b;box-shadow:0 0 0 1px #1ec96b}.error .dot{background:#ef5b2a;box-shadow:0 0 0 1px #ef5b2a}.count{color:#cbd2dc;font-size:11px;font-weight:750}.keyword{margin:12px 0 0;color:#f5f7fa;font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail{margin:6px 0 0;color:#aeb8c6;font-size:10px;line-height:1.45}.track{height:4px;margin-top:11px;overflow:hidden;border-radius:5px;background:#2b313b}.bar{display:block;width:0;height:100%;background:#1ec96b;transition:width .2s ease}.error .bar{background:#ef5b2a}.meta{display:flex;justify-content:space-between;gap:10px;margin-top:8px;color:#7f8998;font-size:9px}.source{color:#aeb8c6}
      </style>
      <section class="panel running">
        <div class="head"><div class="title"><i class="dot"></i><span class="titleText">에너가드랩 수집 중</span></div><span class="count">0/0</span></div>
        <p class="keyword"></p><p class="detail"></p><div class="track"><i class="bar"></i></div>
        <div class="meta"><span class="source"></span><span class="page"></span></div>
      </section>`;
    document.documentElement.appendChild(host);
  }

  const root = host.shadowRoot;
  const panel = root.querySelector(".panel");
  const status = state.status || "running";
  panel.className = `panel ${status}`;
  root.querySelector(".titleText").textContent = status === "error" ? "수집 확인 필요" : "에너가드랩 수집 중";
  root.querySelector(".count").textContent = `${state.completed || 0}/${state.total || 0}`;
  root.querySelector(".keyword").textContent = state.keyword || "상품 정보를 확인하고 있습니다.";
  root.querySelector(".detail").textContent = state.message || "네이버 쇼핑 일반 검색 결과를 분석하고 있습니다.";
  const ratio = state.total ? Math.min(100, Math.max(0, (state.completed || 0) / state.total * 100)) : 0;
  root.querySelector(".bar").style.width = `${ratio}%`;
  root.querySelector(".source").textContent = state.source || "";
  root.querySelector(".page").textContent = state.pageIndex && state.pageCount
    ? `${state.pageIndex}/${state.pageCount}페이지`
    : "";
}

function parseDetailAttribute(element, name) {
  return RankParser.toDetailMap(element.getAttribute(name) || "[]");
}

function findCardRoot(anchor) {
  const direct = anchor.closest("li");
  if (direct) return direct;
  let node = anchor.parentElement;
  for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
    const productAnchors = node.querySelectorAll('a[data-shp-contents-grp="prod"], a[data-shp-contents-grp="ad"]');
    if (productAnchors.length === 1 && (node.innerText || "").trim().length > 20) return node;
  }
  return anchor.parentElement;
}

function absoluteUrl(value) {
  const source = String(value || "").trim();
  if (!source || source === "about:blank" || source.startsWith("#") || /^javascript:/i.test(source)) return "";
  try { return new URL(source, location.href).href; } catch (_) { return source; }
}

function normalizeStoreName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase("ko-KR");
}

function readCount(text, labels) {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*([0-9,]+)`, "i");
  const match = String(text || "").match(pattern);
  return match ? Number(match[1].replace(/,/g, "")) || 0 : 0;
}

function findStoreName(root, storeName) {
  const target = normalizeStoreName(storeName);
  if (!root) return "";

  const candidates = root.querySelectorAll(
    '[data-shp-area*="mall"], [data-shp-area-id="mall"], [class*="mall"], [class*="seller"], [class*="store"], a, span'
  );
  for (const element of candidates) {
    const text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 60) continue;
    if (target && normalizeStoreName(text) === target) return text;
  }

  const sellerCandidates = root.querySelectorAll(
    '[data-shp-area*="mall"], [data-shp-area-id="mall"], [class*="mallName"], [class*="mall_name"], [class*="seller"], [class*="storeName"]'
  );
  for (const element of sellerCandidates) {
    const text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (text && text.length <= 60) return text;
  }
  return "";
}

function productIdentity(anchor, detail, isAd) {
  const productCode = String(detail.chnl_prod_no || "").trim();
  const naverProductId = String(
    anchor.getAttribute("data-shp-contents-id") || detail.catalog_nv_mid || ""
  ).trim();
  return `${isAd ? "ad" : "prod"}:${naverProductId || productCode || anchor.href}`;
}

function primaryProductAnchors() {
  const selector = 'a[data-shp-contents-grp][data-shp-contents-dtl]';
  const selected = new Map();

  [...document.querySelectorAll(selector)].forEach((anchor, index) => {
    const group = anchor.getAttribute("data-shp-contents-grp") || "";
    const type = anchor.getAttribute("data-shp-contents-type") || "";
    const inventory = anchor.getAttribute("data-shp-inventory") || "";
    const area = anchor.getAttribute("data-shp-area") || "";
    if (!RankParser.isMainListSlot({ group, inventory, area })) return;
    const detail = parseDetailAttribute(anchor, "data-shp-contents-dtl");
    const isAd = RankParser.isAdRecord({ group, type, href: anchor.href });
    const key = productIdentity(anchor, detail, isAd);
    if (!key || /:$/.test(key)) return;

    const image = anchor.querySelector("img");
    const score = (/\.img$/i.test(area) ? 100 : 0)
      + (image ? 50 : 0)
      + (detail.organic_expose_order ? 20 : 0)
      + (detail.prod_nm ? 10 : 0)
      + (detail.chnl_prod_no ? 5 : 0);
    const current = selected.get(key);
    if (!current || score > current.score) selected.set(key, { anchor, score, index });
  });

  return [...selected.values()].sort((a, b) => a.index - b.index).map((item) => item.anchor);
}

function extractDomProducts(pageIndex, storeName) {
  const anchors = primaryProductAnchors();
  const products = [];
  const seen = new Set();
  const target = normalizeStoreName(storeName);
  let localOrganicOrder = 0;

  anchors.forEach((anchor) => {
    const group = anchor.getAttribute("data-shp-contents-grp") || "";
    const type = anchor.getAttribute("data-shp-contents-type") || "";
    const detail = parseDetailAttribute(anchor, "data-shp-contents-dtl");
    const provider = parseDetailAttribute(anchor, "data-shp-contents-provider-dtl");
    const isAd = RankParser.isAdRecord({ group, type, href: anchor.href });
    const productCode = String(detail.chnl_prod_no || "").trim();
    const naverProductId = String(
      detail.catalog_nv_mid || anchor.getAttribute("data-shp-contents-id") || ""
    ).trim();
    const uniqueKey = productCode || naverProductId || anchor.href;
    if (!uniqueKey || seen.has(`${isAd ? "ad" : "prod"}:${uniqueKey}`)) return;
    seen.add(`${isAd ? "ad" : "prod"}:${uniqueKey}`);
    if (!isAd) localOrganicOrder += 1;

    const root = findCardRoot(anchor);
    const mallName = detail.chnl_prod_nm || findStoreName(root, storeName);
    const image = anchor.querySelector("img");
    const imageSource = image?.currentSrc
      || image?.getAttribute("src")
      || image?.getAttribute("data-src")
      || image?.getAttribute("data-original")
      || "";
    let rank = null;
    if (!isAd) {
      rank = RankParser.resolveOrganicRank(detail.organic_expose_order, pageIndex, localOrganicOrder);
    }

    const cardText = (root?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    products.push({
      isAd,
      rank,
      pagePosition: products.length + 1,
      slotRank: Number(anchor.getAttribute("data-shp-contents-rank")) || null,
      productCode,
      naverProductId,
      title: detail.prod_nm || image?.alt || "",
      price: Number(detail.price) || 0,
      image: absoluteUrl(imageSource),
      link: absoluteUrl(anchor.href),
      providerId: anchor.getAttribute("data-shp-contents-provider-id") || "",
      channelNo: provider.chnl_no || "",
      mallName,
      storeMatched: !!target && normalizeStoreName(mallName) === target,
      cardText,
      shippingFee: readCount(cardText, ["배송비"]),
      purchaseCount: readCount(cardText, ["구매", "판매"]),
      reviewCount: readCount(cardText, ["리뷰", "후기"]),
      registrationDate: "",
      brand: "",
      maker: "",
      categoryPath: detail.exhibition_category || "",
      specs: [],
      tags: [],
    });
  });
  return products;
}

function readNextDataProducts(pageIndex) {
  const script = document.getElementById("__NEXT_DATA__");
  if (!script?.textContent?.trim()) return { products: [], path: "" };
  try {
    return RankParser.parseNextDataProducts(JSON.parse(script.textContent), pageIndex);
  } catch (_) {
    return { products: [], path: "" };
  }
}

function mergeNextDataWithDom(nextResult, domProducts, pageIndex) {
  if (!nextResult.products.length) return { products: domProducts, source: "dom", schemaPath: "" };
  const merged = RankParser.mergeProductSources(nextResult.products, domProducts).map((product) => ({
    ...product,
    image: absoluteUrl(product.image || ""),
    link: absoluteUrl(product.link || ""),
    cardText: product.cardText || [product.mallName, product.title].filter(Boolean).join(" "),
  }));
  const domIds = new Set(domProducts.flatMap((product) => [product.productCode, product.naverProductId]).filter(Boolean));
  const matched = nextResult.products.some((product) =>
    [product.productCode, product.naverProductId].filter(Boolean).some((key) => domIds.has(key))
  );

  return {
    products: merged,
    source: matched ? "next-data+dom" : "next-data",
    schemaPath: nextResult.path,
  };
}

function extractProducts(pageIndex, storeName) {
  const domProducts = extractDomProducts(pageIndex, storeName);
  return mergeNextDataWithDom(readNextDataProducts(pageIndex), domProducts, pageIndex);
}

function mergeDomSnapshots(snapshots) {
  const byKey = new Map();
  snapshots.flat().forEach((product) => {
    const identity = product.productCode || product.naverProductId;
    if (!identity) return;
    const key = `${product.isAd ? "ad" : "prod"}:${identity}`;
    const current = byKey.get(key);
    byKey.set(key, {
      ...(current || {}),
      ...product,
      rank: product.rank || current?.rank || null,
      image: product.image || current?.image || "",
      link: product.link || current?.link || "",
      title: product.title || current?.title || "",
      mallName: product.mallName || current?.mallName || "",
      cardText: product.cardText || current?.cardText || "",
      storeMatched: !!(product.storeMatched || current?.storeMatched),
    });
  });
  return [...byKey.values()].sort((a, b) => {
    if (a.isAd !== b.isAd) return a.isAd ? -1 : 1;
    const rankA = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER;
    const rankB = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });
}

async function collectDomProductsAcrossPage(pageIndex, storeName) {
  const snapshots = [];
  const viewport = Math.max(600, window.innerHeight || 800);
  const scrollStep = Math.max(360, Math.floor(viewport * 0.55));
  let lastHeight = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    for (let top = 0; top < height; top += scrollStep) {
      window.scrollTo(0, top);
      await sleep(240);
      snapshots.push(extractDomProducts(pageIndex, storeName));
    }
    window.scrollTo(0, height);
    await sleep(650);
    snapshots.push(extractDomProducts(pageIndex, storeName));
    const nextHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    if (nextHeight <= height || nextHeight === lastHeight) break;
    lastHeight = height;
  }
  window.scrollTo(0, 0);
  await sleep(240);
  snapshots.push(extractDomProducts(pageIndex, storeName));
  return mergeDomSnapshots(snapshots);
}

async function waitForProducts() {
  const started = Date.now();
  while (Date.now() - started < 18000) {
    const count = document.querySelectorAll(
      'a[data-shp-inventory="lst*N"][data-shp-area="lst*N.img"], a[data-shp-inventory="lst*A"][data-shp-area="lst*A.img"]'
    ).length;
    if (count) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      await sleep(900);
      window.scrollTo({ top: 0, behavior: "instant" });
      await sleep(250);
      return;
    }
    await sleep(500);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SHOW_COLLECTION_STATUS") {
    renderCollectionStatus(message.state || {});
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type !== "EXTRACT_PAGE") return false;
  (async () => {
    await waitForProducts();
    const pageIndex = Number(message.pageIndex) || 1;
    const storeName = message.storeName || "";
    const domProducts = await collectDomProductsAcrossPage(pageIndex, storeName);
    const extracted = mergeNextDataWithDom(readNextDataProducts(pageIndex), domProducts, pageIndex);
    const products = extracted.products;
    const pageText = (document.body?.innerText || "").slice(0, 3000);
    let blockedReason = "";
    if (!products.length && /NAVER\s*로그인|로그인/.test(document.title + pageText)) {
      blockedReason = "네이버 로그인이 필요합니다.";
    } else if (!products.length && /접속이 일시적으로 제한|서비스 이용이 제한/.test(pageText)) {
      blockedReason = "네이버 쇼핑 접속이 제한되었습니다. 잠시 후 다시 시도하세요.";
    } else if (!products.length) {
      blockedReason = "상품 카드를 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.";
    }
    sendResponse({
      products,
      blockedReason,
      extractionSource: extracted.source,
      schemaPath: extracted.schemaPath,
      url: location.href,
      title: document.title,
    });
  })();
  return true;
});
