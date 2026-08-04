(function () {
  const SMARTSTORE_IMPORT_KEY = "smartstoreRankImportJob";
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
        : `<span>${Number(result?.saved) || 0}개 순위 저장 완료</span>`) +
      (result?.unmatched ? `<small style="display:block;color:#667085">상품 대조 실패 ${result.unmatched}개</small>` : "");
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
    if (window !== window.top || window.__energuardSmartstoreImportRunning) return;
    const stored = await chrome.storage.local.get(SMARTSTORE_IMPORT_KEY);
    const job = stored[SMARTSTORE_IMPORT_KEY];
    if (!job || job.status !== "pending") return;
    if (Date.now() - Number(job.startedAt || 0) > 10 * 60 * 1000) {
      await finishJob(job, { status: "error", error: "수집 요청 시간이 만료되었습니다." });
      return;
    }

    window.__energuardSmartstoreImportRunning = true;
    showResult({ statusMessage: "관리자 검색 순위 화면을 읽고 있습니다." });
    let best = null;
    let stableCount = 0;
    let previousCount = -1;

    for (let attempt = 0; attempt < 90; attempt += 1) {
      const result = extract();
      const count = result?.products?.length || 0;
      if (count > (best?.products?.length || 0)) best = result;
      stableCount = count > 0 && count === previousCount ? stableCount + 1 : 0;
      previousCount = count;

      if (count > 0) {
        showResult({ statusMessage: `관리자 검색 순위 ${count}개 상품을 확인하고 있습니다.` });
      }
      if (count > 0 && stableCount >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      if (!best?.products?.length) {
        throw new Error(best?.error || "관리자 화면에서 순위 데이터를 찾지 못했습니다.");
      }
      const saved = await chrome.runtime.sendMessage({
        type: "SAVE_SMARTSTORE_RANKS",
        storeName: job.storeName,
        products: best.products,
      });
      if (!saved?.ok) throw new Error(saved?.error || "순위를 저장하지 못했습니다.");
      await finishJob(job, { status: "done", result: saved });
      showResult(saved);
    } catch (error) {
      const message = error?.message || "관리자 검색 순위를 가져오지 못했습니다.";
      await finishJob(job, { status: "error", error: message });
      showResult({ error: message });
    } finally {
      window.__energuardSmartstoreImportRunning = false;
    }
  }

  runPendingImport().catch((error) => showResult({ error: error?.message || "관리자 순위 수집을 시작하지 못했습니다." }));
})();
