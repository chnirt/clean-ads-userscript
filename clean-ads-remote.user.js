// ==UserScript==
// @name         Clean Ads Loader
// @description  Tải Clean Ads rồi chạy trong trang.
// @version      1.3
// @match        *://*/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      gist.githubusercontent.com
// @connect      gist.github.com
// ==/UserScript==

const policyCache = new WeakMap();
const policyRules = {
  createHTML: (value) => value,
  createScript: (value) => value,
  createScriptURL: (value) => value,
};

const policyFor = (tt) => {
  if (!tt || typeof tt.createPolicy !== "function") return null;
  if (policyCache.has(tt)) return policyCache.get(tt);

  let policy = tt.defaultPolicy || null;

  if (!policy) {
    for (const name of ["clean-ads", "default", "dompurify"]) {
      try {
        policy = tt.createPolicy(name, policyRules);
        break;
      } catch (e) {}
    }
  }

  policyCache.set(tt, policy);
  return policy;
};

const trusted = (policy, value, kind) => {
  if (!policy) return value;

  try {
    return kind === "url" ? policy.createScriptURL(value) : policy.createScript(value);
  } catch (e) {
    return value;
  }
};

const run = (code) => {
  const el = document.documentElement;
  const boot = "document.documentElement.setAttribute('data-clean-ads','1');\n" + code;
  const pageTT = document.defaultView && document.defaultView.trustedTypes;
  const realmTT = typeof trustedTypes === "undefined" ? null : trustedTypes;
  const pagePolicy = policyFor(pageTT);
  const realmPolicy = realmTT === pageTT ? pagePolicy : policyFor(realmTT);

  try {
    const s = document.createElement("script");
    s.textContent = trusted(pagePolicy, boot);
    (document.head || el).appendChild(s);
    s.remove();
    if (el && el.hasAttribute("data-clean-ads")) return;
  } catch (e) {}

  try {
    const url = URL.createObjectURL(new Blob([boot], { type: "text/javascript" }));
    const s = document.createElement("script");
    s.src = trusted(pagePolicy, url, "url");
    s.onload = () => URL.revokeObjectURL(url);
    (document.head || el).appendChild(s);
    return;
  } catch (e) {}

  try {
    (0, eval)(trusted(realmPolicy, code));
  } catch (e) {
    console.debug("[Clean Ads]", e);
  }
};
(typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : GM.xmlHttpRequest)({ method: "GET", url: "https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js", onload: (r) => { if (r.status === 200 && r.responseText) run(r.responseText); } });
