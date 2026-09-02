/* ===============================================================
   smartstore-network-tap.js — 경쟁사 스마트스토어 상품 페이지 전용
   search-network-tap.js와 완전히 같은 기법(fetch/XHR monkey-patch로 페이지가
   자기 자신에게 쏘는 JSON 응답을 가로채서 postMessage로 공개)을 상품 상세페이지에
   재사용한다. 옵션(두께 등)을 고를 때 페이지가 내부적으로 가격을 다시 불러오는
   API가 있을 걸로 예상되는데, 그 API 응답 모양을 아직 몰라서(2026-09-02, 로그인
   세션이 있어야 접근 가능해서 서버에서 미리 확인 불가) 지금은 "일단 다 잡아서
   보여주는" 진단 모드로 만들어둠 — 실제 필터/파서는 이걸로 실제 응답을 한 번 본
   뒤에 채워넣을 예정.
   MAIN world에서 document_start에 실행 (search-network-tap.js와 동일 패턴). */
(function () {
  const SOURCE = "energuard-smartstore-network";

  function publish(url, data) {
    try {
      window.postMessage({ source: SOURCE, url: String(url || ""), data }, "*");
    } catch (_) {}
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const clone = response.clone();
      const type = clone.headers.get("content-type") || "";
      if (type.includes("json")) publish(clone.url || args[0], await clone.json());
    } catch (_) {}
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__energuardUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const type = this.getResponseHeader("content-type") || "";
        if (!type.includes("json") && typeof this.responseText !== "string") return;
        const data = typeof this.response === "object" && this.response
          ? this.response
          : JSON.parse(this.responseText);
        publish(this.responseURL || this.__energuardUrl, data);
      } catch (_) {}
    }, { once: true });
    return originalSend.apply(this, args);
  };
})();
