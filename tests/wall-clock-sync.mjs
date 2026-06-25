// E2E test: verify mediaToWallOffset is computed from segment filenames
// and that song info wall clock matches the audio position (not ahead of it).
//
// Tests:
// 1. window.__mediaToWallOffset is non-zero after HLS loads a fragment
// 2. userWallClock (audio.currentTime + offset) is behind real-time (not ahead)
// 3. goLive() seeks near the true edge (within 10s), not 60s behind
// 4. isAtLive() returns true after goLive()
//
// Usage: node tests/wall-clock-sync.mjs
//        TEST_URL=https://tjenamors.se node tests/wall-clock-sync.mjs

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';
import { waitFor } from './helpers/network.mjs';

const { server, url } = await serve();
const TEST_URL = process.env.TEST_URL || url;

let failures = 0;
let passed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  \u2713 ${name}`); }
  else { failures++; console.error(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.error('  page error:', err.message));
page.on('dialog', (dialog) => dialog.dismiss());

await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.waitForSelector('.player', { timeout: 30000 }).catch(() => {});

// Wait for HLS to load at least one fragment (offset gets computed)
console.log('\n--- Waiting for HLS fragment to load ---');

const offset = await waitFor(page, async () => {
  return page.evaluate(() => {
    const v = window.__mediaToWallOffset;
    return (typeof v === 'number' && v !== 0) ? v : null;
  });
}, 60000, 2000);

check('mediaToWallOffset is non-zero after HLS loads', offset !== null, 'offset stayed 0');

if (offset) {
  console.log(`  offset = ${offset} (${new Date(offset * 1000).toISOString()})`);

  // Verify: userWallClock should be behind real-time (HLS has latency)
  const state = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    const offset = window.__mediaToWallOffset;
    const userWallClock = audio.currentTime + offset;
    const realTime = Date.now() / 1000;
    return {
      userWallClock,
      realTime,
      diff: realTime - userWallClock,
      currentTime: audio.currentTime,
      seekableEnd: audio.seekable.length
        ? audio.seekable.end(audio.seekable.length - 1) : 0,
    };
  });

  console.log(`  userWallClock = ${state.userWallClock.toFixed(1)}`);
  console.log(`  realTime     = ${state.realTime.toFixed(1)}`);
  console.log(`  diff (real - user) = ${state.diff.toFixed(1)}s`);

  // HLS should be behind real-time (positive diff). If diff is negative,
  // song info would be AHEAD of audio — the bug we're fixing.
  check('userWallClock is behind real-time (not ahead)', state.diff > 0,
    `diff is ${state.diff.toFixed(1)}s — song info would be ahead of audio`);

  // Diff should be reasonable: 3s to 120s (HLS latency + buffer)
  check('HLS latency is within reasonable range (3-120s)',
    state.diff >= 3 && state.diff <= 120,
    `diff is ${state.diff.toFixed(1)}s`);
}

// Test goLive() seeks near the edge
console.log('\n--- Testing goLive() ---');

// Click the live button
await page.evaluate(() => {
  const btn = document.getElementById('live-btn');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 2000));

const liveState = await page.evaluate(() => {
  const audio = document.querySelector('audio');
  const hls = window.__hls;
  const seekableEnd = audio.seekable.length
    ? audio.seekable.end(audio.seekable.length - 1) : 0;
  return {
    currentTime: audio.currentTime,
    seekableEnd,
    distFromEdge: seekableEnd - audio.currentTime,
    liveSyncPosition: hls?.liveSyncPosition || null,
  };
});

console.log(`  currentTime    = ${liveState.currentTime.toFixed(1)}`);
console.log(`  seekableEnd    = ${liveState.seekableEnd.toFixed(1)}`);
console.log(`  distFromEdge   = ${liveState.distFromEdge.toFixed(1)}s`);
console.log(`  liveSyncPos    = ${liveState.liveSyncPosition?.toFixed(1) || 'null'}`);

// After goLive(), user should be within 10s of the true edge (not 30-60s)
check('goLive() seeks within 10s of true edge', liveState.distFromEdge <= 10,
  `distance from edge is ${liveState.distFromEdge.toFixed(1)}s`);

// goLive() should NOT seek to liveSyncPosition (which is 30s from edge)
if (liveState.liveSyncPosition) {
  const distFromSyncPos = Math.abs(liveState.currentTime - liveState.liveSyncPosition);
  check('goLive() does not seek to liveSyncPosition (30s from edge)',
    distFromSyncPos > 5,
    `only ${distFromSyncPos.toFixed(1)}s from liveSyncPosition`);
}

// isAtLive() should return true after goLive()
const isLive = await page.evaluate(() => {
  // Read the live button class — 'live' class is toggled by isAtLive()
  const btn = document.getElementById('live-btn');
  return btn?.classList.contains('live') || false;
});
check('Live button shows active after goLive()', isLive, 'live class not set');

// Verify song info is not ahead of audio
console.log('\n--- Verifying song info timing ---');

const songTiming = await page.evaluate(() => {
  const audio = document.querySelector('audio');
  const offset = window.__mediaToWallOffset || 0;
  const userWallClock = audio.currentTime + offset;
  const realTime = Date.now() / 1000;

  // Get the API's now_playing data for comparison
  const songText = document.getElementById('song-text')?.textContent || '';
  const timeLabel = document.getElementById('time')?.textContent || '';

  return {
    userWallClock,
    realTime,
    diff: realTime - userWallClock,
    songText,
    timeLabel,
  };
});

console.log(`  Song: "${songTiming.songText}"`);
console.log(`  Time label: "${songTiming.timeLabel}"`);
console.log(`  userWallClock vs realTime diff: ${songTiming.diff.toFixed(1)}s`);

// The key assertion: song info should match the audio position, not be ahead
check('Song info wall clock is behind real-time (matches audio)',
  songTiming.diff > 0,
  `diff is ${songTiming.diff.toFixed(1)}s — song info is ahead of audio`);

await browser.close();
server.close();

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
process.exit(failures ? 1 : 0);