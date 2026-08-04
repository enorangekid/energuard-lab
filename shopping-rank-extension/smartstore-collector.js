(function () {
  const SMARTSTORE_IMPORT_KEY = "smartstoreRankImportJob";
  const FRAME_RESULT_SOURCE = "energuard-smartstore-frame-result";
  const NETWORK_SOURCE = "energuard-smartstore-network";
  const frameResults = new Map();
  const networkPayloads = [];
  const frameId = `${location.href}:${Math.random().toString(36).slice(2)}`;
  const PAGE_RANK_RE = /(\d+)\s*페이지\s*(\d+)\s*위/;
  const STATUS_RE = /^(유지|진입|이탈|상승|하락|신규|▲\s*\d+|▼\s*\d+)$/;
  // 카테고리 순위 칩의 "N위" 요약 텍스트가 진짜 키워드로 오인되는 걸 막는다 —
  // 실제 키워드가 숫자+"위" 형태로만 이루어질 일은 없다.
  const RANK_ONLY_RE = /^[\d,]+\s*위$/;

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
      if (PAGE_RANK_RE.test(line) || STATUS_RE.test(line) || RANK_ONLY_RE.test(line) || /^\d+$/.test(line)) return false;
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

  function isManagerDetail() {
    return [...document.querySelectorAll("p")]
      .some((paragraph) => textOf(paragraph).includes("채널 상품 번호"));
  }

  // 예전엔 body 전체를 훑는 managerVisibleProductRows()[0]과 aria-current 속성에 의존했는데,
  // 둘 다 렌더링 타이밍에 따라 흔들릴 여지가 있었다. 실제로 클릭할 대상(더보기 버튼)이 속한
  // <li> 텍스트만 비교하는 게 훨씬 안정적이다.
  function managerListSignature() {
    const button = managerMoreButtons()[0];
    const item = button?.closest("li");
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
    const nav = document.querySelector('nav[aria-label="페이지네이션"]');
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
    if (!keyword || RANK_ONLY_RE.test(keyword) || !rankMatch || rankText.includes("이탈")) return null;
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

  // 셀로몬(경쟁 확장)이 실제로 이 화면에서 안정적으로 200개 상품까지 수집하는 걸 확인하고
  // 그 구조를 그대로 옮겼다 — "전체 N개" 필터에서 총 키워드 수를 읽어, 테이블이 존재하는지뿐
  // 아니라 행 데이터가 실제로 채워졌는지까지 확인한 뒤에야 준비됐다고 본다.
  function managerTotalKeywordCount() {
    const allFilter = [...document.querySelectorAll('[role="radio"]')]
      .find((radio) => /^전체\s*[\d,]+개/.test(textOf(radio)));
    const match = textOf(allFilter).match(/^전체\s*([\d,]+)개/);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }

  async function waitForManagerKeywordTable() {
    const toggle = [...document.querySelectorAll("button")].find((button) => textOf(button).includes("키워드 순위"));
    toggle?.scrollIntoView({ block: "center" });
    return waitFor(() => {
      const table = managerRankTable();
      const total = managerTotalKeywordCount();
      const rows = currentManagerRankRows();
      if (!table || total === null) return null;
      if (total > 0 && !rows.length) return null;
      return { total, rows };
    }, 30000);
  }

  async function collectManagerDetail(job, fallback) {
    const meta = [...document.querySelectorAll("p")]
      .find((paragraph) => textOf(paragraph).includes("채널 상품 번호"));
    const metaText = textOf(meta);
    const productCode = metaText.match(/채널\s*상품\s*번호\s*:\s*([\d]+)/)?.[1] || "";
    const productName = textOf(document.querySelector("h2")) || fallback.productName;

    const ready = await waitForManagerKeywordTable();
    if (!ready) throw new Error("키워드 순위 표가 준비되지 않았습니다. 잠시 후 다시 가져오세요.");

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

    if (ready.total > 0 && !keywords.size) {
      throw new Error(`키워드 ${ready.total}개가 표시됐지만 순위 행을 읽지 못했습니다.`);
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

  // 셀로몬 코드를 그대로 옮겼다 — 페이지당 "더보기" 버튼을 인덱스 순서로 하나씩 처리하고,
  // 한 페이지 분을 다 처리한 뒤에만 다음 페이지로 넘어간다. 리스트 스냅샷 병합이나 스크롤
  // 폴백, 키 기반 중복추적 같은 우리가 얹었던 레이어가 오히려 타이밍을 불안정하게 만든
  // 것으로 보여 전부 걷어냈다.
  const MAX_MANAGER_PRODUCTS = 200;

  async function collectManagerRanking(job) {
    const ready = await waitFor(() => managerMoreButtons().length || isManagerDetail(), 40000);
    if (!ready) throw new Error("순위 진단 상품 목록을 찾지 못했습니다. 관리자 로그인과 화면을 확인하세요.");
    if (isManagerDetail() && !(await returnToManagerList())) {
      throw new Error("순위 진단 상품 목록으로 돌아가지 못했습니다.");
    }

    const bodyText = textOf(document.body);
    const productCountMatch = bodyText.match(/상품\s*수\s*([\d,]+)개/);
    const productCount = productCountMatch
      ? Number(productCountMatch[1].replace(/,/g, ""))
      : managerMoreButtons().length;
    // "다음 페이지" 버튼이 마지막 페이지에서도 disabled로 안 잡히고 1페이지로 되돌아가
    // 무한히 재수집되는 경우가 있어(200 안전상한까지 계속 돎), 화면에 적힌 실제 상품 수를
    // 알고 있으면 그걸 진짜 상한으로 쓴다 — "다음 페이지" 판정 오류에 기대지 않는다.
    const collectLimit = productCount > 0 ? Math.min(MAX_MANAGER_PRODUCTS, productCount) : MAX_MANAGER_PRODUCTS;

    const products = [];
    const errors = [];

    for (let listPage = 1; listPage <= 100 && products.length < collectLimit; listPage += 1) {
      const available = managerMoreButtons().length;
      if (!available) break;

      for (let index = 0; index < available && products.length < collectLimit; index += 1) {
        const buttons = managerMoreButtons();
        const target = buttons[index];
        if (!target) continue;
        const row = target.closest("li");
        const image = row?.querySelector("img[src]");
        const fallback = {
          productName: textOf(row).slice(0, 180),
          productImage: image?.src || "",
        };
        await updateManagerProgress(
          job,
          `상품 순위를 확인하고 있습니다. (${products.length + 1}/${productCount || "?"})`,
          products.length + 1,
          productCount
        );
        target.click();
        const opened = await waitFor(isManagerDetail, 20000);
        if (!opened) {
          errors.push({ product: fallback.productName, message: "상세 화면을 열지 못했습니다." });
        } else {
          try {
            const product = await collectManagerDetail(job, fallback);
            if (product) products.push(product);
          } catch (error) {
            errors.push({ product: fallback.productName, message: error?.message || "키워드를 읽지 못했습니다." });
          }
        }
        const returned = await returnToManagerList();
        if (!returned) throw new Error("다음 상품 수집을 위해 목록으로 돌아가지 못했습니다.");
      }

      const nextButton = managerPaginationButton("다음 페이지");
      if (!nextButton || nextButton.disabled) break;
      const previous = managerListSignature();
      nextButton.click();
      const changed = await waitForChange(managerListSignature, previous);
      if (!changed) break;
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
      (Number(result?.noRankProducts)
        ? `<small style="display:block;color:#667085">순위 미확인 ${Number(result?.noRankProducts) || 0}개</small>`
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
