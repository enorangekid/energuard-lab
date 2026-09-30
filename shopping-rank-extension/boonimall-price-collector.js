// 부니몰(퍼스트몰) 상품 상세 페이지의 기본가·옵션별 절대 판매가를 읽는다.
// 가격 변경은 하지 않고 service worker의 홈페이지 가격검사 요청에만 응답한다.
(() => {
  function number(value) {
    const n = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function productId() {
    const query = new URL(location.href).searchParams.get('no');
    const hidden = document.querySelector('input[name="goodsSeq"]')?.value;
    return String(query || hidden || '').trim();
  }

  function basePrice() {
    for (const script of document.scripts) {
      const match = String(script.textContent || '').match(/gl_goods_price\s*=\s*([0-9.]+)/);
      const price = match ? number(match[1]) : null;
      if (price != null) return price;
    }
    const candidates = ['.goods_price', '.price', '[itemprop="price"]'];
    for (const selector of candidates) {
      const node = document.querySelector(selector);
      const price = number(node?.getAttribute('content') || node?.textContent);
      if (price != null) return price;
    }
    return null;
  }

  function optionLabel(option) {
    const axes = ['opt1', 'opt2', 'opt3', 'opt4', 'opt5']
      .map(name => String(option.getAttribute(name) || '').trim())
      .filter(Boolean);
    if (axes.length) return axes.join(' / ');
    return String(option.value || option.textContent || '')
      .replace(/\([+-]?[\d,]+원\)\s*$/, '')
      .trim();
  }

  function collect() {
    const id = productId();
    if (!/^\d+$/.test(id)) return { ok: false, error: '상품번호를 확인할 수 없습니다.' };
    const price = basePrice();
    const optionElements = [...document.querySelectorAll('select[name="viewOptions[]"] option')]
      .filter(option => String(option.value || '').trim());
    const rows = optionElements.map(option => {
      const finalPrice = number(option.getAttribute('price'));
      return {
        label: optionLabel(option),
        code: null,
        finalPrice,
        instantPrice: finalPrice,
        salePrice: finalPrice,
        soldOut: option.disabled || /sold|품절/i.test(`${option.className} ${option.textContent}`),
      };
    }).filter(row => row.finalPrice != null);

    if (!rows.length && price != null) {
      rows.push({ label: '(옵션 없음)', code: null, finalPrice: price, instantPrice: price, salePrice: price, soldOut: false });
    }
    return {
      ok: rows.length > 0,
      productId: id,
      productUrl: location.href,
      title: document.querySelector('#goods_view h3, .goods_view h3, h1')?.textContent?.trim() || document.title,
      basePrice: price,
      rows,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'GET_BOONIMALL_SCAN_DATA') return;
    try { respond(collect()); }
    catch (error) { respond({ ok: false, error: error?.message || '부니몰 상품 수집 실패' }); }
  });
})();
