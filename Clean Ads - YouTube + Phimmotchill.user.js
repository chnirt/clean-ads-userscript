
// ==UserScript==
// @name         Clean Ads - YouTube + Phimmotchill
// @description  Hide ads on YouTube, Phimmotchill, Motchill and RoPhim, skip player ads, and block ad popups and blank new tabs
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'cleanAdsSelectors';
  const hostname = location.hostname.toLowerCase();

  const isYouTube =
    /(^|\.)youtube\.com$/.test(hostname) ||
    /(^|\.)youtube-nocookie\.com$/.test(hostname);

  const isPhimmotchill =
    /(^|\.)phimmotchill\.bar$/.test(hostname);

  const isMotchillTu =
    /(^|\.)motchilltu\.com$/.test(hostname);

  const isRoPhim =
    /(^|\.)rophim10\.cam$/.test(hostname);

  const isStreamSite = isPhimmotchill || isMotchillTu || isRoPhim;

  const isEmbeddedFrame = (() => {
    try {
      return window.top !== window.self;
    } catch (_) {
      return true;
    }
  })();

  const referrerHost = (() => {
    try {
      return new URL(document.referrer).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  })();

  const fromStreamSite =
    /(^|\.)phimmotchill\.bar$/.test(referrerHost) ||
    /(^|\.)motchilltu\.com$/.test(referrerHost) ||
    /(^|\.)rophim10\.cam$/.test(referrerHost);

  const isPlayerHost =
    /(^|\.)yeuphim\.biz$/.test(hostname) ||
    /(^|\.)devwithai\.net$/.test(hostname);

  const inPlayerFrame =
    isPlayerHost ||
    (isEmbeddedFrame && fromStreamSite);

  const ancestorIsStream = (() => {
    try {
      const origins = location.ancestorOrigins;
      if (!origins || !origins.length) return false;

      for (let i = 0; i < origins.length; i += 1) {
        const host = new URL(origins[i]).hostname.toLowerCase();

        if (
          /(^|\.)phimmotchill\.bar$/.test(host) ||
          /(^|\.)motchilltu\.com$/.test(host) ||
          /(^|\.)rophim10\.cam$/.test(host)
        ) {
          return true;
        }
      }
    } catch (_) {}

    return false;
  })();

  const guardPopups = isStreamSite || inPlayerFrame || ancestorIsStream;

  // Các domain quảng cáo phổ biến
  const adDomains = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'amazon-adsystem.com',
    'adnxs.com',
    'taboola.com',
    'outbrain.com',
    'popads.net',
    'propellerads.com',
    'exoclick.com',
    'adsterra.com',
    'mgid.com',
    'revcontent.com',
    'pubmatic.com',
    'rubiconproject.com',
    'zedo.com',
    'juicyads.com',
    'onclickads.net',
    'popcash.net',
    'histats.com',
    'adform.net',
    'adroll.com',
    'adsrvr.org',
    'smartadserver.com',
    'sharethrough.com',
    'openx.net',
    'yieldmo.com',
    'bidswitch.net',
    'criteo.com',
    'criteo.net',
    'itvmovies.me'
  ];

  // Kiểm tra URL có thuộc domain quảng cáo không
  function isAdURL(input) {
    try {
      let raw = input;

      if (input && typeof input === 'object') {
        raw = input.url || input.href || String(input);
      }

      if (typeof raw !== 'string' || !raw) return false;

      const parsed = new URL(raw, location.href);
      const h = parsed.hostname.toLowerCase();

      const knownAdHost = adDomains.some(domain =>
        h === domain || h.endsWith(`.${domain}`)
      ) || /^adservice\.google\./.test(h);

      return knownAdHost || /\/c-cl\.php$/i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function isContentHost(host) {
    const h = String(host || '').toLowerCase().replace(/\.$/, '');

    if (!h) return false;
    if (h === hostname) return true;

    return [
      'phimmotchill.bar',
      'motchilltu.com',
      'rophim10.cam',
      'yeuphim.biz',
      'devwithai.net',
      'youtube.com',
      'youtube-nocookie.com'
    ].some(domain => h === domain || h.endsWith(`.${domain}`));
  }

  function isNewTabTarget(target) {
    const name = String(target ?? '').trim();
    const lower = name.toLowerCase();

    if (!name || lower === '_blank' || lower === '_new') return true;
    if (lower === '_self' || lower === '_parent' || lower === '_top') {
      return false;
    }

    try {
      if (window.frames && window.frames[name]) return false;
    } catch (_) {}

    return true;
  }

  function isBlankPopupURL(raw) {
    return (
      raw === '' ||
      /^about:/i.test(raw) ||
      /^javascript:/i.test(raw) ||
      /^data:/i.test(raw) ||
      /^blob:/i.test(raw)
    );
  }

  // open/script: mọi tab mới trên trang phim. click: vẫn cho mở link cùng site.
  function shouldBlockPopup(url, target, source) {
    const raw = url == null ? '' : String(url).trim();

    if (raw && isAdURL(raw)) return true;
    if (!guardPopups) return false;
    if (isBlankPopupURL(raw)) return true;
    if (!isNewTabTarget(target)) return false;
    if (source === 'open' || source === 'script') return true;

    try {
      const parsed = new URL(raw, location.href);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return true;
      }

      return !isContentHost(parsed.hostname);
    } catch (_) {
      return true;
    }
  }

  function effectiveTarget(element) {
    const own = (element.getAttribute('target') || '').trim().toLowerCase();
    if (own) return own;

    const base = document.querySelector('base[target]');
    return (base?.getAttribute('target') || '').trim().toLowerCase();
  }

  const nativeSetAttribute = Element.prototype.setAttribute;

  function neutralizeBlankBase() {
    if (!guardPopups) return;

    document.querySelectorAll('base[target]').forEach(base => {
      const target = (base.getAttribute('target') || '').trim().toLowerCase();

      if (target === '_blank' || target === '_new') {
        nativeSetAttribute.call(base, 'target', '_self');
      }
    });
  }

  // Cửa sổ giả để trang vẫn chạy phim, không chuyển tab hiện tại sang quảng cáo
  function inertPopup() {
    function make(kind) {
      const store = Object.create(null);
      const fn = function () {
        return proxy;
      };
      const proxy = new Proxy(fn, {
        get(_target, prop) {
          if (prop === 'then') return undefined;
          if (prop === 'closed') return false;
          if (prop === Symbol.toStringTag) {
            if (kind === 'location') return 'Location';
            if (kind === 'window') return 'Window';
            return 'Object';
          }
          if (prop === Symbol.toPrimitive) {
            return () => (kind === 'location' ? 'about:blank' : '');
          }
          if (prop === 'toString') {
            return () => (
              kind === 'location' ? String(store.href || 'about:blank') : ''
            );
          }
          if (kind === 'location' && prop === 'href') {
            return store.href || 'about:blank';
          }
          if (Object.prototype.hasOwnProperty.call(store, prop)) {
            return store[prop];
          }
          if (typeof prop === 'symbol') return undefined;

          const child = prop === 'location'
            ? 'location'
            : prop === 'document'
              ? 'node'
              : 'node';

          store[prop] = make(child);
          return store[prop];
        },
        set(_target, prop, value) {
          if (prop === 'closed') return true;

          if (kind === 'window' && prop === 'location') {
            const loc = store.location || make('location');
            store.location = loc;
            loc.href = value;
            return true;
          }

          if (kind === 'location' && prop === 'href') {
            store.href = value == null ? '' : String(value);
            return true;
          }

          store[prop] = value;
          return true;
        },
        apply() {
          return proxy;
        },
        construct() {
          return proxy;
        }
      });

      return proxy;
    }

    return make('window');
  }

  // Selector ẩn quảng cáo HTML
  const baseSelectors = [
    'ins.adsbygoogle',
    '.adsbygoogle',
    '[id^="google_ads"]',
    '[id^="div-gpt-ad"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    '[data-ad-slot]',
    '[data-ad-client]',
    '[data-ad-unit]',
    '[class~="ad-banner"]',
    '[class*="ad-container"]',
    '[class*="ad-wrapper"]',
    '[class*="adsbox"]:not(#clean-ads-bait)',
    '[id*="ad-slot"]',
    '[id*="advertisement"]',
    '[class*="sponsored-content"]',
    '[aria-label*="Advertisement" i]',
    '[aria-label*="Sponsored" i]'
  ];

  const phimmotchillSelectors = [
    '.sspp-area',
    '.sspp-modal',
    '.ads-catfish-strip',
    '.ads-catfish-spacer',
    '.ads-catfish-scroll',
    '.ads-banner-stack',
    '.ads-player-banner-grid',
    '.ads-popup-backdrop',
    '.ads-popup-dialog',
    '.ads-popup-banner',
    '.ads-control-button',
    'img[alt="Quảng cáo"]',
    'a[rel~="sponsored"]'
  ];

  const motchillTuSelectors = [
    '.cat-footer-wrapper',
    '.cat-header-wrapper',
    '.aam-banner-wrapper',
    '.container-aam',
    '.container-aam-player',
    '.aam-player-banner',
    '#popup-overlay',
    '.ad-popup',
    '.afs_ads',
    'img[src*="/ads/"]',
    'a[rel~="sponsored"]'
  ];

  const rophimSelectors = [
    '.sspp-area',
    '.adserver',
    '.catfish-bottom',
    '.catfish-top',
    '.banner-bottom-double',
    '.banner-detail-bottom',
    'ins[data-revive-id]',
    'a[href*="c-cl.php"]',
    '.swiper-slide:has(ins[data-revive-id])',
    '.swiper-slide:has(a[href*="c-cl.php"])'
  ];

  const playerFrameSelectors = [
    '#tvc-ad-overlay',
    '.tvc-ad-overlay',
    '.tvc-ad-video'
  ];

  // Chỉ trong khung player: bỏ video quảng cáo trước khi player đọc cấu hình
  if (inPlayerFrame) {
    const lockEmpty = name => {
      try {
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            return '';
          },
          set() {}
        });
      } catch (_) {}
    };

    lockEmpty('__tvcUrl__');
    lockEmpty('__tvcLink__');

    try {
      Object.defineProperty(window, '__ADS_PAUSED_UNTIL__', {
        configurable: true,
        get() {
          return Date.now() + 86400000 * 3650;
        },
        set() {}
      });
    } catch (_) {}
  }

  // Selector quảng cáo YouTube
  const youtubeSelectors = [
    '.ytp-ad-overlay-container',
    '.ytp-ad-message-container',
    'ytd-ad-slot-renderer',
    'ytd-display-ad-renderer',
    '#masthead-ad',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-banner-promo-renderer',
    'ytm-promoted-sparkles-web-renderer'
  ];

  // Đọc danh sách selector do người dùng lưu
  function loadCustomSelectors() {
    try {
      const value = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      );

      if (!Array.isArray(value)) return [];

      return value.filter(selector =>
        typeof selector === 'string' &&
        selector.length < 1000 &&
        (
          /^#[A-Za-z_][\w-]*$/.test(selector) ||
          selector === 'body' ||
          /^body(?: > [a-z0-9-]+:nth-child\(\d+\))+$/i.test(selector)
        )
      );
    } catch (_) {
      return [];
    }
  }

  // Lưu selector cần ẩn
  function saveCustomSelector(selector) {
    const selectors = loadCustomSelectors();

    if (selectors.includes(selector)) return;

    selectors.push(selector);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(selectors)
      );
    } catch (_) {}
  }

  // Thêm CSS ẩn quảng cáo
  const style = document.createElement('style');
  style.id = 'clean-ads-style';

  function applyStyles() {
    const selectors = [
      ...baseSelectors,
      ...(isYouTube ? youtubeSelectors : []),
      ...(isPhimmotchill ? phimmotchillSelectors : []),
      ...(isMotchillTu ? motchillTuSelectors : []),
      ...(isRoPhim ? rophimSelectors : []),
      ...(inPlayerFrame ? playerFrameSelectors : []),
      ...loadCustomSelectors()
    ];

    const next =
      `${selectors.join(',\n')}{display:none!important;visibility:hidden!important;}`;

    if (style.textContent !== next) style.textContent = next;

    const parent = document.head || document.documentElement;

    if (parent && style.parentNode !== parent) {
      parent.appendChild(style);
    }
  }

  // Xử lý khi documentElement chưa tồn tại
  if (document.documentElement) {
    applyStyles();
  } else {
    const rootObserver = new MutationObserver(() => {
      if (document.documentElement) {
        applyStyles();
        rootObserver.disconnect();
      }
    });

    rootObserver.observe(document, {
      childList: true,
      subtree: true
    });
  }

  // Xóa tài nguyên từ domain quảng cáo đã nhận diện
  function cleanNode(node) {
    if (!(node instanceof Element)) return;

    const candidates = [node];

    if (node.querySelectorAll) {
      candidates.push(
        ...node.querySelectorAll(
          'script[src],iframe[src],img[src],source[src]'
        )
      );
    }

    for (const element of candidates) {
      if (!element.isConnected) continue;

      const resourceURL =
        element.getAttribute('src') ||
        element.getAttribute('data-src') ||
        '';

      if (resourceURL && isAdURL(resourceURL)) {
        element.remove();
      }
    }
  }

  // Theo dõi phần tử mới được thêm vào trang
  const observerRoot = document.documentElement || document;

  const adObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        cleanNode(node);
      }
    }
  });

  adObserver.observe(observerRoot, {
    childList: true,
    subtree: true
  });

  // Motchilltu nạp mảng quảng cáo rồi mới vẽ banner và popunder
  if (isMotchillTu) {
    try {
      Object.defineProperty(window, 'aam_ads_data', {
        configurable: true,
        get() {
          return [];
        },
        set() {}
      });

      Object.defineProperty(window, 'plpData', {
        configurable: true,
        get() {
          return {
            links: [],
            allowed_path_parts: [],
            allowed_exact: []
          };
        },
        set() {}
      });
    } catch (_) {}
  }

  // Chặn tab mới: about:blank, domain quảng cáo, và popup lúc bấm play
  if (guardPopups && typeof HTMLBaseElement !== 'undefined') {
    Element.prototype.setAttribute = function (name, value) {
      const attr = String(name || '').toLowerCase();
      const next = value == null ? '' : String(value);

      if (
        attr === 'target' &&
        this instanceof HTMLBaseElement &&
        /^_(?:blank|new)$/i.test(next.trim())
      ) {
        return;
      }

      return nativeSetAttribute.call(this, name, value);
    };

    try {
      const baseTarget = Object.getOwnPropertyDescriptor(
        HTMLBaseElement.prototype,
        'target'
      );

      if (baseTarget?.set && baseTarget.get) {
        Object.defineProperty(HTMLBaseElement.prototype, 'target', {
          configurable: true,
          enumerable: baseTarget.enumerable,
          get() {
            return baseTarget.get.call(this);
          },
          set(value) {
            const next = value == null ? '' : String(value);

            if (/^_(?:blank|new)$/i.test(next.trim())) return;

            baseTarget.set.call(this, value);
          }
        });
      }
    } catch (_) {}
  }

  const nativeOpen = window.open;

  function guardedOpen(url, name, specs) {
    try {
      if (shouldBlockPopup(url, name, 'open')) {
        console.debug(
          '[Clean Ads] Blocked popup:',
          String(url ?? '')
        );
        return inertPopup();
      }
    } catch (error) {
      console.debug('[Clean Ads] Popup check failed:', error);
    }

    const owner = this instanceof Window ? this : window;
    return nativeOpen.call(owner, url, name, specs);
  }

  try {
    Object.defineProperty(window, 'open', {
      configurable: true,
      enumerable: true,
      get() {
        return guardedOpen;
      },
      set() {}
    });
  } catch (_) {
    window.open = guardedOpen;
  }

  try {
    Object.defineProperty(Window.prototype, 'open', {
      configurable: true,
      writable: true,
      value: guardedOpen
    });
  } catch (_) {}

  // Popunder thường gọi a.click() trên thẻ ẩn, không phải cú click của người dùng
  if (typeof HTMLAnchorElement !== 'undefined') {
    const originalAnchorClick = HTMLAnchorElement.prototype.click;

    HTMLAnchorElement.prototype.click = function () {
      try {
        neutralizeBlankBase();

        const targetAttr = effectiveTarget(this);
        const newTab = targetAttr === '_blank' || targetAttr === '_new';
        const raw = (this.getAttribute('href') || '').trim();

        if (
          newTab &&
          raw &&
          raw !== '#' &&
          shouldBlockPopup(this.href || raw, '_blank', 'script')
        ) {
          console.debug('[Clean Ads] Blocked scripted tab:', this.href);
          return;
        }

        if (this.href && isAdURL(this.href)) return;
      } catch (_) {}

      return originalAnchorClick.apply(this, arguments);
    };
  }

  if (guardPopups && typeof HTMLFormElement !== 'undefined') {
    const originalSubmit = HTMLFormElement.prototype.submit;

    HTMLFormElement.prototype.submit = function () {
      try {
        const targetAttr = effectiveTarget(this);

        if (
          (targetAttr === '_blank' || targetAttr === '_new') &&
          shouldBlockPopup(this.action, '_blank', 'script')
        ) {
          return;
        }
      } catch (_) {}

      return originalSubmit.apply(this, arguments);
    };
  }

  // Chặn fetch tới domain quảng cáo đã nhận diện
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;

    window.fetch = function (input, init) {
      if (isAdURL(input)) {
        return Promise.reject(
          new DOMException(
            'Blocked by Clean Ads',
            'AbortError'
          )
        );
      }

      return originalFetch.call(this, input, init);
    };
  }

  function anchorFromEvent(event) {
    if (typeof event.composedPath === 'function') {
      for (const node of event.composedPath()) {
        if (
          node instanceof HTMLAnchorElement &&
          node.hasAttribute('href')
        ) {
          return node;
        }
      }
    }

    const element =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement;

    return element?.closest?.('a[href]') || null;
  }

  function opensBlockedTab(anchor, event) {
    neutralizeBlankBase();

    const targetAttr = effectiveTarget(anchor);
    const newTab =
      event.type === 'auxclick' ||
      event.button === 1 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      targetAttr === '_blank' ||
      targetAttr === '_new';

    if (!newTab) return false;

    const raw = (anchor.getAttribute('href') || '').trim();
    if (!raw || raw === '#') return false;

    return shouldBlockPopup(anchor.href || raw, '_blank', 'click');
  }

  // Chặn click vào link quảng cáo, và tab mới lúc bấm play
  function handlePopupClick(event) {
    const anchor = anchorFromEvent(event);
    if (!anchor) return;

    const inAdSlot = Boolean(anchor.closest(
      '.sspp-area,.adserver,.cat-a,.cat-header,.aam-banner,' +
      '.ad-popup,.ads-catfish-item,.ads-popup-banner,[data-ad-slot]'
    ));

    const sponsored = /\bsponsored\b/i.test(anchor.rel || '');

    const reviveClick = /\/c-cl\.php/i.test(anchor.href || '');

    if (
      isAdURL(anchor.href) ||
      reviveClick ||
      (isStreamSite && (inAdSlot || sponsored))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (opensBlockedTab(anchor, event)) {
      event.preventDefault();
      console.debug('[Clean Ads] Blocked new tab:', anchor.href);
    }
  }

  document.addEventListener('click', handlePopupClick, true);
  document.addEventListener('auxclick', handlePopupClick, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const targetAttr = effectiveTarget(form);

    if (
      (targetAttr === '_blank' || targetAttr === '_new') &&
      shouldBlockPopup(form.action, '_blank', 'click')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Tạo selector cho phần tử cần ẩn thủ công
  function selectorFor(element) {
    if (!(element instanceof Element)) return null;

    if (
      element.id &&
      /^[A-Za-z_][\w-]*$/.test(element.id)
    ) {
      return `#${element.id}`;
    }

    if (element === document.body) return 'body';

    const parts = [];
    let current = element;

    while (
      current &&
      current instanceof Element &&
      current !== document.body
    ) {
      const parent = current.parentElement;
      if (!parent) break;

      const index =
        Array.prototype.indexOf.call(
          parent.children,
          current
        ) + 1;

      parts.unshift(
        `${current.tagName.toLowerCase()}:nth-child(${index})`
      );

      current = parent;
    }

    return parts.length
      ? `body > ${parts.join(' > ')}`
      : null;
  }

  // Nhấn giữ 3 giây để ẩn phần tử
  let holdTimer = null;

  document.addEventListener('pointerdown', event => {
    clearTimeout(holdTimer);

    const element =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement;

    if (
      !element ||
      element.closest(
        'input,textarea,select,button,a,video,audio,[contenteditable="true"]'
      )
    ) {
      return;
    }

    holdTimer = setTimeout(() => {
      const selector = selectorFor(element);
      if (!selector) return;

      if (
        window.confirm(
          `Ẩn phần tử này trên website hiện tại?\n\n${selector}`
        )
      ) {
        saveCustomSelector(selector);
        applyStyles();
      }
    }, 3000);
  }, true);

  [
    'pointerup',
    'pointercancel',
    'pointerleave',
    'scroll'
  ].forEach(eventName => {
    document.addEventListener(
      eventName,
      () => clearTimeout(holdTimer),
      true
    );
  });

  // Kiểm tra phần tử có đang hiển thị không
  function isVisible(element) {
    if (
      !element ||
      !element.isConnected ||
      !element.getClientRects().length
    ) {
      return false;
    }

    const css = getComputedStyle(element);

    return css.display !== 'none' &&
      css.visibility !== 'hidden' &&
      Number(css.opacity) !== 0;
  }

  // Lấy nội dung nhãn của nút
  function controlLabel(element) {
    return (
      element.innerText ||
      element.value ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      ''
    ).replace(/\s+/g, ' ').trim();
  }

  // Tìm nút Skip mà không phụ thuộc một loại player cụ thể
  const lastSkipClick = new WeakMap();

  function tryClickSkipButtons() {
    const selector = [
      'button',
      'a',
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]',
      '.jw-skip',
      '.jw-skip-button',
      '.vjs-skip-ad',
      '[class*="skip-ad"]',
      '[class*="skipAd"]',
      '[aria-label*="skip" i]'
    ].join(',');

    document.querySelectorAll(selector).forEach(element => {
      if (!isVisible(element) || element.disabled) return;

      const label = controlLabel(element);

      const classAndAria =
        `${String(element.className || '')} ` +
        `${element.getAttribute('aria-label') || ''}`;

      const exactLabel =
        /^(skip|skip ad|skip ads|skip advertisement|bỏ qua|bỏ qua quảng cáo)$/i
          .test(label);

      const explicitSkipClass = /skip.?ad/i.test(classAndAria);

      if (!exactLabel && !explicitSkipClass) return;

      // Tránh bấm nhầm liên kết điều hướng thông thường
      if (/skip to content/i.test(label)) return;

      const now = Date.now();
      const last = lastSkipClick.get(element) || 0;

      if (now - last < 1500) return;

      lastSkipClick.set(element, now);
      element.click();

      console.debug(
        '[Clean Ads] Tried skip control:',
        label || classAndAria
      );
    });
  }

  // YouTube: thử Skip, tắt tiếng và tua nhanh khi phát hiện quảng cáo
  if (isYouTube) {
    let savedState = null;

    setInterval(() => {
      tryClickSkipButtons();

      const player = document.querySelector(
        '.html5-video-player'
      );

      const video = player?.querySelector('video');

      if (!player || !video) return;

      if (player.classList.contains('ad-showing')) {
        if (!savedState || savedState.video !== video) {
          savedState = {
            video,
            muted: video.muted,
            rate: video.playbackRate
          };
        }

        const skip = player.querySelector(
          '.ytp-skip-ad-button,' +
          '.ytp-ad-skip-button,' +
          '.ytp-ad-skip-button-modern,' +
          '.ytp-ad-skip-button-container button'
        );

        if (skip && !skip.disabled) {
          skip.click();
        }

        video.muted = true;

        try {
          video.playbackRate = 16;
        } catch (_) {}

        try {
          if (
            Number.isFinite(video.duration) &&
            video.duration > 0 &&
            video.currentTime < video.duration - 0.5
          ) {
            video.currentTime = Math.max(
              0,
              video.duration - 0.1
            );
          }
        } catch (_) {}
      } else if (savedState) {
        try {
          savedState.video.muted = savedState.muted;
          savedState.video.playbackRate = savedState.rate;
        } catch (_) {}

        savedState = null;
      }
    }, 400);
  }

  // Tua qua quảng cáo JW Player khi player đang ở trạng thái ads
  function skipJwPlayerAds() {
    document.querySelectorAll('.jwplayer').forEach(player => {
      if (!/jw-flag-ads/.test(String(player.className))) return;

      const skip = player.querySelector(
        '.jw-skip, .jw-skip-container button, .jw-skip-icon'
      );

      if (skip && isVisible(skip)) skip.click();

      const video = player.querySelector('video');

      if (
        video &&
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        video.currentTime < video.duration - 0.3
      ) {
        try {
          video.muted = true;
          video.currentTime = Math.max(0, video.duration - 0.05);
        } catch (_) {}
      }
    });
  }

  // Bỏ lớp quảng cáo trong player và cho phim chạy tiếp
  function skipEmbeddedPlayerAds() {
    if (!inPlayerFrame) return;

    const adOverlay = document.querySelector(
      '#tvc-ad-overlay, .tvc-ad-overlay, .jwplayer.jw-flag-ads'
    );

    if (!adOverlay) return;

    if (typeof window.__ROPHIM_CANCEL_TVC__ === 'function') {
      try {
        window.__ROPHIM_CANCEL_TVC__();
      } catch (_) {}
    }

    const tvcVideo = document.getElementById('tvc-video');

    if (tvcVideo) {
      try {
        tvcVideo.muted = true;

        if (Number.isFinite(tvcVideo.duration) && tvcVideo.duration > 0) {
          tvcVideo.currentTime = tvcVideo.duration;
        }
      } catch (_) {}
    }

    adOverlay.querySelectorAll(
      '#tvc-skip-btn, .tvc-ad-skip, .jw-skip'
    ).forEach(button => {
      try {
        button.click();
      } catch (_) {}
    });
  }

  // Bỏ khóa cuộn do popup quảng cáo. Không xóa node vì React sẽ vỡ trang.
  function cleanStreamPage() {
    if (!isStreamSite || !document.body) return;

    const adModal = document.querySelector(
      '.sspp-modal, .ads-popup-backdrop, #popup-overlay'
    );

    if (!adModal) return;

    const openModal = document.querySelector(
      '.modal.show:not(.sspp-modal)'
    );

    if (!openModal) {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }
  }

  if (isStreamSite || inPlayerFrame) {
    let scanQueued = false;

    function scanStreamSite() {
      try {
        neutralizeBlankBase();
        applyStyles();
        cleanStreamPage();
        skipEmbeddedPlayerAds();
        tryClickSkipButtons();
        skipJwPlayerAds();
      } catch (error) {
        console.debug('[Clean Ads] Stream scan failed:', error);
      }
    }

    function scheduleScan() {
      if (scanQueued) return;
      scanQueued = true;

      const run = () => {
        scanQueued = false;
        scanStreamSite();
      };

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(run);
      } else {
        setTimeout(run, 50);
      }
    }

    scheduleScan();

    const scanRoot = document.documentElement || document;

    const streamObserver = new MutationObserver(scheduleScan);

    streamObserver.observe(scanRoot, {
      childList: true,
      subtree: true
    });

    setInterval(scanStreamSite, 1000);
  }
})();
