---
name: clean-ads
description: >-
  Maintain the Clean Ads userscript in clean-ads.user.js: site flags, AdGuard
  compile, popup guards, overlay hiding, network blocks, and player ad skip.
  Use when editing clean-ads.user.js or clean-ads-remote.user.js, adding a film
  site or CSS selector, changing popup or network blocking, debugging ads on
  YouTube, Phimmotchill, Motchill, RoPhim, or yeuphim, or when the user mentions
  Clean Ads, userscript, quảng cáo, popup, or catfish.
---

# Clean Ads

`clean-ads.user.js` is the script. `clean-ads-remote.user.js` only downloads that file from a gist and injects it into the page. Behavior changes belong in `clean-ads.user.js`. Leave the loader gist URL, grants, and `@connect` hosts alone unless the user asks to publish or change how the script is fetched.

The userscript header is the contract: `@match *://*/*`, `@run-at document-start`, `@inject-into page`, `@grant` for `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `unsafeWindow`, and `@connect filters.adtidy.org`. A new cross-origin fetch needs a matching `@connect` on the script that actually performs it. The remote loader runs in the extension sandbox and `eval`s the payload in the page, so `GM_*` may be missing inside `clean-ads.user.js`. Keep using the existing `gmGet` / `gmSet` / `gmDel` / `gmXhr` guards.

## Page context

Resolve the page global once into `page` (`unsafeWindow`, else `window`). Patch `page` and `Page*` prototypes (`PageElement`, `PageWindow`, `PageHTMLAnchorElement`, `PageHTMLFormElement`, `PageHTMLBaseElement`). Patching the sandbox `window` does not affect the page when the remote loader injects the script.

The file is one IIFE with `'use strict'`. No modules, bundler, or dependencies. New helpers stay inside the IIFE. Log with `console.debug` and the prefix `[Clean Ads]`. Wrap prototype and `GM_*` calls in `try/catch`. At `document-start`, `document.documentElement` may not exist yet; follow the existing root-observer pattern.

`clean-ads.user.js` is the source of truth. README install text can drift from the code. Do not widen matching or blocking to match the README unless the user asks for that behavior, and do not rewrite the README unless the user-facing install story changes.

## What runs where

The script matches every site. Gates are hostname flags, not extra `@match` lines.

| Gate | Where it applies |
|---|---|
| Always | `#clean-ads-style`, `baseSelectors`, custom selectors, AdGuard cache/refresh, `cleanNode` observer, `fetch` / XHR / beacon / `src` blocks, `window.open`, anchor `click` and form `submit` hooks, overlay scan, 3-second hold-to-hide |
| `isYouTube` | YouTube skip interval and `youtubeSelectors` |
| `isStreamSite` | Per-site selector lists, `cleanStreamPage` |
| `inPlayerFrame` | `__tvcUrl__` / `__tvcLink__` / `__ADS_PAUSED_UNTIL__` locks, `playerFrameSelectors`, `skipEmbeddedPlayerAds` |
| `isMotchillTu` | Empty `aam_ads_data` and `plpData` |
| `guardPopups` | Strict new-tab policy, `<base target="_blank">` neutralization |

Current film hosts: `phimmotchill.bar`, `motchilltu.com`, `rophim10.cam`, `motchillhay.mobi`, `motchillx.cx`. Player hosts: `yeuphim.biz`, `devwithai.net`. YouTube includes `youtube-nocookie.com`. On `motchillx.cx`, `tracking-ubt-*.js` is an ad script: it covers the player with a transparent `z-index:2147483000` layer and opens `tikpeeaff.com`. Block that script path in `isAdURL`, and keep the layer in `motchillXSelectors`.

`inPlayerFrame` is true on a player host, or in an iframe whose referrer is a stream site. `ancestorIsStream` checks `location.ancestorOrigins`. `guardPopups` is `isStreamSite || inPlayerFrame || ancestorIsStream`.

`isContentHost` treats the current host, the film hosts, the player hosts, and YouTube as first-party content. `isThirdPartyHost` compares registrable domains (`AG_MULTI_SUFFIX` covers `com.vn` and similar). A third-party content or player host must be listed in `isContentHost` or popups and AdGuard will treat it as an ad.

## Add a film site

Update every one of these or the new host will hide banners but still open popups, or the opposite:

1. Add `isNewSite` next to the other hostname flags. Include it in `isStreamSite`.
2. Add the same pattern to `fromStreamSite` and `ancestorIsStream`.
3. Add the registrable host to `isContentHost`.
4. Add a selector array and spread it in `applyStyles` under that flag.
5. If the player lives on a new domain, add that domain to `isPlayerHost` and `isContentHost`, and extend `skipEmbeddedPlayerAds` only for APIs that page actually exposes.
6. If the page injects an ad config global before render, freeze it with `Object.defineProperty` on `page` the way `aam_ads_data` and `__tvcUrl__` are frozen. Guard with `try/catch`.

A renamed TLD of an existing site does not match. Flags are exact suffix tests.

## Selectors and hiding

