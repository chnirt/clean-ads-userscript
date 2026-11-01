// Mọi host có nhãn motchill, kể cả subdomain và đuôi mới.
filmBrands.push('motchill');

function motchillHost(host) {
  return String(host || '')
    .toLowerCase()
    .split('.')
    .filter(Boolean)
    .some(label => label.includes('motchill'));
}

// motchillx bật JW với client vast. AdGuard chặn vast.js nên player đứng ở 00:00.
if (motchillHost(hostname)) {
  const previousIsAdURL = isAdURL;

  isAdURL = function (input) {
    try {
      let raw = input;

      if (input && typeof input === 'object') {
        raw = input.url || input.href || String(input);
      }

      if (typeof raw === 'string' && raw) {
        const parsed = new URL(raw, location.href);
        const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
        const path = parsed.pathname || '';

        if (/(^|\.)jwpcdn\.com$/.test(host) && /\/player\//.test(path)) {
          return false;
        }

        if (/\.(?:m3u8|ts)$/i.test(path)) return false;
      }
    } catch (_) {}

    return previousIsAdURL(input);
  };

  const patchPlayer = player => {
    if (!player || player.__cleanAdsSetup || typeof player.setup !== 'function') {
      return player;
    }

    const setup = player.setup;

    player.setup = function (config) {
      const next = config && typeof config === 'object'
        ? Object.assign({}, config)
        : config;

      if (next && typeof next === 'object') delete next.advertising;

      return setup.call(this, next);
    };

    player.__cleanAdsSetup = true;
    return player;
  };

  const wrapJw = jw => {
    if (typeof jw !== 'function' || jw.__cleanAds) return jw;

    const wrapped = new Proxy(jw, {
      apply(target, thisArg, args) {
        return patchPlayer(Reflect.apply(target, thisArg, args));
      }
    });

    wrapped.__cleanAds = true;
    return wrapped;
  };

  let current = typeof page.jwplayer === 'function'
    ? wrapJw(page.jwplayer)
    : page.jwplayer;

  try {
    Object.defineProperty(page, 'jwplayer', {
      configurable: true,
      enumerable: true,
      get() {
        return current;
      },
      set(value) {
        current = typeof value === 'function' ? wrapJw(value) : value;
      }
    });
  } catch (_) {
    if (typeof page.jwplayer === 'function') {
      page.jwplayer = wrapJw(page.jwplayer);
    }
  }
}

if (/(^|\.)motchilltu\.com$/.test(hostname)) {
  try {
    Object.defineProperty(page, 'aam_ads_data', {
      configurable: true,
      get() {
        return [];
      },
      set() {}
    });

    Object.defineProperty(page, 'plpData', {
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

siteRules.push({
  selectors(host) {
    const list = [];

    if (/(^|\.)phimmotchill\.bar$/.test(host)) {
      list.push(
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
      );
    }

    if (/(^|\.)motchilltu\.com$/.test(host)) {
      list.push(
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
      );
    }

    if (/(^|\.)motchillhay\.mobi$/.test(host)) {
      list.push(
        '.catfish-banner',
        '.site-header-promo',
        '.revive-frame',
        'section[data-placement="banner"]',
        'section[data-placement="inline"]',
        'section[data-placement="sidebar"]',
        'ins[data-revive-id]',
        'a[href*="c-cl.php"]',
        'a[href*="c-asyncjs.php"]'
      );
    }

    return list;
  }
});
