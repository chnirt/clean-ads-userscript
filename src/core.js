
// ==UserScript==
// @name         Clean Ads - YouTube + Phimmotchill
// @description  Hide overlay and banner ads on every site with AdGuard filters, skip player ads, and block ad popups plus scripted new tabs
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @connect      filters.adtidy.org
// ==/UserScript==

// Ghép bằng `node build.js` từ src/core.js và steps/. Sửa file nguồn rồi build lại.

(() => {
  'use strict';

  const page = (() => {
    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {}

    return window;
  })();

  const PageElement = page.Element || Element;
  const PageHTMLBaseElement = page.HTMLBaseElement || HTMLBaseElement;
  const PageWindow = page.Window || Window;
  const PageHTMLAnchorElement = page.HTMLAnchorElement || HTMLAnchorElement;
  const PageHTMLFormElement = page.HTMLFormElement || HTMLFormElement;
  const nativePageFetch = typeof page.fetch === 'function'
    ? page.fetch.bind(page)
    : null;

  const gmGet = typeof GM_getValue === 'function' ? GM_getValue : null;
  const gmSet = typeof GM_setValue === 'function' ? GM_setValue : null;
  const gmDel = typeof GM_deleteValue === 'function' ? GM_deleteValue : null;
  const gmXhr = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;

  const STORAGE_KEY = 'cleanAdsSelectors';
  const hostname = location.hostname.toLowerCase();
  const filmBrands = [];
  const siteRules = [];

  function hostIsFilmBrand(host) {
    const labels = String(host || '')
      .toLowerCase()
      .replace(/\.$/, '')
      .split('.')
      .filter(Boolean);

    return labels.some(label =>
      filmBrands.some(brand => label.includes(brand))
    );
  }

  // @include steps/01-adguard.js
  // @include steps/02-motchill.js
  // @include steps/03-rophim.js
  // @include steps/04-phimmoi.js

  const isYouTube =
    /(^|\.)youtube\.com$/.test(hostname) ||
    /(^|\.)youtube-nocookie\.com$/.test(hostname);

  const isStreamSite = hostIsFilmBrand(hostname);

  const isEmbeddedFrame = (() => {
    try {
      return page.top !== page.self;
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

  const fromStreamSite = hostIsFilmBrand(referrerHost);

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

        if (hostIsFilmBrand(host)) return true;
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
    'itvmovies.me',
    'tikpeeaff.com'
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
      const h = parsed.hostname.toLowerCase().replace(/\.$/, '');

      if (adguardBlocks(h, parsed)) return true;
      if (isGoogleAdClick(parsed)) return true;

      const knownAdHost = adDomains.some(domain =>
        h === domain || h.endsWith(`.${domain}`)
      ) || /^adservice\.google\./.test(h);

      if (knownAdHost || /\/c-(?:cl|asyncjs)\.php$/i.test(parsed.pathname)) {
        return true;
      }

      // tracking-ubt phủ lớp trong suốt lên player rồi mở popup.
      return isStreamSite && /\/tracking-ubt[-.]/i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function isContentHost(host) {
    const h = String(host || '').toLowerCase().replace(/\.$/, '');

    if (!h) return false;
    if (h === hostname) return true;

    if (hostIsFilmBrand(h)) return true;

    return [
      'yeuphim.biz',
      'devwithai.net',
      'youtube.com',
      'youtube-nocookie.com'
    ].some(domain => h === domain || h.endsWith(`.${domain}`));
  }

  // Popup người dùng chủ đích (đăng nhập, chia sẻ, thanh toán), không phải quảng cáo.
  const benignHosts = [
    'appleid.apple.com',
    'apps.apple.com',
    'itunes.apple.com',
    'play.google.com',
    'facebook.com',
    'fb.com',
    'twitter.com',
    'x.com',
    'paypal.com',
    'stripe.com',
    'microsoftonline.com',
    'live.com',
    'github.com',
    'linkedin.com',
    'reddit.com',
    't.me',
    'telegram.me',
    'telegram.org',
    'wa.me',
    'whatsapp.com',
    'pinterest.com',
    'discord.com',
    'zoom.us',
    'dropbox.com',
    'vimeo.com',
    'spotify.com',
    'soundcloud.com',
    'twitch.tv',
    'dailymotion.com',
    'instagram.com',
    'youtu.be',
    'recaptcha.net',
    'gstatic.com',
    'googleusercontent.com',
    'googleapis.com',
    'googletagmanager.com',
    'google-analytics.com',
    'tawk.to',
    'crisp.chat',
    'intercom.io',
    'intercomcdn.com',
    'zdassets.com',
    'zopim.com',
    'livechatinc.com',
    'hotjar.com'
  ];

  function isGoogleAdClick(parsed) {
    const h = String(parsed.hostname || '').toLowerCase();

    if (!/(^|\.)google\./.test(h)) return false;

    return /^\/(aclk|pagead)(\/|$)/i.test(parsed.pathname || '');
  }

  function isBenignHost(host) {
    const h = String(host || '').toLowerCase().replace(/\.$/, '');

    if (!h) return false;
    if (
      h.endsWith('.google.com') &&
      /^(?:adservice|ads|ad|pagead\d*)\./.test(h)
    ) {
      return false;
    }
    if (h === 'google.com' || h.endsWith('.google.com')) return true;

    return benignHosts.some(domain => h === domain || h.endsWith(`.${domain}`));
  }

  function isAllowedPopupHost(host, parsed) {
    if (parsed && isGoogleAdClick(parsed)) return false;

    const h = String(host || '').toLowerCase().replace(/\.$/, '');

    if (!h) return false;
    if (!isThirdPartyHost(h) || isContentHost(h)) return true;

    return isBenignHost(h);
  }

  function isNewTabTarget(target) {
    const name = String(target ?? '').trim();
    const lower = name.toLowerCase();

    if (!name || lower === '_blank' || lower === '_new') return true;
    if (lower === '_self' || lower === '_parent' || lower === '_top') {
      return false;
    }

    try {
      if (page.frames && page.frames[name]) return false;
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

  // Trang phim: chặn mọi tab mới khác site nội dung.
  // Trang khác: chặn tab do script tự mở sang site lạ. Link người dùng bấm vẫn mở.
  function shouldBlockPopup(url, target, source) {
    const raw = url == null ? '' : String(url).trim();
    const scripted = source === 'open' || source === 'script';

    if (raw && isAdURL(raw)) return true;
    if (!scripted && !guardPopups) return false;
    if (isBlankPopupURL(raw)) return true;
    if (!isNewTabTarget(target)) return false;
    if (guardPopups && scripted) return true;

    try {
      const parsed = new URL(raw, location.href);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return true;
      }

      if (guardPopups) return !isContentHost(parsed.hostname);
      if (!scripted) return false;

      return !isAllowedPopupHost(parsed.hostname, parsed);
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

  const nativeSetAttribute = PageElement.prototype.setAttribute;

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
    '[aria-label*="Sponsored" i]',
    '[aria-label*="Quảng cáo" i]',
    '[id^="google_ads_iframe"]',
    '[id^="aswift_"]',
    '[data-ad-banner]',
    '[data-ad-type]',
    '[data-revive-id]',
    '[class*="ad-banner" i]',
    '[class*="ads-banner" i]',
    '[class*="ad_banner" i]',
    '[class*="ads_banner" i]',
    '[class*="banner-ad" i]',
    '[class*="banner_ad" i]',
    '[class*="ad-popup" i]',
    '[class*="ads-popup" i]',
    '[class*="popup-ad" i]',
    '[class*="ad-overlay" i]',
    '[class*="ads-overlay" i]',
    '[class*="ad-modal" i]',
    '[class*="ads-modal" i]',
    '[class*="popunder" i]',
    '[id*="popunder" i]',
    '[class*="catfish-" i]',
    '[class*="catfish_" i]',
    '[class~="catfish" i]',
    '[id*="catfish-" i]',
    '[id*="catfish_" i]',
    '[id="catfish" i]',
    '[class*="quangcao" i]',
    '[class*="quang-cao" i]',
    '[id*="quangcao" i]',
    '[id*="quang-cao" i]',
    '[class*="banner-qc" i]',
    '[id*="banner-qc" i]',
    '[class*="qc-banner" i]',
    '[id*="qc-banner" i]',
    '[class*="sticky-ad" i]',
    '[class*="ad-sticky" i]',
    'img[alt="Quảng cáo" i]',
    'img[alt*="advertisement" i]',
    'a[rel~="sponsored"]'
  ];

  const motchillXSelectors = [
    '.afs_ads',
    '[style*="z-index:2147483000"]',
    '[style*="z-index: 2147483000"]'
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
        Object.defineProperty(page, name, {
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
      Object.defineProperty(page, '__ADS_PAUSED_UNTIL__', {
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
      ...siteRules.flatMap(rule => (rule.selectors ? rule.selectors(hostname) : [])),
      ...(isStreamSite ? motchillXSelectors : []),
      ...(inPlayerFrame ? playerFrameSelectors : []),
      ...loadCustomSelectors()
    ];

    const next =
      `${selectors.join(',\n')}{display:none!important;visibility:hidden!important;}\n` +
      '[data-clean-ads-hide]{display:none!important;visibility:hidden!important;pointer-events:none!important;}\n' +
      `${adguardCssText}`;

    if (style.textContent !== next) style.textContent = next;

    const parent = document.head || document.documentElement;

    if (parent && style.parentNode !== parent) {
      parent.appendChild(style);
    }
  }

  loadAdguardCache();

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

  // Chặn tab mới: about:blank, domain quảng cáo, và popup lúc bấm play
  try {
    PageElement.prototype.setAttribute = function (name, value) {
      const attr = String(name || '').toLowerCase();
      const next = value == null ? '' : String(value);
      const tag = this && this.tagName;

      if (
        (attr === 'src' || (attr === 'href' && tag === 'LINK')) &&
        (
          tag === 'SCRIPT' ||
          tag === 'IFRAME' ||
          tag === 'IMG' ||
          tag === 'SOURCE' ||
          tag === 'LINK'
        ) &&
        isAdURL(next)
      ) {
        return;
      }

      if (
        guardPopups &&
        attr === 'target' &&
        tag === 'BASE' &&
        /^_(?:blank|new)$/i.test(next.trim())
      ) {
        return;
      }

      return nativeSetAttribute.call(this, name, value);
    };
  } catch (_) {}

  if (guardPopups && PageHTMLBaseElement) {
    try {
      const baseTarget = Object.getOwnPropertyDescriptor(
        PageHTMLBaseElement.prototype,
        'target'
      );

      if (baseTarget?.set && baseTarget.get) {
        Object.defineProperty(PageHTMLBaseElement.prototype, 'target', {
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

  // Trang phim: tracking-ubt gắn lớp trong suốt z-index 2147483000 lên player.
  if (isStreamSite && page.Node && page.Node.prototype) {
    const isClickjackNode = node => {
      if (!(node instanceof Element)) return false;

      return /2147483000/.test(node.getAttribute('style') || '');
    };

    const guardInsert = native => function (node) {
      try {
        if (isClickjackNode(node)) return node;
      } catch (_) {}

      return native.apply(this, arguments);
    };

    try {
      const nativeAppend = page.Node.prototype.appendChild;
      page.Node.prototype.appendChild = guardInsert(nativeAppend);
    } catch (_) {}

    try {
      const nativeInsert = page.Node.prototype.insertBefore;
      page.Node.prototype.insertBefore = guardInsert(nativeInsert);
    } catch (_) {}
  }

  const nativeOpen = page.open;

  function looksLikeUserPopup(specs) {
    const text = String(specs || '');
    const width = /(?:^|[,\s])width\s*=\s*(\d+)/i.exec(text);
    const height = /(?:^|[,\s])height\s*=\s*(\d+)/i.exec(text);

    if (!width || !height) return false;

    return Number(width[1]) >= 320 && Number(height[1]) >= 320;
  }

  function guardedOpen(url, name, specs) {
    try {
      if (shouldBlockPopup(url, name, 'open')) {
        const raw = url == null ? '' : String(url).trim();
        const allowBlankShell =
          !guardPopups &&
          isBlankPopupURL(raw) &&
          looksLikeUserPopup(specs);

        if (!allowBlankShell) {
          console.debug(
            '[Clean Ads] Blocked popup:',
            String(url ?? '')
          );
          return inertPopup();
        }
      }
    } catch (error) {
      console.debug('[Clean Ads] Popup check failed:', error);
    }

    const owner = this instanceof PageWindow ? this : page;
    return nativeOpen.call(owner, url, name, specs);
  }

  try {
    Object.defineProperty(page, 'open', {
      configurable: true,
      enumerable: true,
      get() {
        return guardedOpen;
      },
      set() {}
    });
  } catch (_) {
    page.open = guardedOpen;
  }

  try {
    Object.defineProperty(PageWindow.prototype, 'open', {
      configurable: true,
      writable: true,
      value: guardedOpen
    });
  } catch (_) {}

  // Popunder thường gọi a.click() trên thẻ ẩn, không phải cú click của người dùng
  if (PageHTMLAnchorElement) {
    const originalAnchorClick = PageHTMLAnchorElement.prototype.click;

    PageHTMLAnchorElement.prototype.click = function () {
      try {
        neutralizeBlankBase();

        const targetAttr = effectiveTarget(this);
        const newTab = targetAttr === '_blank' || targetAttr === '_new';
        const raw = (this.getAttribute('href') || '').trim();

        if (
          newTab &&
          raw &&
          raw !== '#' &&
          shouldBlockPopup(this.href || raw, '_blank', 'script') &&
          (
            guardPopups ||
            isUnseenBox(this) ||
            coversViewport(this) ||
            Boolean(adLayer(this))
          )
        ) {
          console.debug('[Clean Ads] Blocked scripted tab:', this.href);
          return;
        }

        if (this.href && isAdURL(this.href)) return;
      } catch (_) {}

      return originalAnchorClick.apply(this, arguments);
    };
  }

  if (PageHTMLFormElement) {
    const originalSubmit = PageHTMLFormElement.prototype.submit;

    PageHTMLFormElement.prototype.submit = function () {
      try {
        const targetAttr = effectiveTarget(this);

        if (
          (targetAttr === '_blank' || targetAttr === '_new') &&
          shouldBlockPopup(this.action, '_blank', 'script') &&
          (guardPopups || isUnseenBox(this) || Boolean(adLayer(this)))
        ) {
          return;
        }
      } catch (_) {}

      return originalSubmit.apply(this, arguments);
    };
  }

  // Chặn fetch tới domain quảng cáo đã nhận diện
  try {
    if (typeof page.fetch === 'function') {
      const originalFetch = page.fetch;

      page.fetch = function (input, init) {
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
  } catch (_) {}

  function blockSrcProperty(Ctor) {
    if (!Ctor || !Ctor.prototype) return;

    try {
      const desc = Object.getOwnPropertyDescriptor(Ctor.prototype, 'src');
      if (!desc || !desc.set || !desc.get) return;

      Object.defineProperty(Ctor.prototype, 'src', {
        configurable: true,
        enumerable: desc.enumerable,
        get() {
          return desc.get.call(this);
        },
        set(value) {
          try {
            if (isAdURL(value)) return;
          } catch (_) {}

          desc.set.call(this, value);
        }
      });
    } catch (_) {}
  }

  blockSrcProperty(page.HTMLScriptElement);
  blockSrcProperty(page.HTMLIFrameElement);
  blockSrcProperty(page.HTMLImageElement);
  blockSrcProperty(page.HTMLSourceElement);

  if (page.XMLHttpRequest && page.XMLHttpRequest.prototype) {
    try {
      const originalOpen = page.XMLHttpRequest.prototype.open;
      const originalSend = page.XMLHttpRequest.prototype.send;

      page.XMLHttpRequest.prototype.open = function (method, url) {
        try {
          if (isAdURL(url)) {
            this.__cleanAdsBlocked = true;
            return originalOpen.call(this, method, 'data:text/plain,');
          }
        } catch (_) {}

        this.__cleanAdsBlocked = false;
        return originalOpen.apply(this, arguments);
      };

      page.XMLHttpRequest.prototype.send = function () {
        if (this.__cleanAdsBlocked) return;
        return originalSend.apply(this, arguments);
      };
    } catch (_) {}
  }

  try {
    const beacon = page.navigator && page.navigator.sendBeacon;

    if (typeof beacon === 'function') {
      page.navigator.sendBeacon = function (url, data) {
        try {
          if (isAdURL(url)) return true;
        } catch (_) {}

        return beacon.call(page.navigator, url, data);
      };
    }
  } catch (_) {}

  // Lớp quảng cáo đè lên trang: modal, dải dính, banner nổi. Không gỡ node
  // vì trang React sẽ vẽ lại và có thể vỡ.
  const PLAYER_ROOT =
    '.html5-video-player, #movie_player, .jwplayer, .video-js, .plyr--video';

  const AD_TOKEN =
    /(?:^|[^a-z0-9])(?:ads?|adverts?|advertisements?|popunders?|catfish|sponsored|quangcao|quang[-_]?cao|adsbygoogle|adslot|ad[-_ ]slot|banner[-_ ]ads?|ads?[-_ ]banners?|qc[-_ ]banner|banner[-_ ]qc)(?:[^a-z0-9]|$)/i;

  const OVERLAY_CANDIDATE = [
    'iframe',
    'frame',
    'ins',
    'a[target="_blank"]',
    'a[rel~="sponsored"]',
    '[data-ad-slot]',
    '[data-ad-client]',
    '[data-ad-unit]',
    '[data-revive-id]',
    '[style*="fixed" i]',
    '[class*="banner" i]',
    '[class*="popup" i]',
    '[class*="overlay" i]',
    '[class*="catfish" i]',
    '[class*="quang" i]',
    '[role="dialog"]',
    '[aria-modal="true"]'
  ].join(',');

  function elementClassName(el) {
    return typeof el.className === 'string' ? el.className : '';
  }

  function isUnseenBox(element) {
    if (!element || !element.getBoundingClientRect) return true;
    if (!isVisible(element)) return true;

    const rect = element.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    if (rect.width < 2 || rect.height < 2) return true;
    if (rect.bottom <= 0 || rect.right <= 0) return true;
    if (rect.top >= vh || rect.left >= vw) return true;

    return false;
  }

  function coversViewport(element) {
    if (!element || !element.getBoundingClientRect) return false;

    const rect = element.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    return rect.width >= vw * 0.85 && rect.height >= vh * 0.5;
  }

  function hasOwnAdToken(el) {
    if (
      el.hasAttribute('data-ad-slot') ||
      el.hasAttribute('data-ad-client') ||
      el.hasAttribute('data-ad-unit') ||
      el.hasAttribute('data-revive-id') ||
      el.hasAttribute('data-ad')
    ) {
      return true;
    }

    const blob = [
      el.id,
      elementClassName(el),
      el.getAttribute('aria-label') || ''
    ].join(' ');

    return AD_TOKEN.test(blob);
  }

  function creativeIsMain(layer, node, kind) {
    let outer;
    let inner;

    try {
      outer = layer.getBoundingClientRect();
      inner = node.getBoundingClientRect();
    } catch (_) {
      return false;
    }

    if (outer.width < 8 || outer.height < 8) return false;
    if (layer === node) return true;

    // Lớp phủ kín màn hình: banner 300x250 ở giữa vẫn là quảng cáo.
    if (kind === 'cover') return inner.width >= 120 && inner.height >= 36;
    if (outer.height <= 320) return inner.width >= Math.min(120, outer.width * 0.5);

    return inner.width * inner.height > outer.width * outer.height * 0.35;
  }

  function shown(el) {
    if (!el || !el.isConnected) return false;

    const css = getComputedStyle(el);

    return css.display !== 'none' && css.visibility !== 'hidden';
  }

  function adFrame(el) {
    const frames = [];

    if (el.matches && el.matches('iframe, frame')) frames.push(el);

    if (el.querySelectorAll) {
      const found = el.querySelectorAll('iframe, frame');
      const count = Math.min(found.length, 8);

      for (let i = 0; i < count; i += 1) frames.push(found[i]);
    }

    for (const frame of frames) {
      if (!shown(frame)) continue;

      const rect = frame.getBoundingClientRect();
      const attrW = parseInt(frame.getAttribute('width'), 10) || 0;
      const attrH = parseInt(frame.getAttribute('height'), 10) || 0;
      const sized =
        (rect.width >= 120 && rect.height >= 36) ||
        (attrW >= 120 && attrH >= 36);

      if (!sized) continue;

      const src = frame.getAttribute('src') || '';

      if ((!src || isBlankPopupURL(src)) && rect.height <= 280) return frame;

      try {
        const parsed = new URL(src, location.href);

        if (isAdURL(src)) return frame;
        if (isBenignHost(parsed.hostname) || isContentHost(parsed.hostname)) {
          continue;
        }
        if (isThirdPartyHost(parsed.hostname)) return frame;
      } catch (_) {
        if (src) return frame;
      }
    }

    return null;
  }

  function collectLinks(el) {
    const links = [];

    if (el.matches && el.matches('a[href]')) links.push(el);

    if (el.querySelectorAll) {
      const found = el.querySelectorAll('a[href]');
      const count = Math.min(found.length, 12);

      for (let i = 0; i < count; i += 1) links.push(found[i]);
    }

    return links;
  }

  function hardAdLink(el) {
    for (const link of collectLinks(el)) {
      const href = link.href || link.getAttribute('href') || '';

      if (isAdURL(href) || /\bsponsored\b/i.test(link.rel || '')) return link;
    }

    return null;
  }

  function softCreative(el) {
    for (const link of collectLinks(el)) {
      let parsed;

      try {
        parsed = new URL(link.href || link.getAttribute('href'), location.href);
      } catch (_) {
        continue;
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (!isThirdPartyHost(parsed.hostname)) continue;
      if (isBenignHost(parsed.hostname) || isContentHost(parsed.hostname)) {
        continue;
      }

      const media = link.querySelector('img, video, picture, canvas');

      if (media) {
        const mediaRect = media.getBoundingClientRect();
        const mediaW = parseInt(media.getAttribute('width'), 10) || 0;
        const mediaH = parseInt(media.getAttribute('height'), 10) || 0;

        if (
          (mediaRect.width >= 120 && mediaRect.height >= 36) ||
          (mediaW >= 120 && mediaH >= 36)
        ) {
          return link;
        }
      }

      const rect = link.getBoundingClientRect();
      if (rect.width < 160 || rect.height < 36) continue;
      if (rect.width >= 240 && rect.height >= 48) return link;
    }

    const images = [];

    if (el.matches && el.matches('img[alt]')) images.push(el);

    if (el.querySelectorAll) {
      const found = el.querySelectorAll('img[alt]');
      const count = Math.min(found.length, 8);

      for (let i = 0; i < count; i += 1) images.push(found[i]);
    }

    for (const img of images) {
      const alt = img.getAttribute('alt') || '';

      if (/quảng cáo|advertisement|sponsored/i.test(alt)) return img;
    }

    return null;
  }

  function hasAdLabel(el) {
    const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;

    if (/quảng cáo|advertisement|sponsored/i.test(aria)) return true;

    let text = '';

    try {
      text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    } catch (_) {
      return false;
    }

    if (!text || text.length > 80) return false;

    return /quảng cáo|advertisement|sponsored/i.test(text);
  }

  function shortText(el) {
    try {
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      return text.length > 240 ? '' : text;
    } catch (_) {
      return '';
    }
  }

  function isConsent(el) {
    const text = shortText(el);

    if (!text) return false;
    if (!/cookie|gdpr|\bconsent\b|privacy policy|quyền riêng tư|chấp nhận cookie|we use cookies/i.test(text)) {
      return false;
    }

    return !hasOwnAdToken(el) && !hardAdLink(el) && !adFrame(el);
  }

  function isInteractiveDialog(el) {
    if (!el.querySelector(
      'input[type="password"], input[type="email"], input[type="search"], textarea'
    )) {
      return false;
    }

    return !hasOwnAdToken(el) && !hardAdLink(el) && !adFrame(el);
  }

  function isSiteChrome(el) {
    if (el.tagName === 'HEADER' || el.tagName === 'NAV') return true;
    if (el.getAttribute('role') === 'banner') return true;

    return Boolean(el.querySelector(
      '#search, input[name="search_query"], input[type="search"]'
    ));
  }

  function isPageShell(el) {
    const id = (el.id || '').toLowerCase();

    if (
      id === 'app' ||
      id === 'root' ||
      id === '__next' ||
      id === '___gatsby'
    ) {
      return true;
    }

    if (!el.querySelector('main, article')) return false;

    try {
      return (el.innerText || '').length > 700;
    } catch (_) {
      return false;
    }
  }

  function mostlyCreative(el) {
    try {
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length > 180) return false;
    } catch (_) {
      return false;
    }

    return Boolean(el.querySelector('img, video, picture, canvas, iframe'));
  }

  function layerKind(el) {
    if (!(el instanceof HTMLElement)) return '';
    if (el === document.body || el === document.documentElement) return '';

    const css = getComputedStyle(el);

    if (css.display === 'none' || css.visibility === 'hidden') return '';
    if (css.position !== 'fixed' && css.position !== 'sticky') return '';

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    if (rect.width < 48 || rect.height < 24) return '';
    if (rect.width >= vw * 0.85 && rect.height >= vh * 0.65) return 'cover';

    const fullWidth = rect.width >= vw * 0.65;

    if (
      fullWidth &&
      rect.height >= 36 &&
      rect.height <= 280 &&
      rect.bottom >= vh - 16 &&
      rect.top >= vh - 320
    ) {
      return 'bottom';
    }

    if (
      css.position === 'fixed' &&
      fullWidth &&
      rect.height >= 36 &&
      rect.height <= 200 &&
      rect.top <= 8 &&
      rect.bottom <= 220
    ) {
      return 'top';
    }

    if (
      css.position === 'fixed' &&
      rect.width >= 200 &&
      rect.height >= 80 &&
      rect.width <= vw * 0.96 &&
      rect.height <= vh * 0.92 &&
      rect.bottom > 40 &&
      rect.right > 40 &&
      rect.top < vh - 20 &&
      rect.left < vw - 20
    ) {
      return 'card';
    }

    return '';
  }

  function containsAdMarker(el) {
    try {
      return Boolean(el.querySelector([
        'img[alt*="quảng cáo" i]',
        'img[alt*="advertisement" i]',
        'img[alt*="sponsored" i]',
        '[data-ad-slot]',
        '[data-ad-client]',
        '[data-ad-unit]',
        '[data-revive-id]',
        'ins.adsbygoogle',
        '.adsbygoogle',
        'a[rel~="sponsored"]'
      ].join(',')));
    } catch (_) {
      return false;
    }
  }

  function textLength(el) {
    try {
      return (el.innerText || '').replace(/\s+/g, ' ').trim().length;
    } catch (_) {
      return 0;
    }
  }

  function hasAdEvidence(el, kind) {
    if (hasOwnAdToken(el) || hasAdLabel(el)) return true;

    if (kind !== 'top' && containsAdMarker(el) && textLength(el) < 180) {
      return true;
    }

    const frame = adFrame(el);
    if (frame && creativeIsMain(el, frame, kind)) return true;

    const hard = hardAdLink(el);
    if (hard && creativeIsMain(el, hard, kind)) return true;
    if (kind === 'top') return false;

    const soft = softCreative(el);
    if (!soft || !creativeIsMain(el, soft, kind)) return false;
    if (kind === 'card') return mostlyCreative(el);

    return true;
  }

  function adLayer(start) {
    if (!(start instanceof Element)) return null;
    if (start.closest(PLAYER_ROOT)) return null;

    let current = start;
    let cover = null;

    for (let depth = 0; current && depth < 10; depth += 1) {
      if (current === document.body || current === document.documentElement) {
        break;
      }

      if (isConsent(current) || isInteractiveDialog(current) || isSiteChrome(current)) {
        current = current.parentElement;
        continue;
      }

      const kind = layerKind(current);

      if (kind && !isPageShell(current) && hasAdEvidence(current, kind)) {
        if (kind === 'cover') cover = current;
        else return current;
      }

      current = current.parentElement;
    }

    return cover;
  }

  function releaseOverlayScroll() {
    if (!document.body) return;

    const dialogs = document.querySelectorAll(
      'dialog[open], .modal.show, [role="dialog"], [aria-modal="true"]'
    );

    for (const dialog of dialogs) {
      if (dialog.hasAttribute('data-clean-ads-hide')) continue;
      if (isVisible(dialog)) return;
    }

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.removeProperty('overflow');
  }

  function markHidden(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el === document.body || el === document.documentElement) return;
    if (el.hasAttribute('data-clean-ads-hide')) return;

    const kind = layerKind(el);

    el.setAttribute('data-clean-ads-hide', '');
    console.debug(
      '[Clean Ads] Hid overlay ad:',
      el.id || elementClassName(el) || el.tagName
    );

    if (kind === 'cover') releaseOverlayScroll();
  }

  function hideCoveringAds() {
    if (!document.body) return;

    let nodes;

    try {
      nodes = document.body.querySelectorAll(OVERLAY_CANDIDATE);
    } catch (_) {
      return;
    }

    const limit = Math.min(nodes.length, 300);

    for (let i = 0; i < limit; i += 1) {
      const node = nodes[i];

      if (node.closest('[data-clean-ads-hide]')) continue;
      if (node.closest(PLAYER_ROOT)) continue;

      const layer = adLayer(node);
      if (layer) markHidden(layer);
    }
  }

  let overlayQueued = false;
  let overlayLast = 0;

  function scheduleOverlayScan() {
    if (document.hidden || overlayQueued) return;

    overlayQueued = true;

    const wait = Math.max(0, 700 - (Date.now() - overlayLast));

    setTimeout(() => {
      overlayQueued = false;
      overlayLast = Date.now();

      try {
        hideCoveringAds();
      } catch (error) {
        console.debug('[Clean Ads] Overlay scan failed:', error);
      }
    }, wait);
  }

  function watchOverlayAds() {
    scheduleOverlayScan();

    const root = document.documentElement || document;

    const overlayObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          try {
            if (
              node.matches(OVERLAY_CANDIDATE) ||
              node.querySelector(OVERLAY_CANDIDATE)
            ) {
              scheduleOverlayScan();
              return;
            }
          } catch (_) {}
        }
      }
    });

    overlayObserver.observe(root, {
      childList: true,
      subtree: true
    });

    setInterval(scheduleOverlayScan, 2000);
  }

  watchOverlayAds();

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

  // Tab mới từ banner phủ trang, hoặc từ nút play nằm trong link sang site khác.
  function clickOpensForeignTab(anchor, event) {
    const raw = (anchor.getAttribute('href') || '').trim();
    if (!raw || raw === '#') return false;

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

    let thirdParty = false;

    try {
      const parsed = new URL(anchor.href || raw, location.href);

      thirdParty =
        isThirdPartyHost(parsed.hostname) &&
        !isAllowedPopupHost(parsed.hostname, parsed);
    } catch (_) {
      thirdParty = true;
    }

    if (!thirdParty && !isAdURL(anchor.href || raw)) return false;
    if (isUnseenBox(anchor) || coversViewport(anchor)) return true;

    const target = event.target instanceof Element ? event.target : null;

    return Boolean(
      thirdParty &&
      target &&
      target !== anchor &&
      target.closest('button, video, [role="button"], input')
    );
  }

  // Chặn click vào link quảng cáo, lớp đè lên trang, và tab mới lúc bấm play
  function handlePopupClick(event) {
    const origin =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement;
    const layer = origin ? adLayer(origin) : null;

    if (layer) {
      markHidden(layer);
      event.preventDefault();

      const playControl = origin.closest(
        'button, video, [role="button"], input[type="button"], input[type="submit"]'
      );

      if (!playControl) event.stopImmediatePropagation();
      return;
    }

    const anchor = anchorFromEvent(event);
    if (!anchor) return;

    const inAdSlot = Boolean(anchor.closest(
      '.sspp-area,.adserver,.cat-a,.cat-header,.aam-banner,' +
      '.ad-popup,.ads-catfish-item,.ads-popup-banner,[data-ad-slot],' +
      '.catfish-banner,.site-header-promo,.revive-frame,' +
      'section[data-placement]'
    ));

    const sponsored = /\bsponsored\b/i.test(anchor.rel || '');

    const reviveClick = /\/c-cl\.php/i.test(anchor.href || '');

    if (
      isAdURL(anchor.href) ||
      reviveClick ||
      sponsored ||
      (isStreamSite && inAdSlot)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (opensBlockedTab(anchor, event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.debug('[Clean Ads] Blocked new tab:', anchor.href);
      return;
    }

    if (clickOpensForeignTab(anchor, event)) {
      event.preventDefault();
      console.debug('[Clean Ads] Blocked overlay tab:', anchor.href);
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
        page.confirm(
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

    if (typeof page.__ROPHIM_CANCEL_TVC__ === 'function') {
      try {
        page.__ROPHIM_CANCEL_TVC__();
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
