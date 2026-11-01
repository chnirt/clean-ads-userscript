// Bộ lọc AdGuard Base + Popups: chặn domain và ẩn phần tử.
// Scriptlet không chạy trong userscript.
const AG_VERSION = 1;
const AG_MAX_AGE = 4 * 24 * 60 * 60 * 1000;
const AG_FILTERS = [
  'https://filters.adtidy.org/extension/chromium/filters/2_optimized.txt',
  'https://filters.adtidy.org/extension/chromium/filters/19_optimized.txt'
];
const AG_TYPE_MODS = new Set([
  'script',
  'image',
  'stylesheet',
  'xmlhttprequest',
  'subdocument',
  'media',
  'font',
  'object',
  'other',
  'frame',
  'websocket',
  'ping',
  'document',
  'webrtc'
]);
const AG_SKIP_MODS = new Set([
  'domain',
  'denyallow',
  'badfilter',
  'generichide',
  'elemhide',
  'specifichide',
  'replace',
  'csp',
  'cookie',
  'removeparam',
  'header',
  'method',
  'to',
  'from',
  'permissions',
  'redirect-rule',
  'jsonprune',
  'hls',
  'url',
  'path',
  'content',
  'network',
  'extension',
  'jsinject',
  'empty',
  'mp4',
  'app',
  'stealth',
  'referrerpolicy',
  'urlskip',
  'reason',
  'strict1p',
  'strict3p',
  'ghide',
  'ehide',
  'shide',
  'inline-script',
  'inline-font',
  'object-subrequest'
]);
const AG_OK_MODS = new Set([
  'third-party',
  'popup',
  'all',
  'important',
  'match-case'
]);
const AG_MULTI_SUFFIX = new Set([
  'co.uk',
  'ac.uk',
  'org.uk',
  'gov.uk',
  'com.vn',
  'net.vn',
  'org.vn',
  'gov.vn',
  'edu.vn',
  'com.au',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.br',
  'co.in',
  'com.tr',
  'com.mx',
  'co.kr',
  'com.sg',
  'com.my',
  'com.ph',
  'co.th',
  'com.tw',
  'co.id',
  'com.hk',
  'co.nz',
  'com.ar',
  'com.co',
  'com.ua',
  'co.za',
  'com.cn',
  'co.il',
  'com.pk',
  'com.ng'
]);

const adguard = {
  ready: false,
  block: null,
  allow: null,
  third: null,
  paths: null
};

let adguardCssText = '';

function registrable(host) {
  const parts = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '')
    .split('.')
    .filter(Boolean);

  if (parts.length < 2) return parts.join('.');

  const last2 = parts.slice(-2).join('.');

  if (parts.length >= 3 && AG_MULTI_SUFFIX.has(last2)) {
    return parts.slice(-3).join('.');
  }

  return last2;
}

function bucketId(host) {
  return registrable(host)
    .slice(0, 2)
    .replace(/[^a-z0-9]/g, '0') || '00';
}

function hostMatches(domain, host) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isThirdPartyHost(host) {
  return registrable(host) !== registrable(hostname);
}

function trieNode() {
  return { hit: 0, kids: new Map() };
}

function buildTrie(text) {
  const root = trieNode();

  if (!text) return root;

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const host = lines[i];
    if (!host) continue;

    const parts = host.split('.');
    let node = root;

    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const label = parts[p];
      let next = node.kids.get(label);

      if (!next) {
        next = trieNode();
        node.kids.set(label, next);
      }

      node = next;
    }

    node.hit = 1;
  }

  return root;
}

function walkTrie(root, host) {
  if (!root) return false;

  let node = root;
  const parts = host.split('.');

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    node = node.kids.get(parts[i]);
    if (!node) return false;
    if (node.hit) return true;
  }

  return false;
}

function buildPaths(text) {
  const map = new Map();

  if (!text) return map;

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;

    const hostEnd = line.indexOf('\t');
    const pathEnd = line.indexOf('\t', hostEnd + 1);
    if (hostEnd < 1 || pathEnd < 0) continue;

    const host = line.slice(0, hostEnd);
    const path = line.slice(hostEnd + 1, pathEnd);
    const flags = line.slice(pathEnd + 1);
    if (!host || !path) continue;

    let list = map.get(host);

    if (!list) {
      list = [];
      map.set(host, list);
    }

    list.push({
      path,
      allow: flags.indexOf('a') !== -1,
      third: flags.indexOf('t') !== -1,
      boundary: flags.indexOf('^') !== -1
    });
  }

  return map;
}

