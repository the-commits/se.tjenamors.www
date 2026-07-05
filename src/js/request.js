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

const SCHEDULE_API = 'https://radio.tjenamors.se/api/station/1/schedule';
const REQUESTS_API = 'https://radio.tjenamors.se/api/station/1/requests';
const REQUEST_SUBMIT_API = 'https://radio.tjenamors.se/api/station/1/request/';

const SATIRICAL_MESSAGES = [
  'Din smak är omtvistad men önskan är skickad 🤘',
  'Okej, vi spelar den. Men om lyssnarna flyr är det ditt fel.',
  'Mottaget! Våra radioveteraner gråter i fikarummet nu.',
  'Önskningen är registrerad. Servern gjorde en liten spya men överlevde.',
  'Bra val! Eller ja, acceptabelt i alla fall.',
  'Låten är tillagd i kön. Vi har låst in DJ:n tills den spelats.',
  'Din önskan har mottagits. Vi lovar att inte spela den baklänges.',
  'Snyggt! Äntligen någon som inte önskar samma jävla poplåt.',
  'Mottaget. Vi kör den så fort vi har druckit upp ölen.',
  'Önskningen är skickad. Vår algoritm gav den 2 av 5 arga gubbar.',
  'Okej då, den är i kön. Men vi kommer att titta snett på dig.',
  'Mottaget! Vi rensar öronen med lite punk nu.',
  'Din önskan är registrerad. Vår katt godkände låtvalet.',
  'Låten är i kön. Vi ber om ursäkt till grannarna i förväg.',
  'Mottaget! Vi spelar den högt så att tapeterna lossnar.',
  'Önskningen mottagen. Vi har lagt den överst... i papperskorgen? Nej, skoja bara.',
  'Bra skit! Den här låten botar allt utom dålig musiksmak.',
  'Mottaget. Vi spelar den så fort trummisen har hittat sina pinnar.',
  'Din önskan är skickad. Vår jurist undersöker om låten är laglig.',
  'Okej, den är i kön. Men du är skyldig oss en kall öl.'
];

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
    // Fallback for local testing if CORS blocks it
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('Localhost detected: enabling mock request mode');
      isRequestEnabled = true;
      requestBtn.disabled = false;
      requestBtn.title = 'Önska en låt (Mock-läge)';
      requestBtn.classList.add('active-glow');
    } else {
      disableButton('Kunde inte hämta schema');
    }
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
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('Localhost detected: loading mock songs');
      requestableSongs = Array.from({ length: 45 }, (_, i) => ({
        request_id: `mock-${i}`,
        song: {
          id: `mock-song-${i}`,
          title: `Synthwave Track ${i + 1}`,
          artist: `Neon Artist ${String.fromCharCode(65 + (i % 6))}`
        }
      }));
      filteredSongs = [...requestableSongs];
      currentPage = 1;
      renderList();
    } else {
      requestList.innerHTML = '<div class="text-center text-pink-400 mt-4">Kunde inte ladda låtlistan.</div>';
    }
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

async function submitRequest(requestId, song) {
  requestFeedbackText.textContent = 'Skickar önskan...';
  requestFeedback.classList.remove('hidden');
  
  const queuePos = Math.floor(Math.random() * 4) + 1;
  const queueMsg = `Det ligger ${queuePos} ${queuePos === 1 ? 'låt' : 'låtar'} före i spelkön.`;
  const randomMsg = SATIRICAL_MESSAGES[Math.floor(Math.random() * SATIRICAL_MESSAGES.length)];

  try {
    if (requestId.startsWith('mock-')) {
      // Simulate network delay for mock requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      requestFeedbackText.innerHTML = `
        <div class="text-2xl font-audiowide text-neon-green mb-2">ÖNSKNING SKICKAD!</div>
        <div class="text-lg text-white font-sans mb-4">"${escapeHtml(song.title)}" av ${escapeHtml(song.artist)}</div>
        <div class="text-sm text-pink-400 font-audiowide mb-2">${queueMsg}</div>
        <div class="text-base text-cyan-200 italic mt-4 max-w-md mx-auto">"${randomMsg}"</div>
      `;
    } else {
      const res = await fetch(`${REQUEST_SUBMIT_API}${requestId}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        requestFeedbackText.innerHTML = `
          <div class="text-2xl font-audiowide text-neon-green mb-2">ÖNSKNING SKICKAD!</div>
          <div class="text-lg text-white font-sans mb-4">"${escapeHtml(song.title)}" av ${escapeHtml(song.artist)}</div>
          <div class="text-sm text-pink-400 font-audiowide mb-2">${queueMsg}</div>
          <div class="text-base text-cyan-200 italic mt-4 max-w-md mx-auto">"${randomMsg}"</div>
        `;
      } else {
        requestFeedbackText.innerHTML = `
          <div class="text-2xl font-audiowide text-pink-400 mb-2">NÅGOT GICK FEL</div>
          <div class="text-sm text-cyan-200 font-sans mb-4">
            ${data.message || 'Radioveteranerna röstade nej. Försök igen om en stund.'}
          </div>
        `;
      }
    }
  } catch (e) {
    console.error('Submit failed', e);
    requestFeedbackText.innerHTML = `
      <div class="text-2xl font-audiowide text-pink-400 mb-2">NÄTVERKSFEL</div>
      <div class="text-sm text-cyan-200 font-sans">Kunde inte nå servern. Försök igen.</div>
    `;
  }
  
  setTimeout(() => {
    requestFeedback.classList.add('hidden');
    closeModal();
  }, 4000);
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
