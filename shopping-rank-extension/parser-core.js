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

  function isMainListSlot(record) {
    const inventory = String(record?.inventory || "");
    const area = String(record?.area || "");
    const group = String(record?.group || "");
    if (!/^lst\*[NA]$/i.test(inventory)) return false;
    if (!/^lst\*[NA]\.img$/i.test(area)) return false;
    return group === "prod" || group === "ad";
  }

  function firstValue(record, aliases) {
    if (!record || typeof record !== "object") return "";
    for (const key of aliases) {
      const value = record[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function unwrapProductRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const item = record.item;
    if (!item || typeof item !== "object" || Array.isArray(item)) return record;
    return { ...record, ...item };
  }

  function asStringList(value) {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) {
      return [...new Set(value.flatMap(asStringList).map((item) => item.trim()).filter(Boolean))];
    }
    if (typeof value === "object") {
      return [...new Set(Object.values(value).flatMap(asStringList).map((item) => item.trim()).filter(Boolean))];
    }
    return [...new Set(String(value).split(/[,|>]/).map((item) => item.trim()).filter(Boolean))];
  }

  function metadataKey(value) {
    return String(value || "").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("ko-KR");
  }

  function numberValue(record, aliases) {
    const raw = firstValue(record, aliases);
    const value = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  }

  function productMetadata(record) {
    record = unwrapProductRecord(record);
    const categories = [1, 2, 3, 4]
      .map((index) => firstValue(record, [
        `category${index}Name`, `category${index}Nm`, `category${index}`,
      ]))
      .map(String)
      .filter(Boolean);
    const brand = String(firstValue(record, ["brandName", "brandNm", "brand"]));
    const maker = String(firstValue(record, ["makerName", "makerNm", "maker"]));
    const excludedSpecs = new Set([brand, maker].map(metadataKey).filter(Boolean));
    const specs = asStringList(firstValue(record, [
      "characterValue", "characteristic", "characteristics", "spec", "specs", "attributeValue", "attributeValues",
    ])).filter((value) => !excludedSpecs.has(metadataKey(value)));
    const nestedTerms = record?.nluInfo?.nluTerms;
    const tags = asStringList(firstValue(record, [
      "manuTag", "manuTags", "searchTag", "searchTags", "terms", "nluTerms", "keepWord", "tags", "tagList",
    ]) || nestedTerms);
    return {
      shippingFee: numberValue(record, ["deliveryFeeContent", "deliveryFee", "shippingFee", "deliveryPrice", "baseDeliveryFee"]),
      purchaseCount: numberValue(record, [
        "purchaseCnt", "purchaseCount", "sixMonthPurchaseCount", "purchaseCnt6m", "salesAmount", "recentSaleCount", "saleCount",
      ]),
      reviewCount: numberValue(record, ["reviewCount", "reviewCountLog", "reviewCnt", "reviewCntSum", "totalReviewCount"]),
      registrationDate: String(firstValue(record, ["openDate", "registrationDate", "registeredDate", "productOpenDate"])),
      brand,
      maker,
      categoryPath: categories.join(" > "),
      specs,
      tags,
    };
  }

  function productShapeScore(record) {
    if (!record || Array.isArray(record) || typeof record !== "object") return 0;
    record = unwrapProductRecord(record);
    const title = firstValue(record, ["productTitle", "productName", "prodName", "title"]);
    const productCode = firstValue(record, ["channelProductNo", "chnlProdNo", "chnl_prod_no", "productId", "id"]);
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

  function findProductArrays(root) {
    const candidates = [];
    const visited = new Set();
    function visit(value, path, depth) {
      if (!value || typeof value !== "object" || depth > 18 || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        const shaped = value.filter((item) => productShapeScore(item) >= 8);
        if (shaped.length) candidates.push({ records: value, path, shapedCount: shaped.length });
        value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
        return;
      }
      Object.entries(value).forEach(([key, child]) => visit(child, path ? `${path}.${key}` : key, depth + 1));
    }
    visit(root, "", 0);
    return candidates;
  }

  function isNextDataAd(record) {
    record = unwrapProductRecord(record);
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
    const enrichment = new Map();
    findProductArrays(root).forEach(({ records }) => {
      records.forEach((rawRecord) => {
        if (productShapeScore(rawRecord) < 8) return;
        const record = unwrapProductRecord(rawRecord);
        const keys = [
          firstValue(record, ["channelProductNo", "chnlProdNo", "chnl_prod_no", "productId", "id"]),
          firstValue(record, ["nvMid", "nv_mid", "catalogNvMid", "catalog_nv_mid", "productId", "id"]),
        ].filter(Boolean).map(String);
        keys.forEach((key) => {
          const current = enrichment.get(key) || {};
          enrichment.set(key, { ...current, ...record });
        });
      });
    });
    const seen = new Set();
    let localOrganicOrder = 0;
    const products = [];
    candidate.records.forEach((rawBaseRecord, pagePosition) => {
      const baseRecord = unwrapProductRecord(rawBaseRecord);
      const baseCode = String(firstValue(baseRecord, ["channelProductNo", "chnlProdNo", "chnl_prod_no", "productId", "id"])).trim();
      const baseNaverId = String(firstValue(baseRecord, ["nvMid", "nv_mid", "catalogNvMid", "catalog_nv_mid", "productId", "id"])).trim();
      const record = unwrapProductRecord(enrichment.get(baseCode) || enrichment.get(baseNaverId) || baseRecord);
      if (productShapeScore(record) < 8) return;
      const productCode = String(firstValue(record, ["channelProductNo", "chnlProdNo", "chnl_prod_no"])).trim();
      const naverProductId = String(firstValue(record, ["nvMid", "nv_mid", "catalogNvMid", "catalog_nv_mid", "productId", "id"])).trim();
      const key = productCode || naverProductId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      const isAd = isNextDataAd(record);
      if (!isAd) localOrganicOrder += 1;
      const rawOrder = firstValue(record, ["organicExposeOrder", "organic_expose_order", "exposeOrder", "rank"]);
      const metadata = productMetadata(record);
      products.push({
        isAd,
        rank: isAd ? null : resolveOrganicRank(rawOrder, pageIndex, localOrganicOrder),
        pagePosition: pagePosition + 1,
        productCode,
        naverProductId,
        title: String(firstValue(record, ["productTitle", "productName", "prodName", "title"])),
        price: Number(firstValue(record, ["price", "lowPrice", "salePrice"])) || 0,
        image: String(firstValue(record, ["imageUrl", "image_url", "image", "imageSrc", "imageUrlLow"])),
        link: String(firstValue(record, ["productUrl", "mallProductUrl", "crUrl", "link", "url"])),
        channelNo: String(firstValue(record, ["channelNo", "chnlNo", "chnl_no"])),
        providerId: String(firstValue(record, ["providerId", "mallSeq", "mallNo", "provider_id"])),
        mallName: String(firstValue(record, ["mallName", "mallNm", "storeName"])),
        ...metadata,
      });
    });
    return { products, path: candidate.path };
  }

  function productKeys(product) {
    return [product?.productCode, product?.naverProductId]
      .filter(Boolean)
      .map(String);
  }

  function mergeProductSources(nextProducts, domProducts) {
    const nextList = Array.isArray(nextProducts) ? nextProducts : [];
    const domList = Array.isArray(domProducts) ? domProducts : [];
    const domById = new Map();
    domList.forEach((product) => {
      productKeys(product).forEach((key) => domById.set(key, product));
    });

    const usedDom = new Set();
    const merged = nextList.map((next) => {
      const dom = productKeys(next).map((key) => domById.get(key)).find(Boolean);
      if (!dom) return { ...next };
      usedDom.add(dom);
      return {
        ...next,
        ...dom,
        isAd: dom.isAd,
        rank: Number.isFinite(dom.rank) ? dom.rank : next.rank,
        productCode: dom.productCode || next.productCode || "",
        naverProductId: dom.naverProductId || next.naverProductId || "",
        title: dom.title || next.title || "",
        price: dom.price || next.price || 0,
        image: dom.image || next.image || "",
        link: dom.link || next.link || "",
        channelNo: dom.channelNo || next.channelNo || "",
        providerId: dom.providerId || next.providerId || "",
        mallName: dom.mallName || next.mallName || "",
        shippingFee: dom.shippingFee || next.shippingFee || 0,
        purchaseCount: dom.purchaseCount || next.purchaseCount || 0,
        reviewCount: dom.reviewCount || next.reviewCount || 0,
        registrationDate: dom.registrationDate || next.registrationDate || "",
        brand: dom.brand || next.brand || "",
        maker: dom.maker || next.maker || "",
        categoryPath: dom.categoryPath || next.categoryPath || "",
        specs: dom.specs?.length ? dom.specs : (next.specs || []),
        tags: dom.tags?.length ? dom.tags : (next.tags || []),
        storeMatched: !!dom.storeMatched,
      };
    });

    domList.forEach((product) => {
      if (!usedDom.has(product)) merged.push({ ...product });
    });
    return merged;
  }

  const api = {
    toDetailMap,
    isAdRecord,
    resolveOrganicRank,
    isMainListSlot,
    findBestProductArray,
    findProductArrays,
    productMetadata,
    unwrapProductRecord,
    parseNextDataProducts,
    mergeProductSources,
  };
  root.RankParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
