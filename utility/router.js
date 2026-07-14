/* ─────────────────────────────────────────
   칸칸 — router.js  (SPA PJAX Router)
   ───────────────────────────────────────── */
'use strict';

(function () {
  const pageCache   = new Map(); // URL  → HTML text
  const scriptCache = new Map(); // path → script text

  // Scripts already loaded in the shell — skip per-page re-execution
  const SHELL_SCRIPTS = new Set(['sidebar.js', 'history.js', 'app.js', 'router.js']);

  let navigating = false;

  // ── Public API ──────────────────────────────────────────────────────────────
  window.KankanRouter = { navigate };

  // ── Hover preload ────────────────────────────────────────────────────────────
  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (a && isInternal(a) && !pageCache.has(a.href)) fetchPage(a.href);
  }, { passive: true });

  // ── Intercept link clicks ────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || !isInternal(a)) return;
    e.preventDefault();
    navigate(a.href);
  });

  // ── Browser back / forward ───────────────────────────────────────────────────
  window.addEventListener('popstate', () => navigate(location.href, { pushState: false }));

  // ── Navigate ─────────────────────────────────────────────────────────────────
  async function navigate(url, { pushState = true, replaceState = false } = {}) {
    if (navigating) return;
    const target = resolvedUrl(url);
    if (pushState && target === resolvedUrl(location.href)) return;

    navigating = true;
    scriptCache.clear(); // 매 이동마다 스크립트 재fetch
    try {
      const html = await fetchPage(target);
      if (!html) { location.href = url; return; }

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newMain = doc.querySelector('main.main-content');
      if (!newMain) { location.href = url; return; }

      // Swap <main> content
      const mainEl = document.querySelector('main.main-content');
      const clone = newMain.cloneNode(true);
      clone.querySelectorAll('script').forEach(s => s.remove());
      // 계산기 조각에 남아 있는 구형 푸터는 셸의 공통 푸터와 중복되므로 주입하지 않는다.
      clone.querySelectorAll('.site-footer').forEach(footer => footer.remove());
      mainEl.innerHTML = clone.innerHTML;

      // Fix relative hrefs in injected content
      fixLinks(document.querySelector('main.main-content'), target);

      // Update URL, title, body class
      if (pushState) history.pushState({}, doc.title, target);
      else if (replaceState) history.replaceState({}, doc.title, target);
      document.title = doc.title;
      document.body.className = doc.body.className || document.body.className;
      document.documentElement.classList.remove('is-direct-calc');

      window.scrollTo(0, 0);

      // Refresh sidebar active state
      if (typeof renderSidebar === 'function') renderSidebar();

      // Track recent calc visit
      if (!doc.body.classList.contains('home') && typeof trackRecentCalc === 'function') {
        const pagePath = new URL(target).pathname.replace(/^\//, '');
        outer: for (const section of NAV_ITEMS) {
          for (const item of section.items) {
            if (item.url && (pagePath === item.url || pagePath.endsWith('/' + item.url))) {
              trackRecentCalc(item.name, item.url);
              break outer;
            }
          }
        }
      }

      // Execute page-specific scripts
      await runPageScripts(doc, target);

      // Home page re-init
      if (document.body.classList.contains('home') && typeof initHomePage === 'function') {
        initHomePage();
      }

      // Clear MPA-era sessionStorage
      sessionStorage.removeItem('kankan_open_cat');

    } catch (err) {
      console.error('[Router]', err);
      document.documentElement.classList.remove('is-direct-calc');
      location.href = url;
    } finally {
      navigating = false;
    }
  }

  // ── Fetch page HTML with cache ───────────────────────────────────────────────
  // Cache keyed on path only — static .html files serve the same content
  // regardless of query params, which carry form-restore state.
  async function fetchPage(url) {
    const key = url.split('?')[0];
    if (pageCache.has(key)) return pageCache.get(key);
    try {
      const res = await fetch(key);
      if (!res.ok) return null;
      const text = await res.text();
      pageCache.set(key, text);
      return text;
    } catch { return null; }
  }

  // ── Resolve relative hrefs in injected <main> ────────────────────────────────
  function fixLinks(el, baseUrl) {
    const target = new URL(baseUrl, location.origin);
    const base = target.pathname.endsWith('/utility.html')
      ? new URL('utility/', target)
      : target;
    el.querySelectorAll('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      if (!raw || /^(https?:|\/|#|mailto:|tel:|javascript:)/.test(raw)) return;
      try { a.setAttribute('href', new URL(raw, base).pathname); } catch {}
    });
  }

  // ── Run page-specific scripts ────────────────────────────────────────────────
  // Each script is fetched as text and executed in an IIFE that intercepts
  // document.addEventListener('DOMContentLoaded', fn) → calls fn() immediately
  // (DOMContentLoaded never re-fires in SPA, so we simulate it).
  async function runPageScripts(doc, baseUrl) {
    // Remove scripts injected by previous SPA navigation
    document.querySelectorAll('script[data-spa]').forEach(s => s.remove());

    for (const script of doc.querySelectorAll('script')) {
      const src = script.getAttribute('src');
      console.log('[Router] script 발견:', src);

      // Skip shell scripts
      if (src && SHELL_SCRIPTS.has(src.split('/').pop().split('?')[0])) {
        console.log('[Router] shell 스킵:', src);
        continue;
      }

      // Skip guard scripts
      const inlineText = script.textContent.trim();
      if (!src && inlineText.includes('KankanRouter') && inlineText.includes('location.replace')) continue;

      let text;
      if (src) {
        const abs = new URL(src, baseUrl).pathname;
        text = await fetchScriptText(abs);
        if (text === null) continue;
      } else {
        text = script.textContent.trim();
        if (!text) continue;
      }

      const s = document.createElement('script');
      s.dataset.spa = '';
      s.textContent  = spaWrap(text);
      document.body.appendChild(s);
    }
  }

  // Fetch script text (cached)
  async function fetchScriptText(path) {
    if (scriptCache.has(path)) return scriptCache.get(path);
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const text = await res.text();
      scriptCache.set(path, text);
      return text;
    } catch { return null; }
  }

  // Wrap script in IIFE:
  //   1. Scopes all const/let/var to prevent re-declaration on repeated navigation
  //   2. Intercepts document.addEventListener('DOMContentLoaded', fn) to call fn()
  //      immediately (since DOMContentLoaded won't fire again in SPA context)
  function spaWrap(text) {
    return `;(function(){
var __dcl=[];
var __origAEL=document.addEventListener.bind(document);
document.addEventListener=function(type,fn,opts){
  if(type==='DOMContentLoaded'){__dcl.push(fn);}
  else{__origAEL(type,fn,opts);}
};
try{
${text}
}finally{
  document.addEventListener=__origAEL;
  if(document.readyState!=='loading'){
    __dcl.forEach(function(fn){try{fn();}catch(e){console.error(e);}});
  }else{
    __dcl.forEach(function(fn){__origAEL('DOMContentLoaded',fn);});
  }
}
})();`;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function isInternal(a) {
    if (a.target === '_blank') return false;
    if (a.hostname !== location.hostname) return false;
    const h = a.getAttribute('href') || '';
    return !/^(#|mailto:|tel:|javascript:)/.test(h);
  }

  function resolvedUrl(url) {
    try {
      const u = new URL(url, location.href);
      if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.slice(0, -10) || '/';
      return u.href;
    } catch { return url; }
  }
})();