function pathMatches(hay, path, boundary) {
  let from = 0;

  while (from <= hay.length) {
    const at = hay.indexOf(path, from);
    if (at === -1) return false;

    const prev = at === 0 ? '' : hay.charAt(at - 1);
    const prevOk = !prev || !/[A-Za-z0-9]/.test(prev);
    const next = hay.charAt(at + path.length);
    const nextOk = !boundary || !next || /[^A-Za-z0-9_%~.-]/.test(next);

    if (prevOk && nextOk) return true;
    from = at + 1;
  }

  return false;
}

function pathDecision(host, parsed) {
  if (!adguard.paths) return '';

  const hay = `${parsed.pathname || ''}${parsed.search || ''}`;
  let blocked = false;
  let name = host;

  while (name && name.includes('.')) {
    const list = adguard.paths.get(name);

    if (list) {
      for (let i = 0; i < list.length; i += 1) {
        const rule = list[i];

        if (rule.third && !isThirdPartyHost(host)) continue;
        if (!pathMatches(hay, rule.path, rule.boundary)) continue;
        if (rule.allow) return 'allow';
        blocked = true;
      }
    }

    const dot = name.indexOf('.');
    if (dot === -1) break;
    name = name.slice(dot + 1);
  }

  return blocked ? 'block' : '';
}

function adguardBlocks(host, parsed) {
  if (!adguard.ready || !host) return false;
  if (host === 'filters.adtidy.org') return false;

  const pathHit = pathDecision(host, parsed);
  if (pathHit === 'allow') return false;
  if (walkTrie(adguard.allow, host)) return false;
  if (pathHit === 'block') return true;
  if (isContentHost(host)) return false;
  if (walkTrie(adguard.block, host)) return true;
  if (walkTrie(adguard.third, host) && isThirdPartyHost(host)) return true;

  return false;
}

function selectorUsable(selector) {
  if (!selector || selector.length > 300) return false;
  if (/[\t\r\n{}<>]/.test(selector) || selector.includes('/*')) return false;
  if (
    /:(?:contains|has-text|matches-css|matches-attr|xpath|style|remove|upward|if|not-if|min-text-length|properties)\b|:-abp-|\[-ext-/
      .test(selector)
  ) {
    return false;
  }

  return !/^(?:html|body|div|span|a|img|iframe|video|section|main|head)$/i
    .test(selector);
}

function domainListOk(domainsPart) {
  if (/[$*?#]/.test(domainsPart)) return null;

  const include = [];
  const exclude = [];

  if (!domainsPart) return { include, exclude };

  const pieces = domainsPart.split(',');
  if (pieces.length > 12) return null;

  for (let i = 0; i < pieces.length; i += 1) {
    let domain = pieces[i].trim().toLowerCase();
    if (!domain) continue;

    let neg = false;

    if (domain.charAt(0) === '~') {
      neg = true;
      domain = domain.slice(1);
    }

    if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.')) {
      return null;
    }

    (neg ? exclude : include).push(domain);
  }

  return { include, exclude };
}

function compileFilters(text) {
  const block = [];
  const allow = [];
  const third = [];
  const paths = [];
  const generic = [];
  const buckets = new Map();

  function addDomain(domain, kind, exclude, selector) {
    const id = bucketId(domain);
    let rows = buckets.get(id);

    if (!rows) {
      rows = [];
      buckets.set(id, rows);
    }

    rows.push(`${kind}\t${domain}\t${exclude}\t${selector}`);
  }

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.charAt(0) === '!') continue;
    if (
      line.includes('#%#') ||
      line.includes('#?#') ||
      line.includes('#$#') ||
      line.includes('#$?#') ||
      line.includes('$$')
    ) {
      continue;
    }

    const exceptAt = line.indexOf('#@#');
    const hideAt = line.indexOf('##');

    if (exceptAt >= 0 || hideAt >= 0) {
      const isExcept = exceptAt >= 0 && (hideAt < 0 || exceptAt <= hideAt);
      const pos = isExcept ? exceptAt : hideAt;
      const selector = line.slice(pos + (isExcept ? 3 : 2)).trim();
      const domains = domainListOk(line.slice(0, pos).trim());

      if (!domains || !selectorUsable(selector)) continue;

      if (!domains.include.length && !isExcept) {
        generic.push(selector);

        for (let e = 0; e < domains.exclude.length; e += 1) {
          addDomain(domains.exclude[e], 'x', '', selector);
        }

        continue;
      }

      if (!domains.include.length) continue;

      const exclude = domains.exclude.join('|');
      const kind = isExcept ? 'x' : 'h';

      for (let d = 0; d < domains.include.length; d += 1) {
        addDomain(domains.include[d], kind, exclude, selector);
      }

      continue;
    }

    let exception = false;
    let rest = line;

    if (rest.startsWith('@@')) {
      exception = true;
      rest = rest.slice(2);
    }

    if (!rest.startsWith('||')) continue;

    const dollar = rest.indexOf('$');
    const pattern = dollar === -1 ? rest : rest.slice(0, dollar);
    const modifiers = dollar === -1 ? '' : rest.slice(dollar + 1);
    const names = modifiers
      ? modifiers.split(',').map(part => part.trim().split('=')[0]).filter(Boolean)
      : [];

    if (names.some(name =>
      name.charAt(0) === '~' ||
      name.startsWith('redirect') ||
      AG_SKIP_MODS.has(name) ||
      AG_TYPE_MODS.has(name) ||
      !AG_OK_MODS.has(name)
    )) {
      continue;
    }

    let body = pattern.slice(2);
    const boundary = body.endsWith('^');
    if (boundary) body = body.slice(0, -1);
    if (!body || /[*?]/.test(body) || body.includes('\t')) continue;

    const slash = body.indexOf('/');
    const host = (slash === -1 ? body : body.slice(0, slash)).toLowerCase();
    const path = slash === -1 ? '' : body.slice(slash);

    if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) continue;
    if (path.length > 200) continue;

    const thirdParty = names.includes('third-party');

    if (path) {
      const flags =
        `${exception ? 'a' : ''}${thirdParty ? 't' : ''}${boundary ? '^' : ''}`;
      paths.push(`${host}\t${path}\t${flags}`);
    } else if (exception) {
      allow.push(host);
    } else if (thirdParty) {
      third.push(host);
    } else {
      block.push(host);
    }
  }

  const packedBuckets = new Map();

  buckets.forEach((rows, id) => {
    packedBuckets.set(id, rows.join('\n'));
  });

  return {
    pack: {
      v: AG_VERSION,
      at: Date.now(),
      gen: 0,
      block: block.join('\n'),
      allow: allow.join('\n'),
      third: third.join('\n'),
      paths: paths.join('\n'),
      generic: generic.join('\n')
    },
    buckets: packedBuckets
  };
}

