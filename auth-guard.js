/* ENERGUARD LAB - shared authentication gate.
   Load this in <head>, after @supabase/supabase-js, on every private page. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
  const originalFetch = window.fetch.bind(window);
  const guardScriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("auth-guard.js", location.href).href;
  const loginUrl = new URL("login.html", guardScriptUrl);

  document.documentElement.classList.add("auth-checking");
  const style = document.createElement("style");
  style.textContent = [
    "html.auth-checking body{visibility:hidden!important}",
    "html.auth-ready body{visibility:visible!important}",
  ].join("");
  document.head.appendChild(style);

  function redirectToLogin() {
    const destination = location.pathname + location.search + location.hash;
    loginUrl.searchParams.set("redirect", destination);
    location.replace(loginUrl.href);
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("ENERGUARD LAB auth: Supabase SDK is not loaded.");
    redirectToLogin();
    return;
  }

  const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  authClient.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") redirectToLogin();
  });

  const ready = authClient.auth.getSession().then(function (result) {
    const session = result && result.data && result.data.session;
    if (!session || !session.access_token) {
      redirectToLogin();
      return null;
    }
    window.ENERGUARD_AUTH_SESSION = session;
    document.documentElement.classList.remove("auth-checking");
    document.documentElement.classList.add("auth-ready");
    return session;
  }).catch(function (error) {
    console.error("ENERGUARD LAB auth session check failed:", error);
    redirectToLogin();
    return null;
  });

  // Existing pages use the publishable key as the Bearer token. Once the app is
  // authenticated, transparently replace that token for Supabase requests.
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.startsWith(SUPABASE_URL)) return originalFetch(input, init);

    const session = await ready;
    if (!session) throw new Error("로그인이 필요합니다.");

    const nextInit = Object.assign({}, init || {});
    const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
    headers.set("apikey", SUPABASE_ANON_KEY);
    headers.set("Authorization", "Bearer " + session.access_token);
    nextInit.headers = headers;
    return originalFetch(input, nextInit);
  };

  window.energuardAuth = {
    client: authClient,
    ready: ready,
    getSession: function () { return ready; },
    signOut: async function () {
      await authClient.auth.signOut();
      location.replace(loginUrl.href);
    },
  };
  window.energuardAuthReady = ready;
})();
