// Mọi host có nhãn rophim. Selector thêm chỉ đúng rophim10.cam.
filmBrands.push('rophim');

siteRules.push({
  selectors(host) {
    if (!/(^|\.)rophim10\.cam$/.test(host)) return [];

    return [
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
  }
});
