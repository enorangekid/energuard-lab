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


    const card = link.closest('li, article, div[class*="item"]') || link.parentElement;
    const name = extractName(link, card);
    const price = extractListPrice(link, productId) ?? extractPrice(card || link);
    if (!price) return;

    seen.add(productId);
    products.push({ productId, name, price });
  });

  if (products.length === 0) return scrapeByText();
  return products;
}

// Naver's listing embeds the displayed price with its channel product ID.
// Use the ID from the product URL, never the different origin productNo.
function extractListPrice(link, productId) {
  if (link.getAttribute('data-shp-contents-id') !== String(productId)) return null;
  try {
    const fields = JSON.parse(link.getAttribute('data-shp-contents-dtl') || 'null');
    if (!Array.isArray(fields)) return null;
    const prices = fields.filter(f => f.key === 'price');
    if (prices.length !== 1) return null;
    const price = Number(prices[0].value);
    return Number.isSafeInteger(price) && price > 0 ? price : null;
  } catch { return null; }
}

function extractName(link, card) {
  if (card) {
    const el = card.querySelector('strong, p[class*="name"], span[class*="name"], div[class*="name"]');
    if (el?.textContent?.trim().length > 4) return el.textContent.trim();
  }
  return link.textContent?.trim() || '';
}

// Never concatenate discount %, original price and selling price into one number.
function parsePriceText(text) {
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  const match=clean.match(/^(?:(?:판매가|할인가|판매가격|할인판매가)\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원?$/);
  if(!match)return null;
  const value=Number(match[1].replace(/,/g,''));
  return Number.isSafeInteger(value)&&value>0?value:null;
}
function extractPrice(container) {
  const excluded='del,s,[class*="original"],[class*="before"],[class*="origin_price"],[class*="discount_rate"],[class*="delivery"],[class*="shipping"],[class*="point"]';
  const roots=[...container.querySelectorAll('[class*="price"],[itemprop="price"]')].filter(el=>!el.closest(excluded));
  const values=new Set();
  for(const root of roots){
    for(const el of [root,...root.querySelectorAll('strong,span,em,b')]){
      if(el.closest(excluded))continue;
      const value=parsePriceText(el.getAttribute('itemprop')==='price' ? el.getAttribute('content')||el.textContent : el.textContent);
      if(value!=null)values.add(value);
    }
  }
  // Multiple amounts are ambiguous; detailed inspection will handle the product.
  return values.size===1?[...values][0]:null;
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
