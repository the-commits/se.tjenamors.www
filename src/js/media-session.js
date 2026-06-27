// Media Session API — OS-level media controls (lock screen, notification shade, media keys).
// Feature flag: set window.__MEDIA_SESSION_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for media session logging.

import { nowPlayingSong } from './api.js';
import { audio } from './dom.js';

// --- State ---

let lastSongId = null;
let checkInterval = null;

// --- Feature flag ---

function isEnabled() {
  if (window.__MEDIA_SESSION_ENABLED === false) return false;
  return true;
}

// --- Update metadata ---

function updateMetadata() {
  if (!('mediaSession' in navigator)) return;
  if (!nowPlayingSong) return;
  if (nowPlayingSong.id === lastSongId) return;
  lastSongId = nowPlayingSong.id;

  const title = nowPlayingSong.title || 'TjenaMors Radio';
  const artist = nowPlayingSong.artist || 'Vi spelar bra skit!';

  const artwork = nowPlayingSong.art
    ? [
        { src: nowPlayingSong.art, sizes: '256x256', type: 'image/jpeg' },
        { src: nowPlayingSong.art, sizes: '512x512', type: 'image/jpeg' },
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
  } catch (_) {
    // Older browsers throw on null handlers
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

  // Set initial metadata if song data already exists
  updateMetadata();

  // Poll every 2s for song changes (same cadence as API poll)
  checkInterval = setInterval(updateMetadata, 2000);

  if (window.__DEBUG) console.log('[MEDIA] initialized');
}
