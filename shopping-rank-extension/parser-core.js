(function exposeRankParser(root) {
  function toDetailMap(rawValue) {
    try {
      const parsed = typeof rawValue === "string" ? JSON.parse(rawValue || "[]") : rawValue;
      return (Array.isArray(parsed) ? parsed : []).reduce((result, item) => {
        if (item && item.key) result[item.key] = item.value;
        return result;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function isAdRecord(record) {
    let hostname = "";
    try { hostname = new URL(record.href || "", "https://search.shopping.naver.com").hostname; } catch (_) {}
    return record.group === "ad" || record.type === "SA_prod" || /(^|\.)ader\.naver\.com$/i.test(hostname);
  }

  function resolveOrganicRank(rawOrder, pageIndex, localOrganicOrder) {
    const order = Number(rawOrder);
    const page = Math.max(1, Number(pageIndex) || 1);
    if (Number.isFinite(order) && order > 0) {
      return page > 1 && order <= 40 ? (page - 1) * 40 + order : order;
    }
    return (page - 1) * 40 + Math.max(1, Number(localOrganicOrder) || 1);
  }

  function firstValue(record, aliases) {
    if (!record || typeof record !== "object") return "";
    for (const key of aliases) {
      const value = record[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function productShapeScore(record) {
    if (!record || Array.isArray(record) || typeof record !== "object") return 0;
    const title = firstValue(record, ["productTitle", "productName", "prodName", "title"]);
    const productCode = firstValue(record, ["channelProductNo", "chnlProdNo", "chnl_prod_no"]);
    const naverProductId = firstValue(record, ["nvMid", "nv_mid", "catalogNvMid", "catalog_nv_mid"]);
    const price = firstValue(record, ["price", "lowPrice", "salePrice"]);
    const mallName = firstValue(record, ["mallName", "mallNm", "storeName"]);
    const image = firstValue(record, ["imageUrl", "image_url", "image", "imageSrc"]);
    return (title ? 4 : 0)
      + (productCode || naverProductId ? 4 : 0)
      + (price !== "" ? 1 : 0)
      + (mallName ? 1 : 0)
      + (image ? 1 : 0);
  }

  function findBestProductArray(root) {
    const candidates = [];
    const visited = new Set();
    function visit(value, path, depth) {
      if (!value || typeof value !== "object" || depth > 18 || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        const shaped = value.filter((item) => productShapeScore(item) >= 8);
        if (shaped.length) {
          const average = shaped.reduce((sum, item) => sum + productShapeScore(item), 0) / shaped.length;
          const pathBonus = /product|shopping|search|item|list/i.test(path) ? 20 : 0;
          candidates.push({ records: value, path, score: shaped.length * 12 + average + pathBonus });
        }
        value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
        return;
      }
      Object.entries(value).forEach(([key, child]) => visit(child, path ? `${path}.${key}` : key, depth + 1));
    }
    visit(root, "", 0);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function isNextDataAd(record) {
    const group = String(firstValue(record, ["contentsGrp", "contentsGroup", "group", "adGroup"])).toLowerCase();
    const type = String(firstValue(record, ["contentsType", "type", "adType"])).toLowerCase();
    const inventory = String(firstValue(record, ["inventory", "shpInventory"])).toLowerCase();
    const adFlag = firstValue(record, ["isAd", "ad", "advertisement"]);
    const adId = firstValue(record, ["adId", "nadId", "adProductId"]);
    return adFlag === true || adFlag === 1 || adFlag === "Y" || adFlag === "y"
      || group === "ad" || type === "sa_prod" || /^lst\*a/.test(inventory) || !!adId;
  }

  function parseNextDataProducts(root, pageIndex) {
    const candidate = findBestProductArray(root);
    if (!candidate) return { products: [], path: "" };
    const seen = new Set();
    let localOrganicOrder = 0;
    const products = [];
    candidate.records.forEach((record) => {
      if (productShapeScore(record) < 8) return;
      const productCode = String(firstValue(record, ["channelProductNo", "chnlProdNo", "chnl_prod_no"])).trim();
      const naverProductId = String(firstValue(record, ["nvMid", "nv_mid", "catalogNvMid", "catalog_nv_mid"])).trim();
      const key = productCode || naverProductId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      const isAd = isNextDataAd(record);
      if (!isAd) localOrganicOrder += 1;
      const rawOrder = firstValue(record, ["organicExposeOrder", "organic_expose_order", "exposeOrder", "rank"]);
      products.push({
        isAd,
        rank: isAd ? null : resolveOrganicRank(rawOrder, pageIndex, localOrganicOrder),
        productCode,
        naverProductId,
        title: String(firstValue(record, ["productTitle", "productName", "prodName", "title"])),
        price: Number(firstValue(record, ["price", "lowPrice", "salePrice"])) || 0,
        image: String(firstValue(record, ["imageUrl", "image_url", "image", "imageSrc"])),
        link: String(firstValue(record, ["productUrl", "mallProductUrl", "link", "url"])),
        channelNo: String(firstValue(record, ["channelNo", "chnlNo", "chnl_no"])),
        mallName: String(firstValue(record, ["mallName", "mallNm", "storeName"])),
      });
    });
    return { products, path: candidate.path };
  }

  const api = { toDetailMap, isAdRecord, resolveOrganicRank, findBestProductArray, parseNextDataProducts };
  root.RankParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
