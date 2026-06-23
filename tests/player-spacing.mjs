// E2E test: player element spacing/margins are correct
// Usage: node tests/player-spacing.mjs                         (local dist/)
//        TEST_URL=https://tjenamors.se node tests/player-spacing.mjs  (production)
import puppeteer from 'puppeteer';

const useProduction = process.env.TEST_URL;
let server = null;
let url = process.env.TEST_URL;

if (!url) {
  const { serve } = await import('./serve.mjs');
  const s = await serve();
  server = s.server;
  url = s.url;
}

let failures = 0;
let passed = 0;

function check(name, ok) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}`); }
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Wait for player to become visible
await page.waitForSelector('.player.visible', { timeout: 10000 }).catch(() => {});

const getStyle = (sel, prop) =>
  page.evaluate((s, p) => {
    const el = document.querySelector(s);
    return el ? parseFloat(getComputedStyle(el)[p]) : null;
  }, sel, prop);

const getGap = (sel) => getStyle(sel, 'gap');

console.log('\n--- Player element spacing ---\n');

const playerGap = await getGap('.player');
check('Player has gap', playerGap > 0);

const contentMt = await getStyle('.player-content', 'marginTop');
check('Player content has top margin', contentMt > 0);

const contentGap = await getGap('.player-content');
check('Player content has gap', contentGap > 0);

const artistMt = await getStyle('#artist', 'marginTop');
check('Artist has top margin', artistMt > 0);

const controlsGap = await getGap('.controls');
check('Controls have gap', controlsGap > 0);

const timelineMt = await getStyle('.timeline-wrap', 'marginTop');
check('Timeline has top margin', timelineMt > 0);

const fontFamily = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.info-text')).fontFamily.toLowerCase()
);
check('Info text uses Audiowide', fontFamily.includes('audiowide'));

const timeColor = await page.evaluate(() =>
  getComputedStyle(document.querySelector('#time')).color
);
check('Time has color styling', timeColor !== 'rgba(0, 0, 0, 0)');

const songFontSize = await getStyle('#song-text', 'fontSize');
check('Song text has font-size', songFontSize > 8);

const discW = await getStyle('#disc', 'width');
check('Disc has width', discW > 0);

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
await browser.close();
if (server) server.close();
process.exit(failures ? 1 : 0);
