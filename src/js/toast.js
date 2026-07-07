// Toast notification module — manages a fixed top-of-page notification.
// Used by the request retry system to show status updates.
//
// Feature flag: window.__REQUEST_TOAST_ENABLED

import { requestToast, requestToastText, requestToastCancel } from './dom.js';

let currentCancelHandler = null;
let activeTimeout = null;

export function isToastEnabled() {
  if (window.__REQUEST_TOAST_ENABLED === false) return false;
  return true;
}

/**
 * Show a toast notification.
 * @param {string} text - The message to display
 * @param {object} [options]
 * @param {string} [options.type] - 'info' (default), 'success', 'error'
 * @param {number} [options.duration] - Auto-hide after ms (0 = no auto-hide)
 * @param {function} [options.onCancel] - Called when cancel is clicked
 */
export function showToast(text, options = {}) {
  if (!isToastEnabled()) return;

  const { type = 'info', duration = 0, onCancel } = options;

  // Clear any previous timeout
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }

  // Store cancel handler
  currentCancelHandler = onCancel || null;

  // Set text (supports HTML for formatting)
  requestToastText.innerHTML = text;

  // Set type class
  requestToast.classList.remove('success', 'error');
  if (type === 'success') requestToast.classList.add('success');
  if (type === 'error') requestToast.classList.add('error');

  // Show toast
  requestToast.classList.add('visible');

  // Auto-hide
  if (duration > 0) {
    activeTimeout = setTimeout(() => {
      hideToast();
    }, duration);
  }
}

/** Hide the toast immediately */
export function hideToast() {
  requestToast.classList.remove('visible');
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  currentCancelHandler = null;
}

/** Update the toast text without changing other state */
export function updateToastText(text) {
  requestToastText.textContent = text;
}

/** Initialize the toast module — wires up cancel button */
export function initToast() {
  if (!isToastEnabled()) return;

  requestToastCancel.addEventListener('click', () => {
    if (typeof currentCancelHandler === 'function') {
      currentCancelHandler();
    }
    hideToast();
  });
}
