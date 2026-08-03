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
  if (!source || source === "about:blank" || source.startsWith("#") || /^javascript:/i.test(source)) return "";
  try { return new URL(source, location.href).href; } catch (_) { return source; }
}

function normalizeStoreName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase("ko-KR");
}

function findStoreName(root, storeName) {
  const target = normalizeStoreName(storeName);
  if (!root || !target) return "";

  const candidates = root.querySelectorAll(
    '[data-shp-area*="mall"], [data-shp-area-id="mall"], [class*="mall"], [class*="seller"], [class*="store"], a, span'
  );
  for (const element of candidates) {
    const text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 60) continue;
    if (normalizeStoreName(text) === target) return text;
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
    const mallName = findStoreName(root, storeName);
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
      mallName,
      storeMatched: !!mallName,
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
  if (message?.type !== "EXTRACT_PAGE") return false;
  (async () => {
    await waitForProducts();
    const extracted = extractProducts(Number(message.pageIndex) || 1, message.storeName || "");
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
