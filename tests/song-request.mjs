// E2E tests: Song request button, modal, search, pagination, and submission.

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';
import { SATIRICAL_MESSAGES } from '../src/js/satirical-messages.js';

const { server, url } = await serve();
let failures = 0;
let passed = 0;

async function check(label, condition, detail) {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 ${detail}`);
    failures++;
  }
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  // Mock the API responses
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const reqUrl = req.url();
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method() === 'OPTIONS') {
      req.respond({ status: 200, headers });
      return;
    }

    if (reqUrl.includes('/api/nowplaying/1')) {
      req.respond({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          is_online: true,
          now_playing: {
            song: { id: '1', text: 'Test Song', title: 'Test', artist: 'Song' },
            elapsed: 10,
            duration: 100
          },
          playing_next: null,
          song_history: []
        })
      });
    } else if (reqUrl.includes('/api/station/1/schedule')) {
      // Mock schedule: no upcoming schedule within 1 hour
      req.respond({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    } else if (reqUrl.includes('/api/station/1/requests')) {
      // Mock requestable songs
      const songs = Array.from({ length: 25 }, (_, i) => ({
        request_id: `req-${i}`,
        song: {
          id: `song-${i}`,
          text: `Song ${i} - Artist ${i}`,
          title: `Song ${i}`,
          artist: `Artist ${i}`
        }
      }));
      req.respond({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(songs)
      });
    } else if (reqUrl.includes('/api/station/1/request/')) {
      // Mock request submission
      req.respond({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Din smak är omtvistad men önskan är skickad \ud83e\udd18'
        })
      });
    } else {
      req.continue();
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // --- Button existence and state ---
  console.log('\n--- Button existence and state ---');
  await page.waitForSelector('#request-btn', { timeout: 5000 });
  
  const btnExists = await page.$('#request-btn');
  check('Request button exists', !!btnExists, '#request-btn not found');

  // Wait for schedule to be fetched and button to be enabled
  await page.waitForFunction(() => {
    const btn = document.getElementById('request-btn');
    return btn && !btn.disabled;
  }, { timeout: 5000 }).catch(() => {});

  const btnDisabled = await page.evaluate(() => document.getElementById('request-btn').disabled);
  check('Request button is enabled (no schedule conflict)', !btnDisabled, 'button is disabled');

  // --- Modal opening ---
  console.log('\n--- Modal opening ---');
  await page.evaluate(() => document.getElementById('request-btn').click());
  await page.waitForSelector('#request-modal.visible', { timeout: 5000 });
  
  const modalVisible = await page.evaluate(() => 
    document.getElementById('request-modal').classList.contains('visible')
  );
  check('Modal becomes visible on click', modalVisible, 'modal not visible');

  // --- Song list and pagination ---
  console.log('\n--- Song list and pagination ---');
  await page.waitForSelector('.request-item', { timeout: 5000 });
  
  const itemsCount = await page.evaluate(() => document.querySelectorAll('.request-item').length);
  check('Shows 20 items on first page', itemsCount === 20, `got ${itemsCount} items`);

  const hasNextBtn = await page.$('#request-next');
  check('Next page button exists', !!hasNextBtn, '#request-next not found');
  
  await page.evaluate(() => document.getElementById('request-next').click());
  // Wait for render
  await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
  
  const itemsCountPage2 = await page.evaluate(() => document.querySelectorAll('.request-item').length);
  check('Shows 5 items on second page', itemsCountPage2 === 5, `got ${itemsCountPage2} items`);

  // --- Search ---
  console.log('\n--- Search ---');
  await page.type('#request-search', 'Song 10');
  // Wait for debounce (300ms) + render
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  
  const searchItemsCount = await page.evaluate(() => document.querySelectorAll('.request-item').length);
  check('Search filters items', searchItemsCount === 1, `got ${searchItemsCount} items`);

  // --- Submission ---
  console.log('\n--- Submission ---');
  await page.evaluate(() => document.querySelector('.request-item').click());
  
  await page.waitForSelector('#request-feedback:not(.hidden)', { timeout: 5000 });
  const feedbackText = await page.evaluate(() => document.getElementById('request-feedback').textContent);
  const showsSuccess = feedbackText.includes('ÖNSKNING SKICKAD');
  const hasSatiricalMessage = SATIRICAL_MESSAGES.some(msg => feedbackText.includes(msg));
  check('Shows success feedback', showsSuccess && hasSatiricalMessage, `got "${feedbackText}"`);

  await browser.close();
  server.close();

  console.log(`\n===== Results: ${passed} passed, ${failures} failed =====\n`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
