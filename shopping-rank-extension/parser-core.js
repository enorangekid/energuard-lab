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

  const api = { toDetailMap, isAdRecord, resolveOrganicRank };
  root.RankParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
