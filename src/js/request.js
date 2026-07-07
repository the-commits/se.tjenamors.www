import {
  requestBtn,
  requestModal,
  requestClose,
  requestSearch,
  requestList,
  requestPrev,
  requestNext,
  requestPageInfo,
  requestFeedback,
  requestFeedbackText
} from './dom.js';
import {
  SATIRICAL_MESSAGES,
  RETRY_SARCASM,
  ALREADY_REQUESTED,
  RETRY_FAILED,
  ERROR_HEADERS
} from './satirical-messages.js';
import { showToast, hideToast } from './toast.js';

const pick = a => a[Math.random() * a.length | 0];
const SCHEDULE_API = 'https://radio.tjenamors.se/api/station/1/schedule';
const REQUESTS_API = 'https://radio.tjenamors.se/api/station/1/requests';
const REQUEST_SUBMIT_API = 'https://radio.tjenamors.se/api/station/1/request/';

let requestableSongs = [];
let filteredSongs = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let isRequestEnabled = false;

export function isEnabled() {
  if (window.__REQUEST_SONG_ENABLED === false) return false;
  return true;
}

export async function checkSchedule() {
  if (!isEnabled()) {
    disableButton('Funktionen är avstängd');
    return;
  }

  try {
    const res = await fetch(SCHEDULE_API);
    const schedule = await res.json();
    
    const now = Math.floor(Date.now() / 1000);
    const oneHour = 3600;
    
    let canRequest = true;
    let reason = '';

    for (const entry of schedule) {
      const start = entry.start_timestamp;
      const end = entry.end_timestamp;
      
      // If currently playing
      if (now >= start && now <= end) {
        canRequest = false;
        reason = 'Ett schemalagt program pågår just nu.';
        break;
      }
      
      // If starting within 1 hour
      if (start > now && start - now <= oneHour) {
        canRequest = false;
        reason = 'Ett program börjar snart (inom 1 timme).';
        break;
      }
    }

    isRequestEnabled = canRequest;
    
    if (canRequest) {
      requestBtn.disabled = false;
      requestBtn.title = 'Önska en låt';
      requestBtn.classList.add('active-glow');
    } else {
      disableButton(reason);
    }
  } catch (e) {
    console.error('Failed to fetch schedule', e);
    const failMsg = RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
    disableButton(failMsg);
  }
}

function disableButton(reason) {
  isRequestEnabled = false;
  requestBtn.disabled = true;
  requestBtn.title = reason;
  requestBtn.classList.remove('active-glow');
}

export async function fetchRequestableSongs() {
  try {
    const res = await fetch(REQUESTS_API);
    requestableSongs = await res.json();
    filteredSongs = [...requestableSongs];
    currentPage = 1;
    renderList();
  } catch (e) {
    console.error('Failed to fetch requestable songs', e);
    const failMsg = RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
    requestList.innerHTML = `<div class="text-center text-pink-400 mt-4">${failMsg}</div>`;
  }
}

function renderList() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredSongs.slice(start, end);
  
  requestList.innerHTML = '';
  
  if (pageItems.length === 0) {
    requestList.innerHTML = '<div class="text-center text-cyan-200 mt-4">Inga låtar hittades.</div>';
  } else {
    pageItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'request-item';
      div.innerHTML = `
        <div class="request-item-title">${escapeHtml(item.song.title)}</div>
        <div class="request-item-artist">${escapeHtml(item.song.artist)}</div>
      `;
      div.addEventListener('click', () => submitRequest(item.request_id, item.song));
      requestList.appendChild(div);
    });
  }
  
  const totalPages = Math.ceil(filteredSongs.length / ITEMS_PER_PAGE) || 1;
  requestPageInfo.textContent = `Sida ${currentPage} av ${totalPages}`;
  
  requestPrev.disabled = currentPage === 1;
  requestNext.disabled = currentPage === totalPages;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}

// --- Retry state ---
let retryController = null; // { cancelled: boolean, timer: number|null }

