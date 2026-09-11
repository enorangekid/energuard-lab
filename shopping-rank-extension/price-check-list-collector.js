// Reuse the existing list scraper; collect only the current listing page.
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='EG_PRICE_LIST_PAGE')return;
  const here=new URL(location.href);
  const current=Number(here.searchParams.get('page'))||1;
  const links=[...document.querySelectorAll('a[href]')];
  let next=null;
  for(const a of links){
    try{
      const url=new URL(a.href);
      if(url.origin!==here.origin || url.pathname!==here.pathname)continue;
      if(Number(url.searchParams.get('page'))===current+1){next=url.href;break;}
    }catch{}
  }
  const products=typeof scrapeProducts==='function'?scrapeProducts():[];
  respond({products,next,url:here.href});
});
