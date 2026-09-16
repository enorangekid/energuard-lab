// Naver resets direct page=2 navigation to page 1. Use rendered pagination.
let priceListNavigation=null;
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='EG_PRICE_LIST_PAGE')return;
  const here=new URL(location.href);
  const current=Number(document.querySelector('[role="menuitem"][aria-current="true"]')?.textContent)||1;
  const target=Number(message.targetPage)||current;
  const products=typeof scrapeProducts==='function'?scrapeProducts():[];
  const signature=products.map(p=>p.productId).join('|');
  const buttons=[...document.querySelectorAll('a[data-shp-area="list.pgn"][data-shp-contents-id]')].filter(el=>el.getAttribute('aria-hidden')!=='true');
  if(current!==target){
    if(!priceListNavigation || priceListNavigation.from!==current){
      const button=buttons.find(el=>Number(el.getAttribute('data-shp-contents-id'))===target) || buttons.find(el=>Number(el.getAttribute('data-shp-contents-id'))>current);
      if(button){priceListNavigation={from:current,signature};button.click();}
    }
    respond({products:[],currentPage:current,pending:true});return;
  }
  if(priceListNavigation && signature===priceListNavigation.signature){respond({products:[],currentPage:current,pending:true});return;}
  priceListNavigation=null;
  const nextButton=buttons.find(el=>Number(el.getAttribute('data-shp-contents-id'))===current+1);
  let next=null;
  if(nextButton){const u=new URL(here);u.searchParams.delete('cp');u.searchParams.set('page',String(current+1));next=u.href;}
  respond({products,next,currentPage:current,url:here.href});
});