One style node: `style#clean-ads-style`. `applyStyles` rebuilds it from `baseSelectors`, the active site lists, `loadCustomSelectors()`, the `[data-clean-ads-hide]` rule, and `adguardCssText`. Do not add a second style element.

Hide overlay ads with `data-clean-ads-hide`. Do not `remove()` modal, catfish, or sticky layers. Those pages are often React and remounting a removed node breaks playback. `cleanNode` may remove only `script` / `iframe` / `img` / `source` whose URL `isAdURL` already classified. `cleanStreamPage` only clears `modal-open` and overflow locks when the visible dialog is an ad modal.

`PLAYER_ROOT` (YouTube player, JW Player, Video.js, Plyr) is never an overlay target. `adLayer` also skips cookie consent, login/search dialogs, site header/nav, and page shells (`#app`, `#root`, `#__next`).

Hold-to-hide stores only `#id` or `body > tag:nth-child(n)` paths in `localStorage` key `cleanAdsSelectors`. Keep `selectorFor` and `loadCustomSelectors` on that same grammar.

## Popup policy

`shouldBlockPopup(url, target, source)` is the only decision. `source` is `'open'`, `'script'`, or `'click'`.

- Any `isAdURL` URL is blocked.
- On non-`guardPopups` pages, a real user click is allowed. Scripted `window.open`, `a.click()`, and `form.submit` are blocked when the destination is not an allowed host.
- On `guardPopups` pages, scripted new tabs are blocked, and navigation to a host outside `isContentHost` is blocked. Blank, `javascript:`, `data:`, and `blob:` targets are blocked.
- `window.open` must return `inertPopup()`, not `null`, so the movie page keeps running. A sized user popup (`width` and `height` both ≥ 320) on a non-stream page may still open a blank shell.
- User-initiated new tabs on ordinary sites stay open. Do not route click handling through `source: 'open'`.

`benignHosts` is the allowlist for scripted popups (login, pay, share, chat, media). Do not add an ad network there.

## Network blocks

`isAdURL` is the only classifier. It checks the AdGuard trie, `isGoogleAdClick` (`google.*` paths `/aclk` and `/pagead`), `adDomains`, `adservice.google.`, and Revive paths `/c-cl.php` and `/c-asyncjs.php`. Extend `adDomains` for a known ad host. Do not special-case a host inside `fetch` or XHR.

Hooks that must keep calling `isAdURL`: `setAttribute` for script/iframe/img/source/link, `src` setters, `fetch`, `XMLHttpRequest`, `sendBeacon`, and `cleanNode`. `filters.adtidy.org` is never blocked.

## AdGuard compile

Filters are AdGuard Base (`filters/2_optimized.txt`) and Popups (`filters/19_optimized.txt`). Only the top frame refreshes. Other frames poll. Cache lifetime is `AG_MAX_AGE` (4 days). Storage is `GM` keys `cleanAdsAgNet`, `cleanAdsAgGen`, `cleanAdsAgIds`, `cleanAdsD_{gen}_{bucket}`, with `localStorage` `cleanAdsAgNet` / `cleanAdsAgHost` as fallback. A refresh lock lives in `cleanAdsAgLock`.

`compileFilters` keeps:

- Network rules that start with `||` or `@@||`, with no `*` or `?`, and whose modifiers are only `third-party`, `popup`, `all`, `important`, or `match-case`.
- Cosmetic `##` / `#@#` rules whose domains are plain hostnames and whose selector passes `selectorUsable`.

It drops scriptlets and extended syntax (`#%#`, `#?#`, `#$#`, `#$?#`, `$$`), every name in `AG_SKIP_MODS` or `AG_TYPE_MODS`, negated modifiers, and redirect rules. Cosmetic selectors that use `:contains`, `:has-text`, `:xpath`, `:-abp-`, or a bare `html`/`body`/`div`/`a`/`iframe`/`video` are ignored. Do not execute AdGuard scriptlets in this userscript.

Bump `AG_VERSION` when the packed object shape changes so old caches are ignored. Domain cosmetic rules are stored per registrable-domain bucket (`bucketId` is the first two characters). After compile, call `installAdguard` then `persistAdguard`.

## Player skip

YouTube (`isYouTube` only): while `.html5-video-player` has `ad-showing`, click the skip button, mute, set `playbackRate` to 16, and seek near the end. Restore mute and rate when the ad class is gone. Do not remove the player node.

JW Player: act only while `jw-flag-ads` is present.

Embedded film player (`inPlayerFrame`): call `page.__ROPHIM_CANCEL_TVC__` when it is a function, finish `#tvc-video`, and click `#tvc-skip-btn`. The property locks for `__tvcUrl__`, `__tvcLink__`, and `__ADS_PAUSED_UNTIL__` must stay in place before the player reads them.

`tryClickSkipButtons` clicks only an exact skip label or an explicit skip-ad class. Do not click "skip to content".

## Checks

After an edit, confirm the file still parses:

```bash
node --check clean-ads.user.js
```

There is no browser harness in this repo. Do not claim a site was verified in a browser unless the userscript was actually installed and that site was loaded. Say which gate you changed and which hosts it affects.
