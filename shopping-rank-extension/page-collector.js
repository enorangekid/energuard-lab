function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (!source || source === "about:blank") return "";
  try { return new URL(source, location.href).href; } catch (_) { return source; }
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
    const detail = parseDetailAttribute(anchor, "data-shp-contents-dtl");
    const isAd = RankParser.isAdRecord({ group, type, href: anchor.href });
    const key = productIdentity(anchor, detail, isAd);
    if (!key || /:$/.test(key)) return;

    const area = anchor.getAttribute("data-shp-area") || "";
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

function extractDomProducts(pageIndex) {
  const anchors = primaryProductAnchors();
  const products = [];
  const seen = new Set();
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

    products.push({
      isAd,
      rank,
      slotRank: Number(anchor.getAttribute("data-shp-contents-rank")) || null,
      productCode,
      naverProductId,
      title: detail.prod_nm || image?.alt || "",
      price: Number(detail.price) || 0,
      image: absoluteUrl(imageSource),
      link: absoluteUrl(anchor.href),
      providerId: anchor.getAttribute("data-shp-contents-provider-id") || "",
      channelNo: provider.chnl_no || "",
      cardText: (root?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200),
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

function productLookupKeys(product) {
  return [product.productCode, product.naverProductId].filter(Boolean).map(String);
}

function mergeNextDataWithDom(nextResult, domProducts, pageIndex) {
  if (!nextResult.products.length) return { products: domProducts, source: "dom", schemaPath: "" };
  const domById = new Map();
  domProducts.forEach((product) => {
    productLookupKeys(product).forEach((key) => domById.set(key, product));
  });

  let matched = 0;
  let localOrganicOrder = 0;
  const merged = nextResult.products.map((product) => {
    const dom = productLookupKeys(product).map((key) => domById.get(key)).find(Boolean);
    if (dom) matched += 1;
    const isAd = dom ? dom.isAd : product.isAd;
    if (!isAd) localOrganicOrder += 1;
    return {
      ...product,
      isAd,
      rank: isAd ? null : RankParser.resolveOrganicRank(dom?.rank || product.rank, pageIndex, localOrganicOrder),
      productCode: product.productCode || dom?.productCode || "",
      naverProductId: product.naverProductId || dom?.naverProductId || "",
      title: product.title || dom?.title || "",
      price: product.price || dom?.price || 0,
      image: absoluteUrl(product.image || dom?.image || ""),
      link: absoluteUrl(product.link || dom?.link || ""),
      providerId: dom?.providerId || "",
      channelNo: product.channelNo || dom?.channelNo || "",
      cardText: dom?.cardText || [product.mallName, product.title].filter(Boolean).join(" "),
    };
  });

  // 추천상품 같은 다른 배열을 고른 경우 검증된 화면 DOM 결과로 자동 복귀합니다.
  const minimumMatches = Math.min(5, Math.max(2, Math.ceil(nextResult.products.length * 0.2)));
  if (domProducts.length && matched < minimumMatches) {
    return { products: domProducts, source: "dom-fallback", schemaPath: nextResult.path };
  }
  return { products: merged, source: "next-data", schemaPath: nextResult.path };
}

function extractProducts(pageIndex) {
  const domProducts = extractDomProducts(pageIndex);
  return mergeNextDataWithDom(readNextDataProducts(pageIndex), domProducts, pageIndex);
}

async function waitForProducts() {
  const started = Date.now();
  while (Date.now() - started < 18000) {
    const count = document.querySelectorAll('a[data-shp-contents-grp][data-shp-contents-dtl]').length;
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
  if (message?.type !== "EXTRACT_PAGE") return false;
  (async () => {
    await waitForProducts();
    const extracted = extractProducts(Number(message.pageIndex) || 1);
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
