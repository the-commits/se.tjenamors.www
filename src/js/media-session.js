// Media Session API — OS-level media controls (lock screen, notification shade, media keys).
// Feature flag: set window.__MEDIA_SESSION_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for media session logging.

import { nowPlayingSong } from './api.js';
import { audio } from './dom.js';

// --- State ---

let lastSongId = null;
let checkInterval = null;
let metadataRefreshTimer = null;

// --- Feature flag ---

function isEnabled() {
  if (window.__MEDIA_SESSION_ENABLED === false) return false;
  return true;
}

// --- Update metadata ---

function applyMetadata(song) {
  const title = song.title || 'TjenaMors Radio';
  const artist = song.artist || 'Vi spelar bra skit!';

  const artwork = song.art
    ? [
        { src: song.art, sizes: '256x256' },
        { src: song.art, sizes: '512x512' },
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

function scheduleMetadataRefresh(songId) {
  if (metadataRefreshTimer) clearTimeout(metadataRefreshTimer);
  metadataRefreshTimer = setTimeout(() => {
    if (!nowPlayingSong) return;
    if (nowPlayingSong.id !== songId) return;
    applyMetadata(nowPlayingSong);
    metadataRefreshTimer = null;
  }, 10000);
}

function updateMetadata() {
  if (!('mediaSession' in navigator)) return;
  if (!nowPlayingSong) return;
  if (nowPlayingSong.id === lastSongId) return;
  lastSongId = nowPlayingSong.id;

  applyMetadata(nowPlayingSong);

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

  if (window.__DEBUG) console.log('[MEDIA] initialized');
}