function isRetryEnabled() {
  if (window.__REQUEST_RETRY_ENABLED === false) return false;
  return true;
}

function cancelRetry() {
  if (retryController) {
    retryController.cancelled = true;
    if (retryController.timer) {
      clearTimeout(retryController.timer);
      retryController.timer = null;
    }
    retryController = null;
  }
  hideToast();
  requestModal.classList.remove('retrying');
}

async function startRetryLoop(requestId, song) {
  cancelRetry();

  if (!isRetryEnabled()) {
    const msg = RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
    requestFeedbackText.innerHTML = `
      <div class="text-2xl font-audiowide text-pink-400 mb-2">${pick(ERROR_HEADERS)}</div>
      <div class="text-sm text-cyan-200 font-sans mb-4">${msg}</div>
    `;
    return;
  }

  const state = { cancelled: false, timer: null };
  retryController = state;

  // Tell user we'll retry the request in 3 minutes
  requestFeedbackText.innerHTML = `
    <div class="text-2xl font-audiowide text-pink-400 mb-2">${pick(ERROR_HEADERS)}</div>
    <div class="text-sm text-cyan-200 font-sans">"${escapeHtml(song.title)}" av ${escapeHtml(song.artist)}</div>
    <div class="text-base text-pink-400 font-audiowide mt-4">Försöker skicka önskningen om 3 minuter...</div>
  `;

  // Let user read confirmation, then fade list and show toast
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (state.cancelled) return;

  requestFeedback.classList.add('hidden');
  requestModal.classList.add('retrying');

  showToast(`[1/1] ${pick(RETRY_SARCASM)}`, { onCancel: cancelRetry });

  // Wait 3 minutes for the actual retry
  await new Promise(resolve => {
    if (state.cancelled) return resolve();
    state.timer = setTimeout(resolve, 180000);
  });

  if (state.cancelled) return;

  // Single retry attempt
  try {
    const res = await fetch(`${REQUEST_SUBMIT_API}${requestId}`, { method: 'POST' });
    let data;
    try {
      data = await res.json();
    } catch (_) {
      failRetry();
      return;
    }

    if (res.ok && data.success) {
      retryController = null;
      hideToast();
      requestModal.classList.remove('retrying');
      showToast(pick(SATIRICAL_MESSAGES), { type: 'success', duration: 5000 });
      showRequestSuccess(song);
      return;
    }

    failRetry();
  } catch (e) {
    console.error('Retry network error', e);
    failRetry();
  }
}

function failRetry() {
  retryController = null;
  hideToast();
  requestModal.classList.remove('retrying');

  const msg = RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
  showToast(`Misslyckades! ${msg}`, { type: 'error', duration: 5000 });

  requestFeedback.classList.remove('hidden');
  requestFeedbackText.innerHTML = `
    <div class="text-2xl font-audiowide text-pink-400 mb-2">ÖNSKAN MISSILYCKADES</div>
    <div class="text-sm text-cyan-200 font-sans mb-4">${msg}</div>
  `;

  setTimeout(() => {
    requestFeedback.classList.add('hidden');
    closeModal();
  }, 4000);
}

function showRequestSuccess(song) {
  const queuePos = Math.floor(Math.random() * 4) + 1;
  const queueMsg = `Det ligger ${queuePos} ${queuePos === 1 ? 'låt' : 'låtar'} före i spelkön.`;
  const randomMsg = SATIRICAL_MESSAGES[Math.floor(Math.random() * SATIRICAL_MESSAGES.length)];

  requestFeedback.classList.remove('hidden');
  requestFeedbackText.innerHTML = `
    <div class="text-2xl font-audiowide text-neon-green mb-2">ÖNSKNING SKICKAD!</div>
    <div class="text-lg text-white font-sans mb-4">"${escapeHtml(song.title)}" av ${escapeHtml(song.artist)}</div>
    <div class="text-sm text-pink-400 font-audiowide mb-2">${queueMsg}</div>
    <div class="text-base text-cyan-200 italic mt-4 max-w-md mx-auto">"${randomMsg}"</div>
  `;

  setTimeout(() => {
    requestFeedback.classList.add('hidden');
    closeModal();
  }, 4000);
}

