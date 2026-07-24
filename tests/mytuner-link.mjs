import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();

let failures = 0;
let passed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — ${detail}`);
    failures++;
  }
}

const browser = await puppeteer.launch({ headless: true });

try {
  const page = await browser.newPage();

  // Watch for any third-party requests to myTuner domains (privacy check).
  const thirdPartyRequests = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host.includes('mytuner')) thirdPartyRequests.push(req.url());
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Test element attributes
  console.log('\n--- Checking myTuner Radio Link ---');
  const linkInfo = await page.evaluate(() => {
    const el = document.querySelector('#bottom-left-links a[href^="https://mytuner-radio.com"]');
    if (!el) return null;
    return {
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      text: el.textContent.trim(),
      classes: [...el.classList],
      imgCount: el.querySelectorAll('img').length,
    };
  });

  check('myTuner link exists in #bottom-left-links', linkInfo !== null);
  check(
    'myTuner links to correct URL',
    linkInfo?.href === 'https://mytuner-radio.com/',
    linkInfo?.href
  );
  check('myTuner target is _blank', linkInfo?.target === '_blank');
  check('myTuner rel includes nofollow', linkInfo?.rel?.includes('nofollow'));
  check('myTuner rel includes noopener', linkInfo?.rel?.includes('noopener'));
  check('myTuner text is correct', linkInfo?.text === 'myTuner Radio', linkInfo?.text);
  check(
    'myTuner uses shared radio-link styling',
    linkInfo?.classes.includes('radio-link'),
    linkInfo?.classes.join(' ')
  );
  check('myTuner link is text-only (no images)', linkInfo?.imgCount === 0);

  // Test horizontal ordering: myTuner sits right of the punk link, same row
  console.log('\n--- Checking Link Ordering ---');
  const positions = await page.evaluate(() => {
    const links = [...document.querySelectorAll('#bottom-left-links a')];
    const punk = links.find((a) => a.textContent.trim() === 'Punk Radio Stations');
    const mytuner = links.find((a) => a.textContent.trim() === 'myTuner Radio');
    if (!punk || !mytuner) return null;
    const p = punk.getBoundingClientRect();
    const m = mytuner.getBoundingClientRect();
    return {
      punkRight: p.right,
      mytunerLeft: m.left,
      punkTop: p.top,
      mytunerTop: m.top,
    };
  });

  check('Both links found for ordering', positions !== null);
  check(
    'myTuner is right of Punk Radio link',
    positions && positions.mytunerLeft >= positions.punkRight,
    `punk right: ${positions?.punkRight}, mytuner left: ${positions?.mytunerLeft}`
  );
  check(
    'Both links on the same row',
    positions && Math.abs(positions.mytunerTop - positions.punkTop) < 1,
    `punk top: ${positions?.punkTop}, mytuner top: ${positions?.mytunerTop}`
  );

  // Test computed style parity with the punk link
  console.log('\n--- Checking Style Parity ---');
  const styleParity = await page.evaluate(() => {
    const links = [...document.querySelectorAll('#bottom-left-links a')];
    const punk = links.find((a) => a.textContent.trim() === 'Punk Radio Stations');
    const mytuner = links.find((a) => a.textContent.trim() === 'myTuner Radio');
    if (!punk || !mytuner) return null;
    const p = window.getComputedStyle(punk);
    const m = window.getComputedStyle(mytuner);
    return {
      fontFamily: p.fontFamily === m.fontFamily,
      fontSize: p.fontSize === m.fontSize,
      borderRadius: p.borderRadius === m.borderRadius,
      borderStyle: p.borderStyle === m.borderStyle,
    };
  });

  check('Font family matches punk link', styleParity?.fontFamily === true);
  check('Font size matches punk link', styleParity?.fontSize === true);
  check('Border radius matches punk link', styleParity?.borderRadius === true);
  check('Border style matches punk link', styleParity?.borderStyle === true);

  // Privacy: badge must be a plain text link — no requests to myTuner domains
  console.log('\n--- Checking Privacy (no third-party requests) ---');
  await new Promise((r) => setTimeout(r, 500));
  check(
    'No requests to myTuner domains on page load',
    thirdPartyRequests.length === 0,
    thirdPartyRequests.join(', ')
  );
} catch (err) {
  console.error(`Unexpected error: ${err.message}`);
  failures++;
} finally {
  await browser.close();
  server.close();
}

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
process.exit(failures ? 1 : 0);
