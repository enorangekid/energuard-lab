// checker-content.js — 스마트스토어 상품번호 기반 스크래핑
// 2026-09-02: 원래 별개 확장(energuard-checker)이던 걸 이 통합 확장으로 옮겨옴.
// 로직 자체는 그대로(DOM 스크래핑만, 네트워크 호출 없음) — popup/popup.js에서
// GET_PRODUCTS/HIGHLIGHT/CLEAR_HIGHLIGHT 메시지로 부른다.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ ok: true }); }
  if (msg.type === 'GET_PRODUCTS') { sendResponse(scrapeProducts()); }
  if (msg.type === 'HIGHLIGHT') { highlightProducts(msg.results); sendResponse({ ok: true }); }
  if (msg.type === 'CLEAR_HIGHLIGHT') { clearHighlights(); sendResponse({ ok: true }); }
  return true;
});

function scrapeProducts() {
  const products = [];
  const seen = new Set();

  const productLinks = document.querySelectorAll('a[href*="/products/"]');

  productLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/products\/(\d+)/);
    if (!match) return;
    const productId = match[1];
    if (seen.has(productId)) return;
    seen.add(productId);

    const card = link.closest('li, article, div[class*="item"]') || link.parentElement;
    const name = extractName(link, card);
    const price = extractPrice(card || link);
    if (!price) return;

    products.push({ productId, name, price });
  });

  if (products.length === 0) return scrapeByText();
  return products;
}

function extractName(link, card) {
  if (card) {
    const el = card.querySelector('strong, p[class*="name"], span[class*="name"], div[class*="name"]');
    if (el?.textContent?.trim().length > 4) return el.textContent.trim();
  }
  return link.textContent?.trim() || '';
}

function extractPrice(container) {
  if (!container) return null;
  const priceEl = container.querySelector('[class*="price"]:not([class*="original"]):not([class*="before"]):not([class*="del"])');
  if (priceEl) {
    const p = parseInt(priceEl.textContent.replace(/[^\d]/g, ''));
    if (p > 500) return p;
  }
  const text = container.innerText || container.textContent || '';
  const matches = [...text.matchAll(/(\d[\d,]+)원/g)];
  if (matches.length > 0) {
    const prices = matches.map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p >= 1000 && p <= 9999999);
    if (prices.length > 0) return Math.min(...prices);
  }
  return null;
}

function scrapeByText() {
  const products = [];
  document.querySelectorAll('li, article').forEach(item => {
    const link = item.querySelector('a[href*="/products/"]');
    if (!link) return;
    const match = (link.getAttribute('href') || '').match(/\/products\/(\d+)/);
    if (!match) return;
    const name = extractName(link, item);
    const price = extractPrice(item);
    if (!price || price < 1000) return;
    products.push({ productId: match[1], name, price });
  });
  return products;
}

function highlightProducts(results) {
  clearHighlights();
  results.forEach(result => {
    const link = document.querySelector(`a[href*="/products/${result.productId}"]`);
    const card = link?.closest('li, article, div[class*="item"]') || link?.parentElement;
    if (!card) return;

    const badge = document.createElement('div');
    badge.className = 'eg-price-badge';
    badge.dataset.egBadge = '1';

    if (result.status === 'mismatch') {
      const diffSign = result.diff > 0 ? '+' : '';
      badge.className += ' eg-mismatch';
      badge.innerHTML = `<span class="eg-icon">🔴</span><span class="eg-label">불일치</span><span class="eg-diff">${diffSign}${result.diff.toLocaleString()}원</span><div class="eg-detail">쇼핑몰: ${result.price.toLocaleString()}원<br>단가표: ${result.tablePrice.toLocaleString()}원</div>`;
      card.style.outline = '3px solid #ef4444';
    } else if (result.status === 'match') {
      badge.className += ' eg-match';
      badge.innerHTML = `<span class="eg-icon">✅</span><span class="eg-label">일치</span>`;
      card.style.outline = '2px solid #22c55e';
    } else if (result.status === 'unmapped') {
      badge.className += ' eg-unmapped';
      badge.innerHTML = `<span class="eg-icon">⚪</span><span class="eg-label">미등록</span>`;
    } else { return; }

    card.style.outlineOffset = '-2px';
    card.style.position = 'relative';
    card.appendChild(badge);
  });
}

function clearHighlights() {
  document.querySelectorAll('[data-eg-badge]').forEach(el => el.remove());
  document.querySelectorAll('*').forEach(el => {
    if (el.style?.outline?.includes('ef4444') || el.style?.outline?.includes('22c55e')) {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }
  });
}
