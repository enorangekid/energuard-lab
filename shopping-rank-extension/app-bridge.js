const APP_REQUEST = "ENERGUARD_SHOPPING_RANK_START";
const APP_RESPONSE = "ENERGUARD_SHOPPING_RANK_RESPONSE";
const APP_PROGRESS = "ENERGUARD_SHOPPING_RANK_PROGRESS";
const TRACKED_ITEMS_REQUEST = "ENERGUARD_TRACKED_ITEMS_START";
const TRACKED_ITEMS_RESPONSE = "ENERGUARD_TRACKED_ITEMS_RESPONSE";
const COUPANG_RECHECK_REQUEST = "ENERGUARD_COUPANG_RECHECK_START";
const COUPANG_RECHECK_RESPONSE = "ENERGUARD_COUPANG_RECHECK_RESPONSE";
const ANALYSIS_REQUEST = "ENERGUARD_KEYWORD_ANALYSIS_START";
const ANALYSIS_RESPONSE = "ENERGUARD_KEYWORD_ANALYSIS_RESPONSE";

function getEnerguardAuthSession() {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const session = value?.currentSession || value;
      if (session?.access_token && session?.refresh_token) {
        return {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: Number(session.expires_at) || 0,
          userId: String(session.user?.id || ""),
        };
      }
    } catch (_) {}
  }
  return null;
}

window.postMessage({ type: "ENERGUARD_SHOPPING_RANK_READY" }, window.location.origin);

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.type === TRACKED_ITEMS_REQUEST) {
    const requestId = String(event.data.requestId || "");
    try {
      chrome.runtime.sendMessage({
        type: "START_TRACKED_ITEMS_COLLECTION",
        pageDelay: event.data.pageDelay,
        authSession: getEnerguardAuthSession(),
      }).then((result) => {
        window.postMessage({ type: TRACKED_ITEMS_RESPONSE, requestId, ...result }, window.location.origin);
      }).catch((error) => {
        window.postMessage({
          type: TRACKED_ITEMS_RESPONSE,
          requestId,
          ok: false,
          error: error?.message || "확장프로그램 연결에 실패했습니다.",
        }, window.location.origin);
      });
    } catch (error) {
      window.postMessage({
        type: TRACKED_ITEMS_RESPONSE,
        requestId,
        ok: false,
        error: "확장프로그램이 갱신되었습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
      }, window.location.origin);
    }
    return;
  }
  if (event.data?.type === COUPANG_RECHECK_REQUEST) {
    const requestId = String(event.data.requestId || "");
    try {
      chrome.runtime.sendMessage({
        type: "START_COUPANG_RECHECK",
        itemIds: event.data.itemIds,
        authSession: getEnerguardAuthSession(),
      }).then((result) => {
        window.postMessage({ type: COUPANG_RECHECK_RESPONSE, requestId, ...result }, window.location.origin);
      }).catch((error) => {
        window.postMessage({
          type: COUPANG_RECHECK_RESPONSE,
          requestId,
          ok: false,
          error: error?.message || "확장프로그램 연결에 실패했습니다.",
        }, window.location.origin);
      });
    } catch (error) {
      window.postMessage({
        type: COUPANG_RECHECK_RESPONSE,
        requestId,
        ok: false,
        error: "확장프로그램이 갱신되었습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
      }, window.location.origin);
    }
    return;
  }
  if (event.data?.type === ANALYSIS_REQUEST) {
    const requestId = String(event.data.requestId || "");
    try {
      chrome.runtime.sendMessage({
        type: "FETCH_KEYWORD_ANALYSIS",
        keyword: event.data.keyword,
        maxRank: event.data.maxRank,
        authSession: getEnerguardAuthSession(),
      }).then((result) => {
        window.postMessage({ type: ANALYSIS_RESPONSE, requestId, ...result }, window.location.origin);
      }).catch((error) => {
        window.postMessage({
          type: ANALYSIS_RESPONSE,
          requestId,
          ok: false,
          error: error?.message || "확장프로그램 연결에 실패했습니다.",
        }, window.location.origin);
      });
    } catch (error) {
      window.postMessage({
        type: ANALYSIS_RESPONSE,
        requestId,
        ok: false,
        error: "확장프로그램이 갱신되었습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
      }, window.location.origin);
    }
    return;
  }
  if (event.data?.type !== APP_REQUEST) return;
  const requestId = String(event.data.requestId || "");
  try {
    chrome.runtime.sendMessage({
      type: "START_COLLECTION_FROM_APP",
      config: event.data.config,
      authSession: getEnerguardAuthSession(),
    }).then((result) => {
      window.postMessage({ type: APP_RESPONSE, requestId, ...result }, window.location.origin);
    }).catch((error) => {
      window.postMessage({
        type: APP_RESPONSE,
        requestId,
        ok: false,
        error: error?.message || "확장프로그램 연결에 실패했습니다.",
      }, window.location.origin);
    });
  } catch (error) {
    window.postMessage({
      type: APP_RESPONSE,
      requestId,
      ok: false,
      error: "확장프로그램이 갱신되었습니다. 키워드 분석 페이지도 새로고침한 뒤 다시 시도하세요.",
    }, window.location.origin);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.shoppingRankProgress?.newValue) return;
  window.postMessage({
    type: APP_PROGRESS,
    state: changes.shoppingRankProgress.newValue,
  }, window.location.origin);
});
