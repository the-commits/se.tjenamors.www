# Agent Instructions

## Versioning Workflow
This project utilizes semantic versioning (semver). When bumping the version, you MUST ensure that all of the following are synchronously updated:

1. **`package.json`**: Update the `"version"` field to reflect the new semver.
2. **`src/js/welcome.js`**: Update the `console.log` string to strictly match the format `'%cTjenamors vX.X.X! %c🇸🇪'`, replacing `X.X.X` with the requested new version.
3. **Git Tagging**: Create a git commit with the version bump and create an annotated git tag matching the version (e.g. `v1.0.0`). Push the changes and the tags to the remote repository (`git push && git push --tags`).

## Architecture & Performance Learnings

### 1. Bundled Dependencies (No CDN Fallbacks)
- `hls.js` is bundled locally from `node_modules/hls.js/dist/hls.min.js` to `dist/build/assets/hls.min.js` via `scripts/build.mjs`. Do not rely on external CDNs for core playback to prevent cold-start race conditions.

### 2. CSS Bundling & `@import` Inlining
- Modular CSS files in `src/css/` are bundled into a single stylesheet (`dist/css/style.css`) at build time using `postcss-import`.
- Unbundled `@import` chains cause a 7+ sequential request network waterfall on cold loads, delaying CSS completion and triggering Firefox forced-layout warnings (`"Layout was forced before the page was fully loaded"`). Always ensure `@import` chains are inlined at build time.

### 3. Layout Flushes & Render Timing
- Synchronous layout reads (`getBoundingClientRect`, `offsetWidth`, etc.) executed while stylesheets are still downloading force a synchronous reflow and browser warnings.
- Layout-dependent positioning functions (e.g., `revealPlayer()` in `src/js/player.js`) must verify `document.readyState === 'complete'` or defer execution via `window.addEventListener('load', ...)` when DOM/CSS is still loading.

### 4. Cast SDK & Lazy Loading (Privacy First)
- Google Cast SDK (`cast_sender.js`) is Chromium-only (`window.chrome`).
- To respect user privacy and avoid unsolicited third-party network requests on startup, Cast SDK should be lazy-loaded on user click (`loadCastSDK()`), guarded with `if (!window.chrome) return`.

### 5. Edge Proxies & Injected Scripts
- Edge proxies (e.g., Cloudflare Web Analytics) may inject inline scripts and beacons. Pinned sha256 CSP hashes break when edge providers rotate loader snippets. Handle edge injections via host rules or disable them in the proxy dashboard.

### 6. Known Bug: Firefox MPRIS Artwork Never Updates (Upstream)
- **Upstream bug:** [Firefox bug 1903946](https://bugzilla.mozilla.org/show_bug.cgi?id=1903946) — Firefox does not re-push artwork to MPRIS on in-place `mediaSession.metadata` updates. Linux media widgets (DankMaterialShell, KDE Connect, Plasma) show stale cover art indefinitely while title/artist update correctly.
- **Workarounds shipped (v1.4.2/v1.4.3, `src/js/media-session.js`):** periodic metadata re-send every 15s, `?tm=` cache-buster on artwork URLs (per-song on apply, per-timestamp on re-send), re-apply on artwork preload, `metadata = null` teardown before every apply, and per-song page-URL bust via `history.replaceState('#<songid>')` (consumers may key art caches on `xesam:url`, which is constant for a single-page player).
- **Not fully fixable from JS** if Firefox caches artwork deeper in its MPRIS bridge — the real fix must land in Firefox. Diagnose with `dbus-monitor "interface='org.freedesktop.DBus.Properties',member='PropertiesChanged'"`: if `mpris:artUrl` changes on the bus but the widget still shows old art, the bug is in the widget, not Firefox.

