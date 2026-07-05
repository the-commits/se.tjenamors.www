import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();

const VIEWPORTS = [
  { name: 'xxs (128x128)',            w: 128,  h: 128  },
  { name: 'xs mobile (375x667)',      w: 375,  h: 667  },
  { name: 'sm tablet (640x800)',       w: 640,  h: 800  },
  { name: 'md iPad (768x1024)',       w: 768,  h: 1024 },
  { name: 'lg laptop (1024x768)',     w: 1024, h: 768  },
  { name: 'xl desktop (1280x800)',    w: 1280, h: 800  },
  { name: 'landscape (667x375)',      w: 667,  h: 375  },
];

const TOLERANCE = 0.10;

let failures = 0;
let passed = 0;

async function getBoundingBox(page, selector) {
  try {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
    }, selector);
  } catch {
    return null;
  }
}

async function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — ${detail}`);
    failures++;
  }
}

async function runViewport(browser, vp) {
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    // Wait for player to render
    await page.waitForSelector('.player', { timeout: 5000 }).catch(() => {});
    // Settle
    await new Promise(r => setTimeout(r, 1200));

    const sun = await getBoundingBox(page, '.sun');
    const player = await getBoundingBox(page, '.player');
    const disc = await getBoundingBox(page, '#disc');

    if (!sun || !player || !disc) {
      console.error(`  ✗ Missing elements on ${vp.name}`);
      failures++;
      return;
    }

    const sunCx = sun.left + sun.width / 2;
    const playerCx = player.left + player.width / 2;
    const vpCx = vp.w / 2;

    console.log(`\n--- ${vp.name} (${vp.w}×${vp.h}) ---`);

    const cxTol = vp.w * TOLERANCE;
    await check('Sun horizontally centered', Math.abs(sunCx - vpCx) < cxTol, `dx=${(sunCx - vpCx).toFixed(1)}px`);
    const pDx = (playerCx - vpCx).toFixed(1);
    await check('Player horizontally centered', Math.abs(playerCx - vpCx) < cxTol, `dx=${pDx}px`);

    await check('Sun near top (top ≤ 30%)', sun.top <= vp.h * 0.3, `sun.top=${sun.top.toFixed(0)}px`);
    await check('Player starts near top', player.top <= vp.h * 0.4, `player.top=${player.top.toFixed(0)}px`);

    const pBot = player.bottom.toFixed(0);
    if (vp.name !== 'landscape (667x375)') {
      await check('Player fully visible', player.bottom <= vp.h + 1, `bottom=${pBot}px vs height=${vp.h}px`);
    }

    if (vp.w < 640) {
      await check(`Sun width ≤ 85% viewport (${vp.w}px)`, sun.width <= vp.w * 0.85, `${sun.width.toFixed(0)}px`);
      await check(`Disc width ≤ 75% viewport (${vp.w}px)`, disc.width <= vp.w * 0.75, `${disc.width.toFixed(0)}px`);
    }

    await check('Player card width ≤ 97% viewport', player.width <= vp.w * 0.97 + 1, `${player.width.toFixed(0)}px`);
  } catch (err) {
    console.error(`  ! Error on ${vp.name}: ${err.message}`);
    failures++;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore close errors */ }
    }
  }
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    await runViewport(browser, vp);
  }

  await browser.close().catch(() => {});
  server.close();

  console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test error:', err.message);
  process.exit(1);
});
