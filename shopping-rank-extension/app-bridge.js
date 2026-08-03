const APP_REQUEST = "ENERGUARD_SHOPPING_RANK_START";
const APP_RESPONSE = "ENERGUARD_SHOPPING_RANK_RESPONSE";
const APP_PROGRESS = "ENERGUARD_SHOPPING_RANK_PROGRESS";

window.postMessage({ type: "ENERGUARD_SHOPPING_RANK_READY" }, window.location.origin);

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.type !== APP_REQUEST) return;
  const requestId = String(event.data.requestId || "");
  chrome.runtime.sendMessage({
    type: "START_COLLECTION_FROM_APP",
    config: event.data.config,
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
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.shoppingRankProgress?.newValue) return;
  window.postMessage({
    type: APP_PROGRESS,
    state: changes.shoppingRankProgress.newValue,
  }, window.location.origin);
});
