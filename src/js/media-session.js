// Media Session API — OS-level media controls (lock screen, notification shade, media keys).
// Feature flag: set window.__MEDIA_SESSION_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for media session logging.

import { nowPlayingSong } from './api.js';
import { audio } from './dom.js';

// --- State ---

let lastSongId = null;
let checkInterval = null;
let metadataRefreshTimer = null;
let resendInterval = null;

// Re-send cadence: platforms (Bluetooth AVRCP, OS media notifications) can
// miss the artwork fetch on first assignment and show stale cover art.
// Re-sending metadata every 15s lets lagging clients catch up.
const METADATA_RESEND_MS = 15000;

// --- Feature flag ---

function isEnabled() {
  if (window.__MEDIA_SESSION_ENABLED === false) return false;
  return true;
}

// --- Update metadata ---

function applyMetadata(song, cacheBuster = song.id) {
  // Firefox bug 1903946: Firefox does not re-push artwork to MPRIS on
  // in-place metadata updates, so consumers show stale cover art forever.
  // Workaround: clear metadata first so every apply is a full
  // teardown/re-announce cycle — like a real track change.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1903946
  navigator.mediaSession.metadata = null;

  const title = song.title || 'TjenaMors Radio';
  const artist = song.artist || 'Vi spelar bra skit!';

  const artSrc = artworkSrc(song, cacheBuster);

  const artwork = artSrc
    ? [
        { src: artSrc, sizes: '256x256' },
        { src: artSrc, sizes: '512x512' },
      ]
    : [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ];

  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album: 'TjenaMors.se',
    artwork,
  });

  if (window.__DEBUG) console.log('[MEDIA] metadata:', title, '—', artist);
}

// Cache-buster on the artwork URL: some consumers (KDE Connect, MPRIS
// bridges) cache or dedupe artwork by URL — a fresh query forces them to
// re-fetch instead of reusing a stale cached cover.
function artworkSrc(song, cacheBuster = song.id) {
  if (!song.art) return null;
  return `${song.art}${song.art.includes('?') ? '&' : '?'}tm=${cacheBuster}`;
}

// Re-apply metadata as soon as the artwork has finished loading into the
// browser cache — a following re-send (or the OS's own re-fetch) then has a
// warm cache to read from instead of racing the network.
function reapplyWhenArtLoads(song) {
  const src = artworkSrc(song);
  if (!src) return;
  const img = new Image();
  img.onload = () => {
    if (!nowPlayingSong) return;
    if (nowPlayingSong.id !== song.id) return;
    applyMetadata(nowPlayingSong);
    if (window.__DEBUG) console.log('[MEDIA] art loaded, metadata re-applied');
  };
  img.src = src;
}

function resendMetadata() {
  if (!nowPlayingSong) return;
  // Fresh cache-buster on every re-send so URL-caching consumers can't
  // serve a stale cover from a previous failed or outdated fetch
  applyMetadata(nowPlayingSong, Date.now());
  if (window.__DEBUG) console.log('[MEDIA] metadata re-sent (periodic)');
}

function scheduleMetadataRefresh(songId) {
  if (metadataRefreshTimer) clearTimeout(metadataRefreshTimer);
  metadataRefreshTimer = setTimeout(() => {
    if (!nowPlayingSong) return;
    if (nowPlayingSong.id !== songId) return;
    applyMetadata(nowPlayingSong);
    metadataRefreshTimer = null;
  }, 10000);
}

// Make the page URL song-dependent. MPRIS consumers may key artwork caches
// on xesam:url (derived from the page URL) — and tjenamors.se never changes
// on its own since it's a single-page player polling the API. Hash-only
// change: no reload, no history entries, share links unaffected.
function bustPageUrl(song) {
  try {
    history.replaceState(null, '', '#' + song.id);
  } catch (e) {
    if (window.__DEBUG) console.warn('[MEDIA] page URL bust failed', e);
  }
}

function updateMetadata() {
  if (!('mediaSession' in navigator)) return;
  if (!nowPlayingSong) return;
  if (nowPlayingSong.id === lastSongId) return;
  lastSongId = nowPlayingSong.id;

  bustPageUrl(nowPlayingSong);
  applyMetadata(nowPlayingSong);
  reapplyWhenArtLoads(nowPlayingSong);

  // Bluetooth AVRCP workaround: re-send metadata after delay
  // so car head units get a second chance to pick up the artwork URL
  scheduleMetadataRefresh(nowPlayingSong.id);
}

// --- Sync playback state ---

function syncPlaybackState() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  } catch (e) {
    if (window.__DEBUG) console.warn('[MEDIA] playbackState failed', e);
  }
}

audio.addEventListener('play', syncPlaybackState);
audio.addEventListener('pause', syncPlaybackState);

// --- Set up action handlers ---

function setupActions() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    audio.play().catch(() => {});
    if (window.__DEBUG) console.log('[MEDIA] play action');
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
    if (window.__DEBUG) console.log('[MEDIA] pause action');
  });

  // Disable seek/next/prev — not applicable for live radio
  try {
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
  } catch (e) {
    if (window.__DEBUG) console.warn('[MEDIA] failed to disable action handlers', e);
  }
}

// --- Init ---

export function initMediaSession() {
  if (!isEnabled()) {
    if (window.__DEBUG) console.log('[MEDIA] disabled (feature flag)');
    return;
  }

  if (!('mediaSession' in navigator)) {
    if (window.__DEBUG) console.log('[MEDIA] MediaSession API not supported');
    return;
  }

  setupActions();

  // Sync initial playback state to current audio state
  syncPlaybackState();

  // Set initial metadata if song data already exists
  updateMetadata();

  // Poll every 2s for song changes (same cadence as API poll)
  checkInterval = setInterval(updateMetadata, 2000);

  // Re-send metadata every 15s so platforms that missed the artwork sync
  // catch up later instead of showing stale cover art
  resendInterval = setInterval(resendMetadata, METADATA_RESEND_MS);

  if (window.__DEBUG) console.log('[MEDIA] initialized');
}
