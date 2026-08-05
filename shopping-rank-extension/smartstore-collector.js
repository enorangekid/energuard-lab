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

  // "내상품 키워드 더보기" 버튼은 키워드가 많은 상품에만 있다 — 그래서 버튼 기준으로만 상품을
  // 찾으면 버튼 없는 상품(키워드 4개 이하)이 통째로 빠졌다. 실제로는 상품명/썸네일 자체가
  // role="link"라 어떤 상품이든 클릭하면 channelProductNo가 URL에 찍히는 같은 상세 페이지로
  // 이동한다 — 그래서 버튼 대신 "상품 행(li)" 자체를 기준으로 순회해야 전체가 다 잡힌다.
  function managerProductRows() {
    return [...document.querySelectorAll('li[class*="Products-module__product"]')];
  }

  function managerRowClickTarget(row) {
    return row?.querySelector('[role="link"]') || null;
  }

  function isManagerDetail() {
    return [...document.querySelectorAll("p")]
      .some((paragraph) => textOf(paragraph).includes("채널 상품 번호"));
  }

  // 더보기 버튼이 속한 <li> 텍스트로 페이지 전환을 감지했었는데, 키워드 4개 이하라 버튼
  // 자체가 없는 상품만 있는 페이지(뒤쪽 페이지 대부분이 이랬다)에서는 이 값이 계속 빈 문자열이라
  // "페이지가 넘어갔는지"를 영영 알 수 없었다 — 그래서 4번 재시도 후 포기하고 그 지점에서
  // 수집이 끝나버렸다(88개 중 30여 개에서 항상 멈추던 진짜 원인). 버튼 유무와 무관한
  // 페이지네이션의 "현재 페이지" 숫자로 판단해야 버튼 없는 페이지도 안전하게 넘어갈 수 있다.
  function managerListReady() {
    return !isManagerDetail() && !!document.querySelector('nav[aria-label="페이지네이션"]');
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

  // 상세를 열었다가 "목록"으로 돌아가면 몇 페이지째였는지와 무관하게 1페이지로 리셋되는
  // 경우가 있다 — 실제로 몇 페이지에 있는지 직접 읽어서, 원래 있던 깊이까지 다시 넘긴다.
  function managerCurrentPageNumber() {
    const nav = document.querySelector('nav[aria-label="페이지네이션"]');
    const current = nav?.querySelector('button[aria-current="page"]');
    const num = Number(textOf(current));
    return Number.isFinite(num) && num > 0 ? num : 1;
  }

  async function waitForManagerPageAdvance(previousPage, timeout = 20000) {
    const target = await waitFor(() => {
      const current = managerCurrentPageNumber();
      return current > previousPage ? current : null;
    }, timeout);
    if (target) await sleep(350); // 페이지 번호는 바뀌어도 목록 내용은 아직 그려지는 중일 수 있다.
    return target;
  }

  async function ensureManagerListPage(targetPage) {
    for (let guard = 0; guard < 30; guard += 1) {
      const current = managerCurrentPageNumber();
      if (current >= targetPage) return true;
      const nextButton = managerPaginationButton("다음 페이지");
      if (!nextButton || nextButton.disabled) return false;
      nextButton.click();
      const changed = await waitForManagerPageAdvance(current);
      if (!changed) return false;
    }
    return false;
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
    // 더보기 버튼 존재 여부로 "돌아갔는지"를 판단하면 안 된다 — 버튼 없는 상품만 있는
    // 페이지로 돌아갈 수도 있다. 상세 화면이 아니고 목록 페이지네이션이 보이면 충분하다.
    const ok = await waitFor(managerListReady, 20000);
    if (ok) await sleep(200);
    return Boolean(ok);
  }

  const MAX_MANAGER_PRODUCTS = 200;

  // 상품 목록의 "더보기" 버튼이 속한 <li>에서 상품코드/상품명을 뽑아 식별자로 쓴다 —
  // 상세를 열었다가 "목록"으로 돌아가면 페이지가 항상 1페이지로 리셋되는 것으로 보여서,
  // 인덱스나 "몇 페이지째"로는 진행 상황을 믿을 수 없다. 실제로 처리한 상품 자체를
  // 기억해뒀다가 건너뛰는 방식만이 페이지 리셋과 무관하게 안전하다.
  function managerRowKey(row) {
    if (!row) return "";
    return productCodeFrom(row) || productNameFrom(row) || textOf(row).slice(0, 200);
  }

  async function resolveManagerProductCount() {
    // 카드가 1개라도 뜨자마자 바로 "상품 수 N개"를 재면, 그 문구도 목록도 아직 다 안 그려진
    // 상태에서 훨씬 적은 값으로 상한이 굳어버릴 수 있다(예: 91개인데 8개로 고정돼 "정상 종료").
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const match = textOf(document.body).match(/상품\s*수\s*([\d,]+)개/);
      if (match) return Number(match[1].replace(/,/g, ""));
      await sleep(300);
    }
    let previousCount = -1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const currentCount = managerProductRows().length;
      if (currentCount === previousCount) break;
      previousCount = currentCount;
      await sleep(400);
    }
    return previousCount;
  }

  // 목록 화면이 그리는 데이터 자체가 이 API에서 온다 — channelProductNo(진짜 상품코드)와
  // 키워드별 순위(keywordRanks[].rankToday)가 한 응답에 다 들어있다. 직접 fetch()로 흉내내면
  // 화면의 실제 요청과 헤더/타이밍이 미묘하게 달라 실패할 수 있어(실제로 그랬다), 대신 이미
  // 붙어있는 네트워크 감청(smartstore-network-tap.js → networkPayloads)으로 화면이 "다음 페이지"를
  // 누를 때 실제로 받는 응답을 그대로 가로채 쓴다 — 인증/헤더 걱정이 없다.
  function findNetworkProductsPayload(pageNumber) {
    for (let i = networkPayloads.length - 1; i >= 0; i -= 1) {
      const payload = networkPayloads[i];
      if (!String(payload?.url || "").includes("/diagnosis/ranking/products")) continue;
      if (Number(payload?.data?.currentPage) === pageNumber) return payload.data;
    }
    return null;
  }

  async function waitForNetworkProductsPayload(pageNumber, timeout = 15000) {
    return waitFor(() => findNetworkProductsPayload(pageNumber), timeout);
  }

  function parseManagerProductsApiPage(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item) => ({
      productCode: String(item?.channelProductNo || "").trim(),
      productName: String(item?.productName || "").trim(),
      productImage: String(item?.imageUrl || "").trim(),
      keywords: (Array.isArray(item?.keywordRanks) ? item.keywordRanks : [])
        .filter((k) => k && k.query && Number.isFinite(Number(k.rankToday)) && Number(k.rankToday) > 0)
        .map((k) => ({ keyword: String(k.query).trim(), rank: Number(k.rankToday), page: null, pageRank: null })),
    }));
  }

  async function collectManagerRankingViaApi(job) {
    await waitFor(() => managerProductRows().length || isManagerDetail() || findNetworkProductsPayload(1), 20000);
    if (isManagerDetail() && !(await returnToManagerList())) {
      throw new Error("순위 진단 상품 목록으로 돌아가지 못했습니다.");
    }

    // 목록이 로드되면서 1페이지 응답이 이미 캡처됐을 수 있다 — 없으면 잠깐 더 기다린다.
    let first = findNetworkProductsPayload(1) || await waitForNetworkProductsPayload(1, 12000);
    if (!first) {
      // 페이지 로드 시점 경쟁으로 놓쳤을 수 있다 — "1페이지" 버튼을 눌러 강제로 다시 받아본다.
      const firstPageButton = managerPaginationButton("", true);
      if (firstPageButton) {
        firstPageButton.click();
        first = await waitForNetworkProductsPayload(1, 15000);
      }
    }
    if (!first) throw new Error("상품 목록 데이터를 받지 못했습니다.");

    const totalPages = Number(first?.totalPages) || 1;
    const totalItemCount = Number(first?.totalItemCount) || 0;
    const products = parseManagerProductsApiPage(first);
    await updateManagerProgress(
      job,
      `상품 목록을 가져오고 있습니다. (1/${totalPages}페이지)`,
      products.length,
      totalItemCount
    );

    for (let page = 2; page <= totalPages; page += 1) {
      let data = findNetworkProductsPayload(page);
      if (!data) {
        const nextButton = managerPaginationButton("다음 페이지");
        if (!nextButton || nextButton.disabled) break;
        nextButton.click();
        data = await waitForNetworkProductsPayload(page, 15000);
      }
      if (!data) throw new Error(`${page}페이지 상품 목록 데이터를 받지 못했습니다.`);
      products.push(...parseManagerProductsApiPage(data));
      await updateManagerProgress(
        job,
        `상품 목록을 가져오고 있습니다. (${page}/${totalPages}페이지)`,
        products.length,
        totalItemCount
      );
    }

    if (!products.length) throw new Error("API 응답에서 상품을 찾지 못했습니다.");
    return { products, errors: [] };
  }

  // API 방식이 막히면(로그인 세션 문제, API 변경 등) 예전처럼 화면을 직접 클릭해서 모으는
  // 방식으로 폴백한다 — 느리지만 화면만 떠 있으면 항상 동작하는 게 확인된 방식이다.
  async function collectManagerRanking(job) {
    const ready = await waitFor(() => managerProductRows().length || isManagerDetail(), 40000);
    if (!ready) throw new Error("순위 진단 상품 목록을 찾지 못했습니다. 관리자 로그인과 화면을 확인하세요.");
    if (isManagerDetail() && !(await returnToManagerList())) {
      throw new Error("순위 진단 상품 목록으로 돌아가지 못했습니다.");
    }

    const productCount = await resolveManagerProductCount();
    // "다음 페이지" 버튼이 마지막 페이지에서도 disabled로 안 잡히는 경우가 있어(200 안전상한까지
    // 계속 돎), 화면에 적힌 실제 상품 수를 알고 있으면 그걸 진짜 상한으로 쓴다.
    const collectLimit = productCount > 0 ? Math.min(MAX_MANAGER_PRODUCTS, productCount) : MAX_MANAGER_PRODUCTS;

    const products = [];
    const errors = [];
    const processedKeys = new Set();
    let staleRounds = 0;
    let currentPage = 1; // 지금 몇 페이지째를 보고 있어야 하는지(목표 깊이)

    for (let cycle = 0; cycle < 1000 && products.length < collectLimit; cycle += 1) {
      try {
      // "목록"으로 돌아오면 1페이지로 리셋될 수 있다 — 실제 페이지 번호를 읽어서 목표 깊이까지
      // 다시 넘긴다. 리셋이 안 됐으면(이미 currentPage 이상) 아무것도 안 하고 바로 통과한다.
      await ensureManagerListPage(currentPage);

      // 더보기 버튼이 아니라 상품 행(li) 자체를 기준으로 순회한다 — 버튼 유무와 무관하게
      // 상품명/썸네일(role="link")을 클릭하면 어떤 상품이든 같은 상세 페이지로 이동한다.
      const target = managerProductRows().find((row) => !processedKeys.has(managerRowKey(row)));
      if (target) {
        const row = target;
        const key = managerRowKey(row);
        processedKeys.add(key);
        staleRounds = 0;
        const clickTarget = managerRowClickTarget(row);
        const image = row?.querySelector("img[src]");
        const fallback = {
          productName: textOf(row).slice(0, 180),
          productImage: image?.src || "",
        };
        if (!clickTarget) {
          errors.push({ product: fallback.productName, message: "클릭할 상품 링크를 찾지 못했습니다." });
          continue;
        }
        await updateManagerProgress(
          job,
          `상품 순위를 확인하고 있습니다. (${products.length + 1}/${productCount || "?"})`,
          products.length + 1,
          productCount
        );
        clickTarget.click();
        const opened = await waitFor(isManagerDetail, 20000);
        if (!opened) {
          // 상세가 안 열렸으면 여전히 목록 화면이다 — "목록"으로 돌아가려 할 필요가 없다.
          errors.push({ product: fallback.productName, message: "상세 화면을 열지 못했습니다." });
          await sleep(600);
          continue;
        }
        try {
          const product = await collectManagerDetail(job, fallback);
          if (product) products.push(product);
        } catch (error) {
          errors.push({ product: fallback.productName, message: error?.message || "키워드를 읽지 못했습니다." });
        }

        // 목록 복귀는 한 번 실패해도 잠깐 뒤에 재시도해본다 — 여기서 바로 throw하면 지금까지
        // 모은 상품이 전부 버려진다(88개 중 30개째에서 죽으면 30개조차 저장 안 되던 원인).
        let returned = await returnToManagerList();
        if (!returned) {
          await sleep(1000);
          returned = await returnToManagerList();
        }
        if (!returned) {
          // 계속 못 돌아가면 여기서 멈추되, 지금까지 모은 건 그대로 반환해서 저장은 되게 한다.
          errors.push({ product: fallback.productName, message: "목록으로 돌아가지 못해 수집을 중단했습니다." });
          break;
        }
        await sleep(300); // 너무 빠르게 연속 클릭하면 관리자 화면이 못 따라오는 경우가 있어 약간 쉰다.
        continue;
      }

      // 지금 보이는 페이지(목표 깊이)엔 처리 안 한 게 없다 — 한 페이지 더 깊이 들어가본다.
      const nextButton = managerPaginationButton("다음 페이지");
      if (!nextButton || nextButton.disabled) break;
      const previousPage = managerCurrentPageNumber();
      nextButton.click();
      const changed = await waitForManagerPageAdvance(previousPage);
      if (!changed) {
        staleRounds += 1;
        if (staleRounds > 3) break; // 페이지도 안 넘어가고 새 상품도 없으면 진짜 끝난 것
        continue;
      }
      staleRounds = 0;
      currentPage = changed;
      } catch (loopError) {
        // 사이클 도중 예상 못한 오류가 나도 지금까지 모은 상품은 버리지 않는다 — 88개 중
        // N개째에서 죽으면 N개조차 저장이 안 되던 게 원래 문제였다.
        errors.push({ product: "", message: loopError?.message || "수집 중 오류가 발생했습니다." });
        break;
      }
    }

    if (!products.length) throw new Error("관리자 순위 진단에서 수집된 상품이 없습니다.");
    return { products, errors };
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
        : "") +
      (Number(result?.collectErrors)
        ? `<small style="display:block;color:#d92d20">일부 상품 수집 실패 ${Number(result?.collectErrors) || 0}건 (중간에 중단됨)</small>`
        : "") +
      (Number(result?.nameMatched)
        ? `<small style="display:block;color:#667085">상품코드 없어 상품명으로 매칭: ${Number(result?.nameMatched) || 0}개</small>`
        : "") +
      (Number(result?.nameUnmatched)
        ? `<small style="display:block;color:#d92d20">상품코드·매칭 모두 실패로 스킵: ${Number(result?.nameUnmatched) || 0}개</small>`
        : "");
    document.body.appendChild(panel);
    if (!pending) setTimeout(() => panel.remove(), 10000);
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
        let products;
        let collectErrors = [];
        try {
          const apiResult = await collectManagerRankingViaApi(job);
          products = apiResult.products;
        } catch (apiError) {
          // API 방식이 실패하면(세션/CORS/응답 형태 변경 등) 느리지만 검증된 클릭 방식으로 대체한다.
          const clickResult = await collectManagerRanking(job);
          products = clickResult.products;
          collectErrors = clickResult.errors;
        }
        const saved = await chrome.runtime.sendMessage({
          type: "SAVE_SMARTSTORE_RANKS",
          storeName: job.storeName,
          products,
        });
        if (!saved?.ok) throw new Error(saved?.error || "순위를 저장하지 못했습니다.");
        await finishJob(job, {
          status: "done",
          result: { ...saved, collectErrors: collectErrors.length },
          productCount: products.length,
        });
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
