(function () {
  const SMARTSTORE_IMPORT_KEY = "smartstoreRankImportJob";
  const FRAME_RESULT_SOURCE = "energuard-smartstore-frame-result";
  const NETWORK_SOURCE = "energuard-smartstore-network";
  const frameResults = new Map();
  const networkPayloads = [];
  const frameId = `${location.href}:${Math.random().toString(36).slice(2)}`;
  const PAGE_RANK_RE = /(\d+)\s*페이지\s*(\d+)\s*위/;
  const STATUS_RE = /^(유지|진입|이탈|상승|하락|신규|▲\s*\d+|▼\s*\d+)$/;

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function linesOf(element) {
    return String(element?.innerText || "")
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function productCodeFrom(row) {
    const values = [
      ...Array.from(row.querySelectorAll("a[href]")).map((item) => item.href),
      ...Array.from(row.querySelectorAll("[data-product-no], [data-product-id], [data-channel-product-no]"))
        .flatMap((item) => [item.dataset.productNo, item.dataset.productId, item.dataset.channelProductNo]),
    ];
    for (const value of values) {
      const text = String(value || "");
      const code = text.match(/\/products\/(\d+)/)?.[1]
        || text.match(/[?&#](?:productNo|channelProductNo|productId)=([0-9]+)/i)?.[1];
      if (code) return code;
    }
    return "";
  }

  function findProductRow(rankElement) {
    let node = rankElement.parentElement;
    let best = null;
    while (node && node !== document.body) {
      const text = String(node.innerText || "");
      const pageMatches = text.match(/\d+\s*페이지\s*\d+\s*위/g) || [];
      const images = Array.from(node.querySelectorAll("img")).filter(visible);
      if (images.length && pageMatches.length) {
        best = node;
        if (pageMatches.length >= 2 || node.matches("tr, [role='row']")) break;
      }
      if (text.length > 10000) break;
      node = node.parentElement;
    }
    return best;
  }

  function findKeywordCard(rankElement, row) {
    let node = rankElement;
    let best = rankElement.parentElement;
    while (node.parentElement && node.parentElement !== row) {
      const parent = node.parentElement;
      const text = String(parent.innerText || "");
      const matches = text.match(/\d+\s*페이지\s*\d+\s*위/g) || [];
      if (matches.length !== 1 || text.length > 220) break;
      best = parent;
      node = parent;
    }
    return best;
  }

  function keywordFrom(card, pageLine) {
    const lines = linesOf(card);
    const pageIndex = lines.findIndex((line) => line.includes(pageLine));
    const candidates = lines.slice(0, pageIndex < 0 ? lines.length : pageIndex).filter((line) => {
      if (PAGE_RANK_RE.test(line) || STATUS_RE.test(line) || /^\d+$/.test(line)) return false;
      return !/^(키워드 순위|카테고리 순위|1페이지)$/.test(line);
    });
    return candidates[0] || "";
  }

  function productNameFrom(row) {
    const image = Array.from(row.querySelectorAll("img[alt]"))
      .filter(visible)
      .find((item) => String(item.alt || "").trim().length >= 4);
    if (image) return String(image.alt).trim();

    const links = Array.from(row.querySelectorAll("a[href]"))
      .filter(visible)
      .map((item) => ({ item, text: String(item.innerText || "").replace(/\s+/g, " ").trim() }))
      .filter(({ text }) => text.length >= 6 && !PAGE_RANK_RE.test(text));
    return links.sort((a, b) => b.text.length - a.text.length)[0]?.text || "";
  }

  function extract() {
    const leafRanks = Array.from(document.querySelectorAll("body *")).filter((element) => {
      if (!visible(element)) return false;
      const text = String(element.innerText || "").trim();
      if (!PAGE_RANK_RE.test(text)) return false;
      return !Array.from(element.children).some((child) => PAGE_RANK_RE.test(String(child.innerText || "")));
    });

    const products = new Map();
    const seenCards = new Set();
    leafRanks.forEach((rankElement) => {
      const pageMatch = String(rankElement.innerText || "").match(PAGE_RANK_RE);
      if (!pageMatch) return;
      const row = findProductRow(rankElement);
      if (!row) return;
      const card = findKeywordCard(rankElement, row);
      const pageLine = pageMatch[0];
      const keyword = keywordFrom(card, pageLine);
      if (!keyword) return;
      const page = Number(pageMatch[1]);
      const pageRank = Number(pageMatch[2]);
      const rank = (page - 1) * 40 + pageRank;
      const productName = productNameFrom(row);
      const productCode = productCodeFrom(row);
      const rowKey = productCode || productName;
      if (!rowKey) return;
      const cardKey = `${rowKey}\n${keyword}`;
      if (seenCards.has(cardKey)) return;
      seenCards.add(cardKey);

      if (!products.has(rowKey)) {
        const image = Array.from(row.querySelectorAll("img[src]"))
          .filter(visible)
          .find((item) => !/logo|icon/i.test(String(item.src || "")));
        products.set(rowKey, {
          productCode,
          productName,
          productImage: image?.src || "",
          keywords: [],
        });
      }
      products.get(rowKey).keywords.push({ keyword, rank, page, pageRank });
    });

    return {
      ok: products.size > 0,
      products: [...products.values()],
      debug: { rankElements: leafRanks.length, productCount: products.size },
      error: products.size ? "" : "현재 화면에서 순위 행을 찾지 못했습니다. 상품 목록이 표시된 상태인지 확인하세요.",
    };
  }

  function mergeProducts(groups) {
    const merged = new Map();
    groups.flat().forEach((product) => {
      const key = String(product?.productCode || product?.productName || "").trim();
      if (!key) return;
      if (!merged.has(key)) merged.set(key, { ...product, keywords: [] });
      const target = merged.get(key);
      const seen = new Set(target.keywords.map((item) => `${item.keyword}\n${item.rank}`));
      (product.keywords || []).forEach((item) => {
        const itemKey = `${item.keyword}\n${item.rank}`;
        if (!seen.has(itemKey)) {
          seen.add(itemKey);
          target.keywords.push(item);
        }
      });
      if (!target.productImage && product.productImage) target.productImage = product.productImage;
      if (!target.productCode && product.productCode) target.productCode = product.productCode;
    });
    return [...merged.values()];
  }

  function firstValue(object, keys) {
    for (const key of keys) {
      const value = object?.[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function numberValue(value) {
    const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function productsFromNetwork() {
    const products = new Map();
    const visited = new WeakSet();
    const codeKeys = ["channelProductNo", "channelProductId", "productNo", "productId", "productCode"];
    const nameKeys = ["productName", "channelProductName", "productTitle", "name"];
    const imageKeys = ["representativeImageUrl", "imageUrl", "productImageUrl", "thumbnailUrl"];
    const keywordKeys = ["keyword", "keywordName", "searchKeyword", "query"];
    const rankKeys = ["currentRank", "searchRank", "keywordRank", "ranking", "rank"];
    const pageKeys = ["page", "pageNo", "pageIndex"];
    const pageRankKeys = ["rankInPage", "pageRank", "position"];

    function visit(value, inherited = {}) {
      if (!value || typeof value !== "object") return;
      if (visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, inherited));
        return;
      }

      const context = {
        productCode: String(firstValue(value, codeKeys) || inherited.productCode || "").trim(),
        productName: String(firstValue(value, nameKeys) || inherited.productName || "").trim(),
        productImage: String(firstValue(value, imageKeys) || inherited.productImage || "").trim(),
      };
      const keyword = String(firstValue(value, keywordKeys) || "").trim();
      const page = numberValue(firstValue(value, pageKeys));
      const pageRank = numberValue(firstValue(value, pageRankKeys));
      let rank = numberValue(firstValue(value, rankKeys));
      if (!rank && page > 0 && pageRank > 0) rank = (page - 1) * 40 + pageRank;

      if ((context.productCode || context.productName) && keyword && rank > 0) {
        const key = context.productCode || context.productName;
        if (!products.has(key)) products.set(key, { ...context, keywords: [] });
        const target = products.get(key);
        if (!target.keywords.some((item) => item.keyword === keyword && item.rank === rank)) {
          target.keywords.push({ keyword, rank, page, pageRank });
        }
      }
      Object.values(value).forEach((child) => visit(child, context));
    }

    networkPayloads.forEach((payload) => visit(payload.data));
    return [...products.values()].filter((product) => product.keywords.length);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function textOf(element) {
    return String(element?.innerText || element?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function waitFor(getter, timeout = 20000, interval = 180) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const value = getter();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  async function waitForChange(getter, previous, timeout = 20000) {
    return waitFor(() => {
      const value = getter();
      return value && value !== previous ? value : null;
    }, timeout);
  }

  function managerMoreButtons() {
    return [...document.querySelectorAll("button")]
      .filter((button) => textOf(button).includes("내상품 키워드 더보기"));
  }

  function managerRowKey(button) {
    const row = button?.closest("li");
    const image = row?.querySelector("img[src]");
    return `${textOf(row).slice(0, 240)}\n${image?.src || ""}`;
  }

  function managerScrollContainer(button) {
    let node = button?.closest("li")?.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 8) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  async function revealMoreManagerRows(seenRowKeys) {
    const buttons = managerMoreButtons();
    const lastButton = buttons.at(-1);
    if (!lastButton) return false;
    const container = managerScrollContainer(lastButton);
    const before = buttons.map(managerRowKey).join("\n---\n");
    lastButton.scrollIntoView({ block: "end" });
    if (container === document.scrollingElement || container === document.documentElement) {
      window.scrollBy(0, Math.max(480, window.innerHeight * 0.8));
    } else {
      container.scrollTop += Math.max(480, container.clientHeight * 0.8);
    }
    return Boolean(await waitFor(() => {
      const currentButtons = managerMoreButtons();
      const hasUnseen = currentButtons.some((button) => !seenRowKeys.has(managerRowKey(button)));
      const signatureChanged = currentButtons.map(managerRowKey).join("\n---\n") !== before;
      return hasUnseen || signatureChanged;
    }, 6000));
  }

  function isManagerDetail() {
    return [...document.querySelectorAll("p")]
      .some((paragraph) => textOf(paragraph).includes("채널 상품 번호"));
  }

  function managerListSignature() {
    const item = managerMoreButtons()[0]?.closest("li");
    return textOf(item).slice(0, 180);
  }

  function managerRankTable() {
    return [...document.querySelectorAll("table")].find((table) => {
      const header = textOf(table.querySelector("thead") || table);
      return header.includes("키워드")
        && header.includes("내 상품 검색순위")
        && header.includes("주요 카테고리");
    }) || null;
  }

  function managerDetailSignature() {
    const row = managerRankTable()?.querySelector("tbody tr");
    return textOf(row).slice(0, 160);
  }

  function managerPaginationButton(labelText, firstPage = false) {
    const nav = [...document.querySelectorAll("nav")].find((item) =>
      String(item.getAttribute("aria-label") || "").includes("페이지")
    );
    if (!nav) return null;
    return [...nav.querySelectorAll("button")].find((button) => {
      const label = String(button.getAttribute("aria-label") || "");
      if (firstPage) return label.startsWith("1페이지");
      return label.includes(labelText) || textOf(button).includes(labelText);
    }) || null;
  }

  function parseManagerRankRow(row) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) return null;
    const keyword = textOf(cells[0].querySelector("a") || cells[0]);
    const rankText = textOf(cells[1]);
    const rankMatch = rankText.match(/([\d,]+)위/);
    if (!keyword || !rankMatch || rankText.includes("이탈")) return null;
    const pageMatch = rankText.match(/([\d,]+)페이지\s*([\d,]+)위/);
    return {
      keyword,
      rank: Number(rankMatch[1].replace(/,/g, "")),
      page: pageMatch ? Number(pageMatch[1].replace(/,/g, "")) : null,
      pageRank: pageMatch ? Number(pageMatch[2].replace(/,/g, "")) : null,
    };
  }

  function currentManagerRankRows() {
    const table = managerRankTable();
    if (!table) return [];
    return [...table.querySelectorAll("tbody tr")]
      .map(parseManagerRankRow)
      .filter(Boolean);
  }

  async function updateManagerProgress(job, message, current = 0, total = 0) {
    await chrome.storage.local.set({
      [SMARTSTORE_IMPORT_KEY]: {
        ...job,
        status: "collecting",
        message,
        current,
        total,
        updatedAt: Date.now(),
      },
    });
  }

  async function collectManagerDetail(job, fallback) {
    const meta = [...document.querySelectorAll("p")]
      .find((paragraph) => textOf(paragraph).includes("채널 상품 번호"));
    const metaText = textOf(meta);
    const productCode = metaText.match(/채널\s*상품\s*번호\s*:\s*([\d]+)/)?.[1] || "";
    const productName = textOf(document.querySelector("h2")) || fallback.productName;

    const ready = await waitFor(() => {
      const table = managerRankTable();
      return table ? { table, rows: currentManagerRankRows() } : null;
    }, 30000);
    if (!ready) throw new Error("키워드 순위 표를 찾지 못했습니다.");

    const keywords = new Map();
    const firstButton = managerPaginationButton("", true);
    if (firstButton && firstButton.getAttribute("aria-current") !== "page") {
      const previous = managerDetailSignature();
      firstButton.click();
      await waitForChange(managerDetailSignature, previous);
    }

    for (let page = 1; page <= 100; page += 1) {
      currentManagerRankRows().forEach((item) => keywords.set(item.keyword, item));
      const nextButton = managerPaginationButton("다음 페이지");
      if (!nextButton || nextButton.disabled) break;
      const previous = managerDetailSignature();
      nextButton.click();
      const changed = await waitForChange(managerDetailSignature, previous);
      if (!changed) break;
    }

    return {
      productCode,
      productName,
      productImage: fallback.productImage,
      keywords: [...keywords.values()],
    };
  }

  async function returnToManagerList() {
    const listButton = [...document.querySelectorAll("button")]
      .find((button) => textOf(button) === "목록");
    if (!listButton) return false;
    listButton.click();
    return Boolean(await waitFor(() => managerMoreButtons().length && managerListSignature(), 20000));
  }

  async function collectManagerRanking(job) {
    const ready = await waitFor(() => managerMoreButtons().length || isManagerDetail(), 40000);
    if (!ready) throw new Error("순위 진단 상품 목록을 찾지 못했습니다. 관리자 로그인과 화면을 확인하세요.");
    if (isManagerDetail() && !(await returnToManagerList())) {
      throw new Error("순위 진단 상품 목록으로 돌아가지 못했습니다.");
    }

    const products = [];
    const seenProductCodes = new Set();
    const seenRowKeys = new Set();
    let processedCount = 0;
    let estimatedTotal = managerMoreButtons().length;
    const bodyText = textOf(document.body);
    const productCountMatch = bodyText.match(/상품\s*수\s*([\d,]+)개/);
    if (productCountMatch) estimatedTotal = Number(productCountMatch[1].replace(/,/g, ""));

    const collectionLimit = estimatedTotal > 0 ? estimatedTotal : 500;
    for (let cycle = 0; cycle < 1000 && processedCount < collectionLimit; cycle += 1) {
      const target = managerMoreButtons().find((button) => !seenRowKeys.has(managerRowKey(button)));
      if (target) {
        seenRowKeys.add(managerRowKey(target));
        const row = target.closest("li");
        const image = row?.querySelector("img[src]");
        const fallback = {
          productName: textOf(row).slice(0, 180),
          productImage: image?.src || "",
        };
        await updateManagerProgress(
          job,
          `${processedCount + 1}/${estimatedTotal || "?"} 상품의 키워드 순위를 확인하고 있습니다.`,
          processedCount,
          estimatedTotal
        );
        target.click();
        if (!(await waitFor(isManagerDetail, 20000))) {
          throw new Error(`${fallback.productName || "상품"} 상세 화면을 열지 못했습니다.`);
        }
        const product = await collectManagerDetail(job, fallback);
        processedCount += 1;
        if (product.productCode && !seenProductCodes.has(product.productCode)) {
          seenProductCodes.add(product.productCode);
          if (product.keywords.length) products.push(product);
        }
        if (!(await returnToManagerList())) {
          throw new Error("다음 상품 수집을 위해 목록으로 돌아가지 못했습니다.");
        }
        continue;
      }

      if (processedCount >= collectionLimit) break;
      const nextButton = managerPaginationButton("다음 페이지");
      if (nextButton && !nextButton.disabled) {
        const previous = managerListSignature();
        nextButton.click();
        if (await waitForChange(managerListSignature, previous)) continue;
      }
      if (!(await revealMoreManagerRows(seenRowKeys))) break;
    }

    if (!products.length) throw new Error("관리자 순위 진단에서 수집된 상품이 없습니다.");
    return products;
  }

  function showResult(result) {
    document.getElementById("energuard-smartstore-result")?.remove();
    const panel = document.createElement("div");
    panel.id = "energuard-smartstore-result";
    const failed = !!result?.error;
    const pending = !!result?.statusMessage;
    panel.style.cssText = [
      "position:fixed", "right:24px", "bottom:24px", "z-index:2147483647",
      "min-width:260px", "padding:16px 18px", "border:1px solid #dfe4ec",
      `border-left:4px solid ${failed ? "#d92d20" : pending ? "#12b76a" : "#f15a2b"}`, "border-radius:6px", "background:#fff",
      "box-shadow:0 12px 30px rgba(16,24,40,.16)", "font:13px/1.5 Arial,sans-serif",
      "color:#101828",
    ].join(";");
    panel.innerHTML = `<strong style="display:block;margin-bottom:4px">ENERGUARD LAB</strong>` +
      (pending
        ? `<span>${String(result.statusMessage)}</span>`
        : failed
        ? `<span style="color:#d92d20">${String(result.error)}</span>`
        : `<span>${Number(result?.scannedProducts) || 0}개 상품 확인 · ${Number(result?.saved) || 0}개 순위 저장</span>`) +
      ((Number(result?.unmatched) || Number(result?.noRankProducts))
        ? `<small style="display:block;color:#667085">상품 대조 실패 ${Number(result?.unmatched) || 0}개 · 순위 미확인 ${Number(result?.noRankProducts) || 0}개</small>`
        : "");
    document.body.appendChild(panel);
    if (!pending) setTimeout(() => panel.remove(), 7000);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "SHOW_SMARTSTORE_IMPORT_STATUS") {
      showResult({ statusMessage: message.message || "관리자 검색 순위를 확인하고 있습니다." });
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "SHOW_SMARTSTORE_IMPORT_RESULT") {
      showResult(message.result);
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type !== "EXTRACT_SMARTSTORE_RANKS") return false;
    try {
      sendResponse(extract());
    } catch (error) {
      sendResponse({ ok: false, products: [], error: error?.message || "화면 분석에 실패했습니다." });
    }
    return false;
  });

  async function finishJob(job, patch) {
    await chrome.storage.local.set({
      [SMARTSTORE_IMPORT_KEY]: { ...job, ...patch, finishedAt: Date.now() },
    });
  }

  async function runPendingImport() {
    if (window.__energuardSmartstoreImportRunning) return;
    const stored = await chrome.storage.local.get(SMARTSTORE_IMPORT_KEY);
    const job = stored[SMARTSTORE_IMPORT_KEY];
    if (!job || !["pending", "collecting"].includes(job.status)) return;
    if (Date.now() - Number(job.startedAt || 0) > 10 * 60 * 1000) {
      await finishJob(job, { status: "error", error: "수집 요청 시간이 만료되었습니다." });
      return;
    }

    window.__energuardSmartstoreImportRunning = true;
    const isCollectorFrame = location.hostname === "in-app.memopan.io"
      && location.pathname.includes("ranking-diagnosis");

    if (isCollectorFrame) {
      try {
        const products = await collectManagerRanking(job);
        const saved = await chrome.runtime.sendMessage({
          type: "SAVE_SMARTSTORE_RANKS",
          storeName: job.storeName,
          products,
        });
        if (!saved?.ok) throw new Error(saved?.error || "순위를 저장하지 못했습니다.");
        await finishJob(job, { status: "done", result: saved, productCount: products.length });
      } catch (error) {
        await finishJob(job, {
          status: "error",
          error: error?.message || "관리자 검색 순위를 가져오지 못했습니다.",
        });
      } finally {
        window.__energuardSmartstoreImportRunning = false;
      }
      return;
    }

    if (window !== window.top) {
      window.__energuardSmartstoreImportRunning = false;
      return;
    }

    showResult({ statusMessage: "관리자 검색 순위 화면을 준비하고 있습니다." });
    for (let attempt = 0; attempt < 900; attempt += 1) {
      const current = (await chrome.storage.local.get(SMARTSTORE_IMPORT_KEY))[SMARTSTORE_IMPORT_KEY];
      if (!current) break;
      if (current.status === "done") {
        showResult(current.result || { saved: 0 });
        window.__energuardSmartstoreImportRunning = false;
        return;
      }
      if (current.status === "error") {
        showResult({ error: current.error || "관리자 검색 순위를 가져오지 못했습니다." });
        window.__energuardSmartstoreImportRunning = false;
        return;
      }
      showResult({ statusMessage: current.message || "관리자 검색 순위 화면을 준비하고 있습니다." });
      await sleep(1000);
    }
    showResult({ error: "관리자 순위 수집 시간이 초과되었습니다." });
    window.__energuardSmartstoreImportRunning = false;
  }

  if (window === window.top) {
    window.addEventListener("message", (event) => {
      if (event.data?.source !== FRAME_RESULT_SOURCE || !event.data.frameId) return;
      frameResults.set(event.data.frameId, {
        products: Array.isArray(event.data.products) ? event.data.products : [],
        debug: event.data.debug || {},
      });
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== NETWORK_SOURCE) return;
    networkPayloads.push({ url: event.data.url || "", data: event.data.data });
    if (networkPayloads.length > 100) networkPayloads.shift();
  });

  runPendingImport().catch((error) => showResult({ error: error?.message || "관리자 순위 수집을 시작하지 못했습니다." }));
})();
