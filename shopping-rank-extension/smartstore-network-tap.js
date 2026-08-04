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
