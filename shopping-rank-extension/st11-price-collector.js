// 11번가 상품 상세(https://www.11st.co.kr/products/번호)의 옵션·추가상품 가격을 읽는다. 읽기 전용 — 옵션 목록을 눌러 펼쳐 보기만 하고
// 장바구니·주문은 건드리지 않는다.
//  · 옵션: 각 옵션 항목(li.option_item)에 이름·판매가·재고·옵션 고유번호가 data 속성으로 붙어 있다(dtloptnm·price·stckqty·stckno).
//    1단 옵션은 바로 읽고, 2단 조합 옵션(예: 열반사 "종류 → 타입", 스티로폼 "종류 → 규격")은 첫 단계 항목을 눌러야 다음 단계 목록(가격 포함)이
//    채워지므로 눌러 가며 마지막 단계에서 읽는다. 첫 단계 가격은 범위("141,500 ~ 243,000")라 쓰지 않는다.
//  · 추가상품: "부자재" 영역(.bot_addPrd_section)의 항목 이름·판매가.
// 셀러가 입력하는 재고번호(관리코드)는 구매자 페이지에 나오지 않는다(2026-09-30 확인) — 그래서 이름·규격으로 짝짓는다(worker.js).
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitUntil(fn, timeout = 12000, step = 250) {
    const end = Date.now() + timeout;
    for (;;) {
      const value = fn();
      if (value) return value;
      if (Date.now() > end) return null;
      await sleep(step);
    }
  }
  const cleanText = node => String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  const numberOf = value => {
    const digits = String(value ?? '').replace(/[^0-9]/g, '');
    return digits ? Number(digits) : null;
  };
  const productId = () => (location.pathname.match(/^\/products\/(\d+)\/?$/) || [])[1] || '';
  const blocked = () => /자동\s*입력\s*방지|비정상적인\s*접근|접근이\s*제한|Access\s*Denied|captcha/i.test(`${document.title} ${document.body?.innerText || ''}`.slice(0, 3000));
  const optionSections = () => [...document.querySelectorAll('.accordion_section.bot_option_section')];
  const itemsOf = section => section ? [...section.querySelectorAll('.option_item')] : [];
  const rowOf = li => ({
    name: String(li.dataset?.dtloptnm || cleanText(li.querySelector?.('strong')) || '').trim(),
    stck: li.dataset?.stckno || null,
    price: numberOf(li.dataset?.price),
    rangePrice: /~/.test(String(li.dataset?.price || '')),
    qty: li.dataset?.stckqty != null && li.dataset.stckqty !== '' ? Number(li.dataset.stckqty) : null,
  });

  async function collectOptions() {
    if (!await waitUntil(() => itemsOf(optionSections()[0]).length)) return { ok: false, error: '옵션 목록을 찾지 못했습니다.' };
    // 페이지 스크립트가 옵션 클릭 동작을 붙일 시간을 준다(로딩이 끝나고 잠시 더).
    await waitUntil(() => document.readyState === 'complete', 10000);
    await sleep(500); // 클릭이 안 먹으면 아래에서 다시 누르므로 길게 기다리지 않는다
    const levels = optionSections().length;
    const rows = [];
    async function explore(level, path) {
      const count = itemsOf(optionSections()[level]).length;
      for (let i = 0; i < count; i++) {
        const li = itemsOf(optionSections()[level])[i];
        if (!li) continue;
        const row = rowOf(li);
        if (level === levels - 1) {
          if (!row.price) return { ok: false, error: `"${[...path, row.name].join(' / ')}" 가격을 읽지 못했습니다.` };
          rows.push({ ...row, name: [...path, row.name].join(' / ') });
        } else {
          // 옵션 목록(li)은 서버에서 먼저 그려지고 클릭 동작은 페이지 스크립트가 나중에 붙인다 — 너무 일찍 누르면 아무 일도 안 일어난다
          // (2026-09-30 실검사에서 "다음 단계 옵션 목록을 찾지 못했습니다" 4건). 그래서 못 찾으면 몇 번 더 눌러 본다.
          // 다음 단계 목록이 "새로 채워졌는지"는 옵션 고유번호(stckno) 목록이 눌러 보기 전과 달라졌는지로 안다 — 옵션마다 고유번호가 달라서
          // 이전 묶음의 옛 목록과 헷갈리지 않고, 고정 대기(옵션 묶음마다 1초) 없이 바뀌는 즉시 다음으로 넘어간다(옵션이 많은 2단 상품이 느리던 원인).
          const nextSignature = () => itemsOf(optionSections()[level + 1]).map(item => item.dataset?.stckno || item.dataset?.dtloptnm || '').join(',');
          const before = nextSignature();
          let found = false;
          for (let attempt = 0; attempt < 3 && !found; attempt++) {
            (li.querySelector('a,button') || li).click();
            found = !!await waitUntil(() => { const now = nextSignature(); return now && now !== before; }, 2500, 100);
          }
          if (!found) return { ok: false, error: `"${row.name}" 다음 단계 옵션 목록을 찾지 못했습니다.` };
          await sleep(100); // 새 목록이 다 그려질 짧은 여유
          const failed = await explore(level + 1, [...path, row.name]);
          if (failed) return failed;
        }
      }
      return null;
    }
    const failed = await explore(0, []);
    return failed || { ok: true, rows };
  }

  function collectSupplements() {
    const section = document.querySelector('.accordion_section.bot_addPrd_section');
    return itemsOf(section).map(li => {
      const name = String(li.dataset?.dtloptnm || cleanText(li.querySelector('strong')) || cleanText(li).split(/\s*판매가/)[0] || '').trim();
      const priceText = li.dataset?.price || (cleanText(li).match(/판매가\s*([0-9][0-9,]*)\s*원/) || [])[1];
      const qty = li.dataset?.stckqty != null && li.dataset.stckqty !== '' ? Number(li.dataset.stckqty) : null;
      return { label: name, finalPrice: numberOf(priceText), soldOut: qty === 0 || /품절/.test(cleanText(li)), stck: li.dataset?.stckno || null };
    }).filter(row => row.label);
  }

  async function collect(mode) {
    if (blocked()) return { ok: false, error: '사이트 확인 화면 — 브라우저에서 확인 후 이어서 검사해주세요.' };
    const id = productId();
    if (!id) return { ok: false, error: '11번가 상품번호 확인 불가' };
    const base = { ok: true, productId: id, productUrl: location.href, title: document.querySelector('h1')?.textContent?.trim() || document.title };
    if (mode === 'supplement') {
      // 추가상품 영역이 늦게 그려질 수 있어 잠시 기다린다(없는 상품은 빈 목록).
      await waitUntil(() => document.querySelector('.accordion_section.bot_addPrd_section .option_item') || document.querySelector('.accordion_section.bot_option_section .option_item'), 8000);
      return { ...base, supplements: collectSupplements() };
    }
    const options = await collectOptions();
    if (!options.ok) return options;
    return { ...base, rows: options.rows };
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'GET_11ST_SCAN_DATA') return;
    collect(message.mode === 'supplement' ? 'supplement' : 'options').then(respond, error => respond({ ok: false, error: error?.message || '11번가 상품 수집 실패' }));
    return true; // 비동기 응답
  });
})();
