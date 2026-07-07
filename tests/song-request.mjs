// E2E tests: Song request button, modal, search, pagination, submission, error handling, retry.
//
// Run: node tests/song-request.mjs

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';
import { SATIRICAL_MESSAGES, RETRY_SARCASM, RETRY_FAILED } from '../src/js/satirical-messages.js';

const { server, url } = await serve();
let failures = 0;
let passed = 0;
let tests = 0;

async function check(label, condition, detail) {
  tests++;
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 ${detail}`);
    failures++;
  }
}

/**
 * Create a new page with a request interceptor for the given mock config.
 * @param {puppeteer.Browser} browser
 * @param {object} mock - Mock configuration
 * @param {number} mock.requestStatus - HTTP status for /request/ endpoint
 * @param {object|null} mock.requestBody - JSON body for /request/ endpoint (null = non-JSON)
 * @param {'success'|'retryable'|'non-retryable'|'non-json'} mock.scenario
 */
async function createPage(browser, mock = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
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
        status: 200, headers, contentType: 'application/json',
        body: JSON.stringify({
          is_online: true,
          now_playing: { song: { id: '1', text: 'Test Song', title: 'Test', artist: 'Song' },
            elapsed: 10, duration: 100 },
          playing_next: null, song_history: []
        })
      });
    } else if (reqUrl.includes('/api/station/1/schedule')) {
      req.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (reqUrl.includes('/api/station/1/requests')) {
      const songs = Array.from({ length: 25 }, (_, i) => ({
        request_id: `req-${i}`,
        song: { id: `song-${i}`, text: `Song ${i} - Artist ${i}`, title: `Song ${i}`, artist: `Artist ${i}` }
      }));
      req.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(songs) });
    } else if (reqUrl.includes('/api/station/1/request/')) {
      const scenario = mock.scenario || 'success';
      if (scenario === 'retryable') {
        req.respond({
          status: 500, headers, contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Någon hann före dig. Försök igen.' })
        });
      } else if (scenario === 'non-retryable') {
        req.respond({
          status: 500, headers, contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Internal server error.' })
        });
      } else if (scenario === 'non-json') {
        req.respond({ status: 500, headers, contentType: 'text/plain', body: 'Internal Server Error' });
      } else {
        req.respond({
          status: 200, headers, contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Din smak är omtvistad men önskan är skickad \ud83e\udd18' })
        });
      }
    } else {
      req.continue();
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => {
    const btn = document.getElementById('request-btn');
    return btn && !btn.disabled;
  }, { timeout: 5000 }).catch(() => {});

  return page;
}

async function openModalAndClickFirstSong(page) {
  await page.evaluate(() => document.getElementById('request-btn').click());
  await page.waitForSelector('#request-modal.visible', { timeout: 5000 });
  await page.waitForSelector('.request-item', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.request-item').click());
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });

  // =====================================================
  // 1. Existing: Success flow
  // =====================================================
  console.log('\n--- Success flow ---');
  const successPage = await createPage(browser, { scenario: 'success' });
  await openModalAndClickFirstSong(successPage);
  await successPage.waitForSelector('#request-feedback:not(.hidden)', { timeout: 5000 });
  const feedbackText = await successPage.evaluate(() =>
    document.getElementById('request-feedback').textContent
  );
  const showsSuccess = feedbackText.includes('ÖNSKNING SKICKAD');
  const hasSatiricalMessage = SATIRICAL_MESSAGES.some(msg => feedbackText.includes(msg));
  check('Shows success feedback on 200', showsSuccess && hasSatiricalMessage, `got "${feedbackText}"`);
  await successPage.close();

  // =====================================================
  // 2. Retryable 500 → toast shows
  // =====================================================
  console.log('\n--- Retryable error (500 + "hann före") ---');
  const retryPage = await createPage(browser, { scenario: 'retryable' });
  // Disable retry wait (12s delay) by disabling retry feature — we just want to see the initial
  // behaviour: if retry is disabled, it falls back to showing error immediately.
  // Then test with retry enabled to verify toast.
  await retryPage.evaluate(() => { window.__REQUEST_RETRY_ENABLED = false; });
  await openModalAndClickFirstSong(retryPage);
  // Wait for modal feedback
  await retryPage.waitForSelector('#request-feedback:not(.hidden)', { timeout: 5000 }).catch(() => {});
  await retryPage.evaluate(() => new Promise(r => setTimeout(r, 500)));
  const errorText = await retryPage.evaluate(() =>
    document.getElementById('request-feedback').textContent
  );
  const showsError = errorText.includes('NÅGOT GICK FEL');
  const hasRetryFailedMsg = RETRY_FAILED.some(msg => errorText.includes(msg));
  check('Shows error when retry disabled', showsError, `got "${errorText}"`);
  check('Shows a RETRY_FAILED message when retry disabled', hasRetryFailedMsg, `got "${errorText}"`);
  await retryPage.close();

  // Enable retry and test that toast appears
  console.log('\n--- Retry starts → toast visible ---');
  const toastPage = await createPage(browser, { scenario: 'retryable' });
  await toastPage.evaluate(() => { window.__REQUEST_RETRY_ENABLED = true; });
  await openModalAndClickFirstSong(toastPage);
  // Wait for toast to appear
  await toastPage.waitForSelector('#request-toast.visible', { timeout: 5000 }).catch(() => {});
  await toastPage.evaluate(() => new Promise(r => setTimeout(r, 300)));
  const toastVisible = await toastPage.evaluate(() =>
    document.getElementById('request-toast').classList.contains('visible')
  );
  check('Toast becomes visible on retryable error', toastVisible, 'toast not visible');

  // Check toast has cancel button
  const hasCancelBtn = await toastPage.$('#request-toast-cancel');
  check('Toast has cancel button', !!hasCancelBtn, 'cancel button not found');

  // Check toast shows retry counter
  const toastText = await toastPage.evaluate(() =>
    document.getElementById('request-toast-text').textContent
  );
  const hasRetryCounter = /\[\d\/5\]/.test(toastText);
  const hasRetrySarcasm = RETRY_SARCASM.some(msg => toastText.includes(msg));
  check('Toast shows retry counter [1/5]', hasRetryCounter, `got "${toastText}"`);
  check('Toast shows retry sarcasm message', hasRetrySarcasm, `got "${toastText}"`);

  // Test cancel button
  await toastPage.evaluate(() => document.getElementById('request-toast-cancel').click());
  await toastPage.evaluate(() => new Promise(r => setTimeout(r, 300)));
  const toastHidden = await toastPage.evaluate(() =>
    !document.getElementById('request-toast').classList.contains('visible')
  );
  check('Toast hides after cancel click', toastHidden, 'toast still visible');

  await toastPage.close();

  // =====================================================
  // 3. Non-retryable 500 → shows error in modal
  // =====================================================
  console.log('\n--- Non-retryable error (500 + "Internal server error") ---');
  const nonRetryPage = await createPage(browser, { scenario: 'non-retryable' });
  await openModalAndClickFirstSong(nonRetryPage);
  await nonRetryPage.waitForSelector('#request-feedback:not(.hidden)', { timeout: 5000 }).catch(() => {});
  await nonRetryPage.evaluate(() => new Promise(r => setTimeout(r, 500)));
  const nonRetryText = await nonRetryPage.evaluate(() =>
    document.getElementById('request-feedback').textContent
  );
  check('Shows "NÅGOT GICK FEL" for non-retryable 500',
    nonRetryText.includes('NÅGOT GICK FEL'), `got "${nonRetryText}"`);
  check('Shows server error message',
    nonRetryText.includes('Internal server error'), `got "${nonRetryText}"`);
  await nonRetryPage.close();

  // =====================================================
  // 4. Non-JSON 500 → shows generic error
  // =====================================================
  console.log('\n--- Non-JSON 500 response ---');
  const nonJsonPage = await createPage(browser, { scenario: 'non-json' });
  await openModalAndClickFirstSong(nonJsonPage);
  await nonJsonPage.waitForSelector('#request-feedback:not(.hidden)', { timeout: 5000 }).catch(() => {});
  await nonJsonPage.evaluate(() => new Promise(r => setTimeout(r, 500)));
  const nonJsonText = await nonJsonPage.evaluate(() =>
    document.getElementById('request-feedback').textContent
  );
  check('Shows "NÅGOT GICK FEL" for non-JSON 500', nonJsonText.includes('NÅGOT GICK FEL'), `got "${nonJsonText}"`);
  check('Shows fallback message', nonJsonText.includes('Radioveteranerna'), `got "${nonJsonText}"`);
  await nonJsonPage.close();

  // =====================================================
  // 5. Toast HTML element exists
  // =====================================================
  console.log('\n--- Toast element existence ---');
  const basicPage = await createPage(browser, { scenario: 'success' });
  const toastEl = await basicPage.$('#request-toast');
  const toastTextEl = await basicPage.$('#request-toast-text');
  const toastCancelEl = await basicPage.$('#request-toast-cancel');
  check('#request-toast element exists', !!toastEl, 'not found');
  check('#request-toast-text element exists', !!toastTextEl, 'not found');
  check('#request-toast-cancel element exists', !!toastCancelEl, 'not found');
  await basicPage.close();

  // =====================================================
  // Cleanup
  // =====================================================
  await browser.close();
  server.close();

  console.log(`\n===== Results: ${passed}/${tests} passed, ${failures} failed =====\n`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