function rowsForHost(text, host) {
  const hide = [];
  const unhide = [];

  if (!text) return { hide, unhide };

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const tab1 = line.indexOf('\t');
    const tab2 = line.indexOf('\t', tab1 + 1);
    const tab3 = line.indexOf('\t', tab2 + 1);
    if (tab1 < 1 || tab2 < 0 || tab3 < 0) continue;

    const kind = line.slice(0, tab1);
    const domain = line.slice(tab1 + 1, tab2);
    const exclude = line.slice(tab2 + 1, tab3);
    const selector = line.slice(tab3 + 1);

    if (!hostMatches(domain, host)) continue;

    if (
      kind === 'h' &&
      exclude &&
      exclude.split('|').some(item => item && hostMatches(item, host))
    ) {
      continue;
    }

    if (!selectorUsable(selector)) continue;
    (kind === 'x' ? unhide : hide).push(selector);
  }

  return { hide, unhide };
}

function rebuildAdguardCss(genericText, domainText) {
  const hide = new Set();
  const unhide = new Set();

  if (genericText) {
    const generic = genericText.split('\n');

    for (let i = 0; i < generic.length; i += 1) {
      if (selectorUsable(generic[i])) hide.add(generic[i]);
    }
  }

  const rows = rowsForHost(domainText, hostname);

  for (let i = 0; i < rows.hide.length; i += 1) hide.add(rows.hide[i]);
  for (let i = 0; i < rows.unhide.length; i += 1) {
    unhide.add(rows.unhide[i]);
  }
  unhide.forEach(selector => hide.delete(selector));

  const parts = [];
  hide.forEach(selector => {
    parts.push(`${selector}{display:none!important;visibility:hidden!important}`);
  });

  adguardCssText = parts.join('\n');
}

function installAdguard(pack, bucket, restyle) {
  adguard.block = buildTrie(pack.block);
  adguard.allow = buildTrie(pack.allow);
  adguard.third = buildTrie(pack.third);
  adguard.paths = buildPaths(pack.paths);
  adguard.ready = true;
  rebuildAdguardCss(pack.generic, bucket);

  if (restyle) applyStyles();
}

function readStoredAdguard() {
  if (gmGet) {
    try {
      const pack = gmGet('cleanAdsAgNet', null);

      if (pack && pack.v === AG_VERSION && typeof pack.block === 'string') {
        return {
          pack,
          bucket: gmGet(`cleanAdsD_${pack.gen}_${bucketId(hostname)}`, '') || '',
          stale: Date.now() - pack.at > AG_MAX_AGE
        };
      }
    } catch (_) {}
  }

  try {
    const raw = localStorage.getItem('cleanAdsAgNet');
    if (!raw) return null;

    const pack = JSON.parse(raw);

    if (!pack || pack.v !== AG_VERSION || typeof pack.block !== 'string') {
      return null;
    }

    return {
      pack,
      bucket: localStorage.getItem('cleanAdsAgHost') || '',
      stale: Date.now() - pack.at > AG_MAX_AGE
    };
  } catch (_) {
    return null;
  }
}

