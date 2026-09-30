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
    return {ok:!!registeredPrice,marketplace:site,productId:id,productUrl:location.href,title:document.querySelector('h1')?.textContent?.trim()||document.title,registeredPrice,discountedPrice:discounted||null,hasOriginal:!!original,error:registeredPrice?null:'등록 판매가를 찾지 못했습니다.'};
  }

  // ── 옵션 상품(단열벽지) — G마켓·옥션은 "단열벽지 → 사이즈 → 디자인" 3단 조합 옵션이다(그룹상품이 아님).
  // 가격은 사이즈 단계에서 정해진다(디자인 단계 가격은 사이즈와 같다).
  //  · G마켓: 사이즈 목록에 "10m58,400원"처럼 등록가가 그대로 보인다.
  //  · 옥션: 사이즈 목록엔 가격이 없고, 디자인 목록에 "(+38,800원)"처럼 대표 등록가(원가) 대비 추가금이 보인다 → 원가 + 추가금.
  // 옵션 목록은 클릭해야 채워지므로 읽기 전용으로 눌러 보기만 한다(주문·장바구니는 건드리지 않는다).
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitUntil(fn,timeout=12000,step=250){const end=Date.now()+timeout;for(;;){const value=fn();if(value)return value;if(Date.now()>end)return null;await sleep(step);}}
  const cleanText=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const optionBoxes=site=>{
    const root=document.querySelector(site==='gmarket'?'.goods_option':'.optiontype.type_selection');
    return root?[...root.querySelectorAll('.item_options')].filter(box=>!box.classList?.contains('item_delivery')).slice(0,3):[];
  };
  const optionLinks=(box,site)=>box?[...box.querySelectorAll(site==='gmarket'?'.select-itemoption-list li a.link':'.select-itemoption-list li a')]:[];
  async function collectOptions(){
    const site=market();
    const base=collect();
    if(!base.ok)return base;
    // 할인이 없는 옥션 상품은 "원가" 표시 없이 "판매가"만 보인다 — 그 값이 대표 등록가라 그대로 기준으로 쓴다(collect가 폴백으로 읽음).
    const listItems=box=>box?[...box.querySelectorAll('.select-itemoption-list li')]:[];
    if(!await waitUntil(()=>listItems(optionBoxes(site)[0]).length))return {ok:false,error:'옵션 목록을 찾지 못했습니다.'};
    // 1단 옵션 상품(타이거폼 2K·라이트폼 세트 "제품선택: 경질 / 연질") — 누를 것 없이 목록에 보이는 "(+32,400원)" 추가금을 첫 옵션 등록가(기존가/원가)에 더한다.
    // (추가금 표시가 없는 항목은 0원, 품절 항목은 가격을 알 수 없어 prices를 비운다.)
    if(optionBoxes(site).length===1){
      const oneRows=listItems(optionBoxes(site)[0]).map(item=>{
        const text=cleanText(item);
        const match=text.match(/\(([+-]?)\s*([0-9][0-9,]*)\s*원\)/);
        const addOn=match?(match[1]==='-'?-1:1)*Number(match[2].replace(/,/g,'')):0;
        const name=text.replace(/\(([+-]?)\s*[0-9][0-9,]*\s*원\)/,'').replace(/\s*[0-9,+]+\s*개\s*남음.*$/,'').replace(/\s*(일시)?품절.*$/,'').replace(/\s+/g,' ').trim();
        return {type:name,size:'',prices:/품절/.test(text)?[]:[base.registeredPrice+addOn]};
      }).filter(row=>row.type);
      if(!oneRows.length)return {ok:false,error:'옵션 목록을 읽지 못했습니다.'};
      return {ok:true,marketplace:base.marketplace,productId:base.productId,productUrl:base.productUrl,title:base.title,registeredPrice:base.registeredPrice,rows:oneRows};
    }
    if(!await waitUntil(()=>optionLinks(optionBoxes(site)[0],site).length))return {ok:false,error:'옵션 목록을 찾지 못했습니다.'};
    const rows=[];
    const typeCount=optionLinks(optionBoxes(site)[0],site).length;
    for(let i=0;i<typeCount;i++){
      const link=optionLinks(optionBoxes(site)[0],site)[i];
      const type=String(link.dataset?.optionnm||cleanText(link)).trim();
      link.click();
      if(!await waitUntil(()=>optionLinks(optionBoxes(site)[1],site).length))return {ok:false,error:`"${type}" 사이즈 목록을 찾지 못했습니다.`};
      const sizeCount=optionLinks(optionBoxes(site)[1],site).length;
      for(let j=0;j<sizeCount;j++){
        const sizeLink=optionLinks(optionBoxes(site)[1],site)[j];
        if(site==='gmarket'){
          const match=cleanText(sizeLink).match(/^(.+?m)\s*([0-9][0-9,]*)\s*원$/i);
          if(!match)return {ok:false,error:`"${type}" 사이즈 가격을 읽지 못했습니다: ${cleanText(sizeLink)}`};
          rows.push({type,size:match[1].replace(/\s+/g,''),prices:[Number(match[2].replace(/,/g,''))]});
        } else {
          const size=cleanText(sizeLink);
          sizeLink.click();
          await sleep(1200);
          if(!await waitUntil(()=>optionLinks(optionBoxes(site)[2],site).length))return {ok:false,error:`"${type} ${size}" 디자인 목록을 찾지 못했습니다.`};
          // 추가금이 0원인 디자인은 "(+…원)" 표시가 없고, 품절 디자인은 "(품절)"만 있어 가격을 알 수 없다 → 품절은 빼고, 표시 없는 디자인은 추가금 0으로 본다.
          const addOns=[...new Set(optionLinks(optionBoxes(site)[2],site).filter(node=>!/품절/.test(cleanText(node))&&!/soldout/.test(String(node.closest?.('li')?.className||''))).map(node=>{
            const match=cleanText(node).match(/\(([+-]?)\s*([0-9][0-9,]*)\s*원\)/);
            return match?(match[1]==='-'?-1:1)*Number(match[2].replace(/,/g,'')):0;
          }))];
          rows.push({type,size:size.replace(/\s+/g,''),prices:addOns.map(addOn=>base.registeredPrice+addOn)});
        }
      }
    }
    return {ok:true,marketplace:base.marketplace,productId:base.productId,productUrl:base.productUrl,title:base.title,registeredPrice:base.registeredPrice,rows};
  }
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message?.type==='GET_ESM_OPTION_SCAN_DATA'){
      collectOptions().then(respond,error=>respond({ok:false,error:error?.message||'ESM 옵션 수집 실패'}));
      return true; // 비동기 응답
    }
    if(message?.type!=='GET_ESM_SCAN_DATA')return;
    try{respond(collect());}catch(error){respond({ok:false,error:error?.message||'ESM 상품 수집 실패'});}
  });
})();
