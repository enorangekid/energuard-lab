window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'EG_PRICE_TEST_REQUEST') return;
  const { requestId, action, payload } = event.data;
  if (!['ping','start','status','pause','resume'].includes(action)) return;
  try {
    const result = await chrome.runtime.sendMessage({ type:'EG_PRICE_TEST', action, payload });
    window.postMessage({ type:'EG_PRICE_TEST_RESPONSE', requestId, result }, location.origin);
  } catch (error) {
    window.postMessage({ type:'EG_PRICE_TEST_RESPONSE', requestId, result:{ok:false,error:error.message} }, location.origin);
  }
});