function persistAdguard(compiled, done) {
  const finish = () => {
    if (typeof done === 'function') done();
  };
  const gen = Date.now();
  const ids = [];

  compiled.buckets.forEach((_text, id) => {
    ids.push(id);
  });

  compiled.pack.gen = gen;

  function saveLocal() {
    try {
      localStorage.setItem('cleanAdsAgNet', JSON.stringify(compiled.pack));
      localStorage.setItem(
        'cleanAdsAgHost',
        compiled.buckets.get(bucketId(hostname)) || ''
      );
    } catch (_) {}
  }

  if (!gmSet) {
    saveLocal();
    finish();
    return;
  }

  const prevGen = gmGet ? gmGet('cleanAdsAgGen', 0) : 0;
  const prevIds = gmGet ? gmGet('cleanAdsAgIds', []) : [];

  const write = index => {
    try {
      const end = Math.min(index + 40, ids.length);

      for (let i = index; i < end; i += 1) {
        gmSet(
          `cleanAdsD_${gen}_${ids[i]}`,
          compiled.buckets.get(ids[i])
        );
      }

      if (end < ids.length) {
        setTimeout(() => write(end), 30);
        return;
      }

      gmSet('cleanAdsAgNet', compiled.pack);
      gmSet('cleanAdsAgGen', gen);
      gmSet('cleanAdsAgIds', ids);

      if (gmDel && prevGen && prevGen !== gen && Array.isArray(prevIds)) {
        for (let i = 0; i < prevIds.length; i += 1) {
          gmDel(`cleanAdsD_${prevGen}_${prevIds[i]}`);
        }
      }
    } catch (error) {
      console.debug('[Clean Ads] AdGuard save failed:', error);
      saveLocal();
    }

    finish();
  };

  write(0);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    if (gmXhr) {
      gmXhr({
        method: 'GET',
        url,
        timeout: 45000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(String(response.responseText || ''));
          } else {
            reject(new Error(String(response.status)));
          }
        },
        onerror() {
          reject(new Error('network'));
        },
        ontimeout() {
          reject(new Error('timeout'));
        }
      });
      return;
    }

    const request = nativePageFetch || fetch;

    request(url, { credentials: 'omit' }).then(response => {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    }).then(resolve, reject);
  });
}

let adguardRefreshing = false;

function refreshAdguard() {
  if (adguardRefreshing) return;

  const now = Date.now();

  if (gmGet && gmSet) {
    const lock = Number(gmGet('cleanAdsAgLock', 0)) || 0;

    if (now - lock < 60000) {
      setTimeout(pollAdguard, 1500);
      return;
    }

    gmSet('cleanAdsAgLock', now);
  }

  adguardRefreshing = true;

  httpGet(AG_FILTERS[0]).then(base => {
    if (!base || base.length < 100000) {
      throw new Error('short');
    }

    return httpGet(AG_FILTERS[1]).catch(() => '').then(popups => (
      `${base}\n${popups || ''}`
    ));
  }).then(text => {
    const compiled = compileFilters(text);

    installAdguard(
      compiled.pack,
      compiled.buckets.get(bucketId(hostname)) || '',
      true
    );
    console.debug(
      '[Clean Ads] AdGuard filters updated:',
      compiled.pack.block ? compiled.pack.block.split('\n').length : 0
    );
    persistAdguard(compiled, finishAdguardRefresh);
  }).catch(error => {
    console.debug('[Clean Ads] AdGuard update failed:', error);
    finishAdguardRefresh();
  });
}

function finishAdguardRefresh() {
  adguardRefreshing = false;

  if (gmSet) {
    try {
      gmSet('cleanAdsAgLock', 0);
    } catch (_) {}
  }
}

function pollAdguard() {
  const loaded = readStoredAdguard();

  if (loaded && loaded.pack.block) {
    installAdguard(loaded.pack, loaded.bucket, true);
    return;
  }

  const lock = gmGet ? Number(gmGet('cleanAdsAgLock', 0)) || 0 : 0;

  if (lock && Date.now() - lock < 60000) {
    setTimeout(pollAdguard, 1500);
    return;
  }

  refreshAdguard();
}

function loadAdguardCache() {
  const loaded = readStoredAdguard();

  if (loaded) installAdguard(loaded.pack, loaded.bucket, false);

  let topFrame = true;

  try {
    topFrame = page.top === page.self;
  } catch (_) {
    topFrame = false;
  }

  if (!topFrame) {
    if (!loaded) setTimeout(pollAdguard, 800);
    return;
  }

  if (!loaded || loaded.stale) {
    setTimeout(refreshAdguard, loaded ? 1200 : 50);
  }
}
