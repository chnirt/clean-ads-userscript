// ==UserScript==
// @name         Clean Ads Loader
// @description  Tải Clean Ads rồi chạy trong trang.
// @version      1.2
// @match        *://*/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      gist.githubusercontent.com
// @connect      gist.github.com
// ==/UserScript==

const run = (code) => { try { const el = document.documentElement; const s = document.createElement("script"); s.textContent = "document.documentElement.setAttribute('data-clean-ads','1');\n" + code; (document.head || el).appendChild(s); s.remove(); if (el && el.hasAttribute("data-clean-ads")) return; } catch (e) {} (0, eval)(code); };
(typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : GM.xmlHttpRequest)({ method: "GET", url: "https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js", onload: (r) => { if (r.status === 200 && r.responseText) run(r.responseText); } });
