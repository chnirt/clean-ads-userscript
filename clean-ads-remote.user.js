// ==UserScript==
// @name         Clean Ads Loader
// @description  Tải Clean Ads từ gist rồi chạy trong trang.
// @version      1.4
// @match        *://*/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      gist.githubusercontent.com
// @connect      gist.github.com
// ==/UserScript==

// https://gist.github.com/chnirt/fa5a2886949e1e72da908d8bcfabf144
const GIST =
  "https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js";

const policies = new WeakMap();

const policyFor = (tt) => {
  if (!tt || typeof tt.createPolicy !== "function") return null;
  if (policies.has(tt)) return policies.get(tt);

  let policy = tt.defaultPolicy || null;
  if (!policy) {
    for (const name of ["clean-ads", "default"]) {
      try {
        policy = tt.createPolicy(name, {
          createScript: (value) => value,
          createScriptURL: (value) => value,
        });
        break;
      } catch (e) {}
    }
  }

  policies.set(tt, policy);
  return policy;
};

const trust = (tt, value, asUrl) => {
  const policy = policyFor(tt);
  if (!policy) return value;
  try {
    return asUrl ? policy.createScriptURL(value) : policy.createScript(value);
  } catch (e) {
    return value;
  }
};

const run = (code) => {
  const root = document.documentElement;
  const boot = "document.documentElement.setAttribute('data-clean-ads','1');\n" + code;
  const pageTT = document.defaultView && document.defaultView.trustedTypes;
  const parent = document.head || root;

  try {
    const s = document.createElement("script");
    s.textContent = trust(pageTT, boot);
    parent.appendChild(s);
    s.remove();
    if (root && root.hasAttribute("data-clean-ads")) return;
  } catch (e) {}

  try {
    const url = URL.createObjectURL(new Blob([boot], { type: "text/javascript" }));
    const s = document.createElement("script");
    s.src = trust(pageTT, url, true);
    s.onload = () => URL.revokeObjectURL(url);
    parent.appendChild(s);
  } catch (e) {
    try {
      const realmTT = typeof trustedTypes === "undefined" ? null : trustedTypes;
      (0, eval)(trust(realmTT, code));
    } catch (err) {
      console.debug("[Clean Ads]", err);
    }
  }
};

const xhr = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : GM.xmlHttpRequest;
xhr({
  method: "GET",
  url: GIST,
  onload: (r) => {
    if (r.status === 200 && r.responseText) run(r.responseText);
  },
});
