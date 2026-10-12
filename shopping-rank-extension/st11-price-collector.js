// 11번가 상품 상세(https://www.11st.co.kr/products/번호)의 옵션·추가상품 가격을 읽는다. 읽기 전용 — 옵션 목록을 눌러 펼쳐 보기만 하고
// 장바구니·주문은 건드리지 않는다.
//  · 옵션: 각 옵션 항목(li.option_item)에 이름·판매가·재고·옵션 고유번호가 data 속성으로 붙어 있다(dtloptnm·price·stckqty·stckno).
//    1단 옵션은 바로 읽고, 2단 조합 옵션(예: 열반사 "종류 → 타입", 스티로폼 "종류 → 규격")은 첫 단계 항목을 눌러야 다음 단계 목록(가격 포함)이
//    채워지므로 눌러 가며 마지막 단계에서 읽는다. 첫 단계 가격은 범위("141,500 ~ 243,000")라 쓰지 않는다.
//    2단 옵션은 먼저 페이지가 클릭 때 부르는 주소(/products/번호/last-options?optNoArr=1:k — 다음 단계 옵션 JSON)를 직접 불러 한 번에 읽고(2026-10-08, 클릭 대기 없이 빠름),
//    그게 안 되거나 값이 이상하면 위의 클릭 방식으로 되돌아간다.
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

  /* 2단 옵션 빠른 읽기 — 첫 단계 항목마다 last-options JSON을 직접 불러(같은 출처 fetch) 다음 단계 옵션을 읽는다. 첫 단계 항목의 data-optno("1:k")가 요청 값이고,
     응답 infoList의 addPrc가 옵션 추가금이라 판매가 = (첫 단계 항목 가격 범위의 낮은 값 − 그 항목의 minaddprc) + addPrc. 클릭 방식과 같은 모양의 행을 돌려주고,
     어디서든 이상하면 null을 돌려줘서 클릭 방식으로 되돌아가게 한다(11번가가 주소를 바꿨을 때 대비). */
  async function fastTwoLevelRows() {
    const sections = optionSections();
    const id = productId();
    if (sections.length !== 2 || !id) return null;
    const firsts = itemsOf(sections[0]);
    if (!firsts.length) return null;
    async function readFirst(li) {
      const first = rowOf(li);
      if (first.qty === 0 || /disabled|soldout/.test(String(li.className || ''))) {
        // 품절 첫 단계 항목은 클릭 방식과 똑같이 처리한다(가격이 하나면 품절 행으로 남긴다).
        return first.price && !first.rangePrice ? [{ ...first, qty: 0, parts: [first.name] }] : [];
      }
      const optNo = li.dataset?.optno, minAdd = Number(li.dataset?.minaddprc), low = numberOf(String(li.dataset?.price || '').split('~')[0]);
      if (!optNo || !(low > 0) || !Number.isFinite(minAdd)) throw Error('첫 단계 옵션 정보 부족');
      const response = await fetch(`/products/${id}/last-options?optNoArr=${encodeURIComponent(optNo)}&selOptCnt=2&strNo=0&xSiteCode=&partnerPrdNos=`, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error(`last-options ${response.status}`);
      const list = (await response.json())?.infoList;
      if (!Array.isArray(list) || !list.length) throw Error('last-options 응답 없음');
      return list.map(info => {
        const name = String(info.dtlOptNm || '').trim(), addPrc = Number(info.addPrc), qty = Number(info.stckQty);
        if (!name || !Number.isFinite(addPrc) || !Number.isFinite(qty)) throw Error('last-options 값 이상');
        return { name: `${first.name} / ${name}`, parts: [first.name, name], stck: info.stckNo != null ? String(info.stckNo) : null, price: low - minAdd + addPrc, rangePrice: false, qty };
      });
    }
    try {
      const groups = [];
      for (let i = 0; i < firsts.length; i += 4) groups.push(...await Promise.all(firsts.slice(i, i + 4).map(readFirst))); // 4개씩 한꺼번에(순서는 그대로)
      const rows = groups.flat();
      return rows.length && rows.every(row => row.price > 0) ? rows : null;
    } catch { return null; }
  }

  // 옵션 단계별 항목 이름("필수옵션선택"·"제품선택 / 디자인선택"·"옵션명 1 / 옵션명 2") — 단계 머리글 "이름 옵션 보기"에서 읽는다. 옵션 엑셀 열 제목이 이 이름이다.
  const levelNames = () => optionSections().map(section => cleanText(section.firstElementChild).replace(/\s*옵션\s*보기\s*$/, '').trim());

  async function collectOptions() {
    if (!await waitUntil(() => itemsOf(optionSections()[0]).length, 6000)) {
      // 옵션이 없는 단품 상품(옵션 영역이 아예 없음)은 상품 가격 하나만 읽는다 — 우리 옵션이 하나뿐이면 worker가 그것과 짝짓는다.
      // 첫 "금액 원" 하나만 읽는다(같은 칸에 "판매가 안내…11번가…" 설명이 붙어 있어 숫자를 다 붙이면 틀린다).
      const singleMatch = String(document.querySelector('.b_product_info_price dd.price, .price_block dd.price')?.textContent || '').match(/([0-9][0-9,]*)\s*원/);
      const single = singleMatch ? Number(singleMatch[1].replace(/,/g, '')) : null;
      if (single) return { ok: true, levels: 0, levelNames: [], rows: [{ name: '(옵션 없음)', parts: ['(옵션 없음)'], stck: null, price: single, rangePrice: false, qty: null }] };
      return { ok: false, error: '옵션 목록을 찾지 못했습니다.' };
    }
    // 페이지 스크립트가 옵션 클릭 동작을 붙일 시간을 준다(로딩이 끝나고 잠시 더).
    await waitUntil(() => document.readyState === 'complete', 10000);
    await sleep(500); // 클릭이 안 먹으면 아래에서 다시 누르므로 길게 기다리지 않는다
    const levels = optionSections().length;
    if (levels === 2) {
      const fast = await fastTwoLevelRows();
      if (fast) return { ok: true, levels, levelNames: levelNames(), rows: fast };
    }
    const rows = [];
    async function explore(level, path) {
      const count = itemsOf(optionSections()[level]).length;
      for (let i = 0; i < count; i++) {
        const li = itemsOf(optionSections()[level])[i];
        if (!li) continue;
        const row = rowOf(li);
        if (level === levels - 1) {
          if (!row.price) return { ok: false, error: `"${[...path, row.name].join(' / ')}" 가격을 읽지 못했습니다.` };
          rows.push({ ...row, name: [...path, row.name].join(' / '), parts: [...path, row.name] });
        } else if (row.qty === 0 || /disabled|soldout/.test(String(li.className || ''))) {
          // 품절 1단계 항목(예: "SSEN 폼건")은 눌러도 다음 단계 목록이 없다 — 가격이 하나면 품절(재고 0) 행으로 남기고 다음으로 넘어간다.
          if (row.price && !row.rangePrice) rows.push({ ...row, name: [...path, row.name].join(' / '), parts: [...path, row.name], qty: 0 });
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
    return failed || { ok: true, levels, levelNames: levelNames(), rows };
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
    return { ...base, levels: options.levels, levelNames: options.levelNames, rows: options.rows };
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'GET_11ST_SCAN_DATA') return;
    collect(message.mode === 'supplement' ? 'supplement' : 'options').then(respond, error => respond({ ok: false, error: error?.message || '11번가 상품 수집 실패' }));
    return true; // 비동기 응답
  });
})();
