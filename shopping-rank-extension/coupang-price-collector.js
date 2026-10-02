(()=>{
  const number=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const text=String(value??'').replace(/[^\d.-]/g,'');
    const parsed=Number(text);return text&&Number.isFinite(parsed)?parsed:null;
  };
  const firstNumber=(...values)=>{for(const value of values){const n=number(value);if(n!=null&&n>0)return n;}return null;};

  function flightValues(){
    const values=[];
    for(const script of document.scripts||[]){
      const text=String(script.textContent||'').trim();
      if(!text.includes('self.__next_f.push(')||!text.includes('vendorItemId'))continue;
      const match=/\.push\((\[[\s\S]*\])\)\s*;?$/.exec(text);
      if(!match)continue;
      try{
        const packet=JSON.parse(match[1]);
        if(typeof packet?.[1]==='string')values.push(packet[1]);
      }catch{}
    }
    return values;
  }

  function collectObjects(value,visit,seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return;
    seen.add(value);visit(value);
    for(const child of Array.isArray(value)?value:Object.values(value))collectObjects(child,visit,seen);
  }

  function parsePriceBundle(object){
    const price=Array.isArray(object.quantityBase)?object.quantityBase[0]?.price:null;
    const list=Array.isArray(price?.priceList)?price.priceList:[];
    const listed=label=>firstNumber(list.find(row=>String(row?.title||row?.label||'').includes(label))?.price);
    const finalPrice=firstNumber(price?.i18nCouponPrice?.amount,price?.finalPrice?.amount,price?.finalPrice,price?.couponPrice?.amount,price?.couponPrice,price?.salePrice?.amount,price?.salePrice,price?.priceAmount,listed('할인가'));
    const registeredPrice=firstNumber(price?.i18nOriginPrice?.amount,price?.originPrice?.amount,price?.originPrice,price?.originalPrice?.amount,price?.originalPrice,listed('쿠팡판매가'),price?.priceAmount,finalPrice);
    let discountRate=firstNumber(price?.discountRate);
    if(discountRate==null&&registeredPrice&&finalPrice&&registeredPrice>=finalPrice)discountRate=Math.round((registeredPrice-finalPrice)*100/registeredPrice);
    return {registeredPrice,finalPrice:finalPrice||registeredPrice,discountRate:discountRate??0};
  }

  function embeddedRows(requested){
    const wanted=new Set((requested||[]).map(String));
    const rows=new Map();
    for(const payload of flightValues()){
      // 한 push 문자열에 React Flight 레코드가 여러 줄 들어올 수 있다. 각 `id:JSON` 레코드를 따로 읽는다.
      const trees=[];
      for(const record of payload.split('\n')){
        const colon=record.indexOf(':'),bracket=record.indexOf('[',colon+1),brace=record.indexOf('{',colon+1);
        const start=bracket<0?brace:brace<0?bracket:Math.min(bracket,brace);
        if(colon<0||start<0)continue;
        try{trees.push(JSON.parse(record.slice(start)));}catch{}
      }
      for(const tree of trees)collectObjects(tree,object=>{
        const optionId=String(object.vendorItemId??'');
        if(!/^\d+$/.test(optionId)||(wanted.size&&!wanted.has(optionId)))return;
        const prices=parsePriceBundle(object);
        if(!prices.registeredPrice&&!prices.finalPrice)return;
        const previous=rows.get(optionId)||{};
        rows.set(optionId,{
          ...previous,optionId,
          name:object.itemName||object.vendorItemName||previous.name||'',
          ...prices,
          soldOut:Boolean(object.soldOut)||Number(object.buyableQuantity)===0,
          invalid:Boolean(object.invalid),
          sellerName:object.vendor?.name||object.sellerName||previous.sellerName||null,
        });
      });
    }
    return [...rows.values()];
  }

  /* 페이지 데이터에 없는 옵션(보통 처음 열린 기본 선택 옵션)은 화면에 보이는 가격으로 읽는다.
     가격 영역(price-container)의 글자는 "12%56,140원(1개당 5,614원)63,800원7,660원할인"처럼 숫자가 여러 개 붙어 있어서(2026-10-02 실제 화면 확인)
     글자를 지우고 숫자만 이으면 5,614,015,614 같은 값이 나온다 — "숫자원" 단위로 하나씩 읽는다: "(1개당 …원)"과 "…원할인"을 빼면 첫 가격 = 할인가, 그다음 가격 = 쿠팡 등록가(취소선).
     페이지 다른 곳의 취소선(del/s — 함께 구매한 상품 등)은 등록가가 아니라서 쓰지 않는다. 등록가를 못 읽으면 null로 두고, 비교는 할인가로만 한다(worker.js matchCoupangOptions). */
  const priceTexts=text=>{
    const cleaned=String(text||'').replace(/\s+/g,' ').replace(/\(\s*1개당\s*[\d,]+\s*원\s*\)/g,' ');
    return [...cleaned.matchAll(/(\d[\d,]*)\s*원(?!\s*할인)/g)].map(m=>number(m[1])).filter(n=>n&&n>100);
  };
  function visibleFallback(optionId){
    const body=String(document.body?.innerText||'');
    const shown=priceTexts(document.querySelector('[class*="price-container"]')?.textContent);
    let finalPrice=shown[0]??null,registeredPrice=null;
    if(shown.length===1)registeredPrice=shown[0];
    else if(shown.length>1&&shown[1]>=shown[0])registeredPrice=shown[1];
    if(!finalPrice)finalPrice=priceTexts(document.querySelector('[class*="final-price"], [class*="sale-price"], .total-price strong')?.textContent)[0]??null;
    if(!finalPrice)return null;
    const seller=[...document.querySelectorAll('a')].find(a=>/shop\.coupang\.com/.test(a.href||''))?.textContent?.trim()||null;
    return {optionId:String(optionId||''),name:document.querySelector('h1')?.textContent?.trim()||'',registeredPrice,finalPrice,discountRate:registeredPrice&&registeredPrice>finalPrice?Math.round((registeredPrice-finalPrice)*100/registeredPrice):0,soldOut:/품절|일시품절/.test(body),invalid:false,sellerName:seller,fallback:true};
  }

  function scan(requested){
    const url=new URL(location.href);const match=/^\/vp\/products\/(\d+)\/?$/.exec(url.pathname);
    if(!match)return {ok:false,error:'쿠팡 상품 페이지가 아닙니다.'};
    const body=String(document.body?.innerText||'');
    // 성인 인증 상품 — "본 상품은 연령확인이 필요합니다 / 휴대폰 번호로 인증하기" 화면. 차단이 아니라 이 상품만 읽을 수 없는 것이다.
    if(/연령\s*확인이\s*필요|청소년\s*유해매체물|휴대폰\s*번호로\s*인증하기/.test(body))return {ok:false,adult:true,productId:match[1],error:'쿠팡 성인 인증이 필요한 상품'};
    const blockMatch=/접속이 제한|자동화된 접근|Access Denied|CAPTCHA|로봇이 아닙니다|사용권한이 (?:없|제한)/i.exec(body);
    // 어떤 문구 때문에 차단으로 봤는지 함께 알려 준다 — 진짜 차단 화면인지, 정상 페이지의 글자를 잘못 집은 건지 구분하기 위해.
    if(blockMatch)return {ok:false,blocked:true,error:`쿠팡 사이트 확인 화면 또는 접근 차단 ("${blockMatch[0]}" · 페이지 첫 글 "${body.replace(/\s+/g,' ').trim().slice(0,40)}")`};
    const rows=embeddedRows(requested);
    const selected=url.searchParams.get('vendorItemId');
    if(selected&&!rows.some(row=>row.optionId===selected)){
      const fallback=visibleFallback(selected);if(fallback)rows.push(fallback);
    }
    return {ok:rows.length>0,productId:match[1],selectedOptionId:selected,rows,error:rows.length?'':'쿠팡 옵션 가격을 찾지 못했습니다.'};
  }

  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message?.type!=='GET_COUPANG_SCAN_DATA')return;
    try{respond(scan(Array.isArray(message.optionIds)?message.optionIds:[]));}
    catch(error){respond({ok:false,error:error?.message||'쿠팡 상품 수집 실패'});}
  });
})();
