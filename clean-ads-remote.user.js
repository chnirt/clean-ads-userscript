// ==UserScript==
// @name         Clean Ads Loader
// @description  Tải code Clean Ads từ gist một lần lúc cài, chạy không cần hỏi quyền.
// @version      1.0
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// @require      https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js
// ==/UserScript==

(async () => {
  const SRC =
    "https://gist.githubusercontent.com/chnirt/fa5a2886949e1e72da908d8bcfabf144/raw/clean-ads.user.js";
  const CACHE = "cleanAdsCode";
  const FLAG = "data-clean-ads";

  // Chạy code trong ngữ cảnh trang (để chặn fetch, window.open... có tác dụng).
  // Nếu trang có CSP chặn inline script thì lùi về chạy trong extension.
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

  const download = () =>
    new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        url: SRC + "?t=" + Date.now(), // tránh cache cũ của CDN
        onload: (r) =>
          r.status === 200 && r.responseText
            ? resolve(r.responseText)
            : reject(r.status),
        onerror: reject,
      });
    });

  let cached = null;
  try {
    cached = await GM.getValue(CACHE, null);
  } catch (e) {}

  if (cached) {
    run(cached); // chạy ngay bản đã lưu, không chờ mạng
    download()
      .then((code) => {
        if (code !== cached) GM.setValue(CACHE, code);
      })
      .catch(() => {});
  } else {
    try {
      const code = await download();
      await GM.setValue(CACHE, code);
      run(code);
    } catch (e) {
      console.error("Clean Ads Remote: không tải được code", e);
    }
  }
})();
