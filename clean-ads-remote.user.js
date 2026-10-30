// ==UserScript==
// @name         Clean Ads Loader
// @description  Tải code Clean Ads từ gist, lưu lại, rồi chạy trong trang.
// @version      1.1
// @match        *://*/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      gist.githubusercontent.com
// @connect      gist.github.com
// ==/UserScript==

(async () => {
  const SRC =
    "https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js";
  const CACHE = "cleanAdsCode";
  const FLAG = "data-clean-ads";

  // Loader ở sandbox của extension để dùng GM.
  // Code tải về được nhét vào trang, nên chặn fetch và window.open vẫn có tác dụng.
  const run = (code) => {
    try {
      const s = document.createElement("script");
      s.textContent =
        `document.documentElement.setAttribute('${FLAG}','1');\n` + code;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) {}
    if (!document.documentElement.hasAttribute(FLAG)) {
      try {
        (0, eval)(code);
      } catch (e) {
        console.error("Clean Ads Remote:", e);
      }
    }
  };

  const gmGet = async (key, fallback) => {
    if (typeof GM !== "undefined" && typeof GM.getValue === "function") {
      return GM.getValue(key, fallback);
    }
    if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
    return fallback;
  };

  const gmSet = async (key, value) => {
    if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
      return GM.setValue(key, value);
    }
    if (typeof GM_setValue === "function") GM_setValue(key, value);
  };

  const download = () =>
    new Promise((resolve, reject) => {
      const details = {
        method: "GET",
        url: SRC + "?t=" + Date.now(),
        onload: (r) =>
          r.status === 200 && r.responseText
            ? resolve(r.responseText)
            : reject(r.status),
        onerror: reject,
      };

      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest(details);
        return;
      }

      if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function") {
        const pending = GM.xmlHttpRequest(details);
        if (pending && typeof pending.then === "function") {
          pending.then((r) => details.onload(r), reject);
        }
        return;
      }

      reject(new TypeError("GM.xmlHttpRequest is not a function"));
    });

  let cached = null;
  try {
    cached = await gmGet(CACHE, null);
  } catch (e) {}

  if (cached) {
    run(cached);
    download()
      .then((code) => {
        if (code !== cached) return gmSet(CACHE, code);
      })
      .catch(() => {});
  } else {
    try {
      const code = await download();
      await gmSet(CACHE, code);
      run(code);
    } catch (e) {
      console.error("Clean Ads Remote: không tải được code", e);
    }
  }
})();
