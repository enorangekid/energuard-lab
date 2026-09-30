// G마켓·옥션 상품 상세의 ESM 등록 판매가를 읽는다.
// 화면의 쿠폰적용가가 아니라 판매자가 등록한 할인 전 가격(기존가/원가)을 우선한다.
(() => {
  const won = value => {
    const match=String(value||'').match(/([0-9][0-9,]*)\s*원?/);
    const n=match?Number(match[1].replace(/,/g,'')):null;
    return Number.isFinite(n)&&n>0?n:null;
  };
  const market = () => location.hostname==='item.gmarket.co.kr'?'gmarket':location.hostname==='itempage3.auction.co.kr'?'auction':null;
  const productId = site => site==='gmarket'
    ? String(new URL(location.href).searchParams.get('goodscode')||'').trim()
    : String(new URL(location.href).searchParams.get('ItemNo')||new URL(location.href).searchParams.get('itemno')||'').trim().toUpperCase();
  const firstPrice=(root,selectors)=>{
    for(const selector of selectors){const node=root.querySelector(selector);const price=won(node?.textContent||node?.getAttribute?.('content'));if(price)return price;}
    return null;
  };
  const labeledPrice=(root,labels)=>{
    const pattern=new RegExp(`(?:${labels.join('|')})\\s*([0-9][0-9,]*)\\s*원`,'i');
    for(const node of [...root.querySelectorAll('del,span,strong,div')].slice(0,500)){
      const match=String(node.textContent||'').replace(/\s+/g,' ').match(pattern);
      if(match){const price=Number(match[1].replace(/,/g,''));if(Number.isFinite(price)&&price>0)return price;}
    }
    return null;
  };
  function collect(){
    const site=market();
    if(!site)return {ok:false,error:'지원하지 않는 ESM 상품 주소'};
    if(/잠시만 기다리십시오|봇\s*확인|bot\s*check/i.test(`${document.title} ${document.body?.innerText||''}`))return {ok:false,error:'사이트 확인 화면 — 브라우저에서 확인 후 이어서 검사해주세요.'};
    const id=productId(site);
    if(site==='gmarket'&&!/^\d+$/.test(id))return {ok:false,error:'G마켓 상품번호 확인 불가'};
    if(site==='auction'&&!/^[A-Z]\d+$/.test(id))return {ok:false,error:'옥션 상품번호 확인 불가'};
    const root=document.querySelector(site==='auction'?'#frmMain, .item-topinfo':'#itemcase_basic, .item-topinfo, #content')||document;
    // G마켓의 price_original 영역에는 "할인률 5% 기존가 9,100원"이 함께 들어올 수 있다.
    // 일반 숫자 파서보다 라벨 뒤 금액을 먼저 읽어 할인률을 가격으로 오인하지 않는다.
    let original=labeledPrice(root,site==='gmarket'?['기존가','원가']:['원가','기존가']);
    if(!original)original=firstPrice(root,['.price_original','del.price_original','.box__price-original','[class*="price_original"]']);
    const discounted=firstPrice(root,site==='auction'?['.price_coupon','.price > strong','.price strong']:['.price_real strong','.price_real','.box__price-seller strong','.box__price-seller']);
    const registeredPrice=original||discounted;
    return {ok:!!registeredPrice,marketplace:site,productId:id,productUrl:location.href,title:document.querySelector('h1')?.textContent?.trim()||document.title,registeredPrice,discountedPrice:discounted||null,error:registeredPrice?null:'등록 판매가를 찾지 못했습니다.'};
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message?.type!=='GET_ESM_SCAN_DATA')return;
    try{respond(collect());}catch(error){respond({ok:false,error:error?.message||'ESM 상품 수집 실패'});}
  });
})();
