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
  try { return new URL(value, location.href).href; } catch (_) { return value || ""; }
}

function extractProducts(pageIndex) {
  const selector = 'a[data-shp-contents-grp][data-shp-contents-dtl]';
  const anchors = [...document.querySelectorAll(selector)];
  const products = [];
  const seen = new Set();
  let localOrganicOrder = 0;

  anchors.forEach((anchor) => {
    const group = anchor.getAttribute("data-shp-contents-grp") || "";
    const type = anchor.getAttribute("data-shp-contents-type") || "";
    const detail = parseDetailAttribute(anchor, "data-shp-contents-dtl");
    const provider = parseDetailAttribute(anchor, "data-shp-contents-provider-dtl");
    const isAd = RankParser.isAdRecord({ group, type, href: anchor.href });
    if (!isAd) localOrganicOrder += 1;

    const productCode = String(detail.chnl_prod_no || "").trim();
    const naverProductId = String(
      detail.catalog_nv_mid || anchor.getAttribute("data-shp-contents-id") || ""
    ).trim();
    const uniqueKey = productCode || naverProductId || anchor.href;
    if (!uniqueKey || seen.has(`${isAd ? "ad" : "prod"}:${uniqueKey}`)) return;
    seen.add(`${isAd ? "ad" : "prod"}:${uniqueKey}`);

    const root = findCardRoot(anchor);
    const image = anchor.querySelector("img");
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
      image: absoluteUrl(image?.currentSrc || image?.src || ""),
      link: absoluteUrl(anchor.href),
      providerId: anchor.getAttribute("data-shp-contents-provider-id") || "",
      channelNo: provider.chnl_no || "",
      cardText: (root?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200),
    });
  });
  return products;
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
    const products = extractProducts(Number(message.pageIndex) || 1);
    const pageText = (document.body?.innerText || "").slice(0, 3000);
    let blockedReason = "";
    if (!products.length && /NAVER\s*로그인|로그인/.test(document.title + pageText)) {
      blockedReason = "네이버 로그인이 필요합니다.";
    } else if (!products.length && /접속이 일시적으로 제한|서비스 이용이 제한/.test(pageText)) {
      blockedReason = "네이버 쇼핑 접속이 제한되었습니다. 잠시 후 다시 시도하세요.";
    } else if (!products.length) {
      blockedReason = "상품 카드를 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.";
    }
    sendResponse({ products, blockedReason, url: location.href, title: document.title });
  })();
  return true;
});
