// Volume control — slider + mute toggle + cookie persistence.
// Feature flag: set window.__VOLUME_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for volume change logging.

import { audio, volumeSlider, volumeIcon } from './dom.js';

// --- State ---

let lastNonZero = 1; // last volume > 0 (for mute restore)
let isMuted = false;

// --- Feature flag ---

function isEnabled() {
  if (window.__VOLUME_ENABLED === false) return false;
  return true;
}

// --- Icon helpers ---

const ICONS = {
  high: 'fa-volume-high',
  low: 'fa-volume-low',
  off: 'fa-volume-off',
  xmark: 'fa-volume-xmark',
};

function setIcon(iconClass) {
  if (!volumeIcon) return;
  // Remove all volume icon classes
  for (const cls of Object.values(ICONS)) {
    volumeIcon.classList.remove(cls);
  }
  volumeIcon.classList.add(iconClass);
}

function iconForVolume(vol) {
  if (vol <= 0) return ICONS.xmark;
  if (vol <= 0.33) return ICONS.off;
  if (vol <= 0.66) return ICONS.low;
  return ICONS.high;
}

// --- Cookie ---

const COOKIE_NAME = 'tj_vol';
const MAX_AGE = 86400; // 24 hours

function loadCookie() {
  const m = document.cookie.match(/(?:^|; )tj_vol=([^;]*)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}

function saveCookie(vol, preMute) {
  const data = preMute != null ? { v: vol, m: preMute } : { v: vol };
  document.cookie = COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(data)) + '; path=/; max-age=' + MAX_AGE;
}

// --- Apply volume to audio and UI ---

function applyVolume(vol) {
  const clamped = Math.max(0, Math.min(1, vol));
  audio.volume = clamped;
  if (volumeSlider) volumeSlider.value = clamped;
  setIcon(iconForVolume(clamped));
  if (window.__DEBUG) console.log('[VOLUME]', clamped.toFixed(2));
}

// --- Slider input handler ---

function onSliderInput() {
  const vol = parseFloat(volumeSlider.value);
  isMuted = false;
  if (vol > 0) lastNonZero = vol;
  applyVolume(vol);
  saveCookie(vol, null);
}

// --- Icon click: toggle mute ---

function onIconClick() {
  const current = audio.volume;
  if (isMuted || current <= 0) {
    // Restore to last non-zero
    isMuted = false;
    const restore = lastNonZero > 0 ? lastNonZero : 1;
    applyVolume(restore);
    saveCookie(restore, null);
  } else {
    // Mute
    isMuted = true;
    lastNonZero = current;
    applyVolume(0);
    saveCookie(0, lastNonZero);
  }
}

// --- Init ---

export function initVolume() {
  if (!isEnabled()) {
    if (window.__DEBUG) console.log('[VOLUME] disabled (feature flag)');
    return;
  }
  if (!volumeSlider || !volumeIcon) return;

  // Restore from cookie
  const saved = loadCookie();
  if (saved) {
    const vol = saved.v != null ? saved.v : 1;
    if (saved.m != null && vol === 0) {
      // Was muted — store pre-mute for icon-click restore
      lastNonZero = saved.m > 0 ? saved.m : 1;
      isMuted = true;
    } else {
      lastNonZero = vol > 0 ? vol : 1;
      isMuted = false;
    }
    applyVolume(vol);
  } else {
    // Default: full volume
    applyVolume(1);
    lastNonZero = 1;
    saveCookie(1, null);
  }

  // Bind events
  volumeSlider.addEventListener('input', onSliderInput);
  volumeIcon.addEventListener('click', onIconClick);
  volumeIcon.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onIconClick();
    }
  });

  if (window.__DEBUG) console.log('[VOLUME] initialized');
}