async function submitRequest(requestId, song) {
  // Cancel any active retry (Story 4: new request cancels old)
  cancelRetry();

  requestFeedbackText.textContent = 'Skickar önskan...';
  requestFeedback.classList.remove('hidden');
  
  const queuePos = Math.floor(Math.random() * 4) + 1;
  const queueMsg = `Det ligger ${queuePos} ${queuePos === 1 ? 'låt' : 'låtar'} före i spelkön.`;
  const randomMsg = SATIRICAL_MESSAGES[Math.floor(Math.random() * SATIRICAL_MESSAGES.length)];

  try {
    const res = await fetch(`${REQUEST_SUBMIT_API}${requestId}`, {
      method: 'POST'
    });

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      const msg = RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
      requestFeedbackText.innerHTML = `
        <div class="text-2xl font-audiowide text-pink-400 mb-2">${pick(ERROR_HEADERS)}</div>
        <div class="text-sm text-cyan-200 font-sans mb-4">${msg}</div>
      `;
      return;
    }

    if (res.ok && data.success) {
      requestFeedbackText.innerHTML = `
        <div class="text-2xl font-audiowide text-neon-green mb-2">ÖNSKNING SKICKAD!</div>
        <div class="text-lg text-white font-sans mb-4">"${escapeHtml(song.title)}" av ${escapeHtml(song.artist)}</div>
        <div class="text-sm text-pink-400 font-audiowide mb-2">${queueMsg}</div>
        <div class="text-base text-cyan-200 italic mt-4 max-w-md mx-auto">"${randomMsg}"</div>
      `;
    } else {
      const msg = data.message || '';
      const retryable = /\b(redan|före|hann|beat|already)\b/i.test(msg);

      if (retryable) {
        startRetryLoop(requestId, song);
      } else {
        const errorText = escapeHtml(msg) || RETRY_FAILED[Math.floor(Math.random() * RETRY_FAILED.length)];
        requestFeedbackText.innerHTML = `
          <div class="text-2xl font-audiowide text-pink-400 mb-2">${pick(ERROR_HEADERS)}</div>
          <div class="text-sm text-cyan-200 font-sans mb-4">${errorText}</div>
        `;
      }
    }
  } catch (e) {
    console.error('Submit failed', e);
    // Network/CORS error — retry via toast mechanism rather than failing immediately
    startRetryLoop(requestId, song);
    return;
  }

  // Only auto-close modal if no retry loop was started
  if (!retryController) {
    setTimeout(() => {
      requestFeedback.classList.add('hidden');
      closeModal();
    }, 4000);
  }
}

function openModal() {
  if (!isRequestEnabled) return;
  requestModal.classList.add('visible');
  if (requestableSongs.length === 0) {
    fetchRequestableSongs();
  }
}

function closeModal() {
  requestModal.classList.remove('visible');
}

let searchTimeout;
function handleSearch(e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      filteredSongs = [...requestableSongs];
    } else {
      filteredSongs = requestableSongs.filter(item => 
        (item.song.title && item.song.title.toLowerCase().includes(query)) ||
        (item.song.artist && item.song.artist.toLowerCase().includes(query))
      );
    }
    currentPage = 1;
    renderList();
  }, 300);
}

export function initRequest() {
  if (!isEnabled()) {
    requestBtn.style.display = 'none';
    return;
  }
  
  checkSchedule();
  setInterval(checkSchedule, 60000); // Check every minute
  
  requestBtn.addEventListener('click', openModal);
  requestClose.addEventListener('click', closeModal);
  
  requestModal.addEventListener('click', (e) => {
    if (e.target === requestModal || e.target.classList.contains('request-modal-bg')) {
      closeModal();
    }
  });
  
  requestSearch.addEventListener('input', handleSearch);
  
  requestPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderList();
    }
  });
  
  requestNext.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredSongs.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderList();
    }
  });
}
