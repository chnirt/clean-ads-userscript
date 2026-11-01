// Mọi host có nhãn motchill, kể cả subdomain và đuôi mới.
filmBrands.push('motchill');

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
