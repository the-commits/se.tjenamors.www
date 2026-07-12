import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();
const browser = await puppeteer.launch({ headless: true });

const VIEWPORTS = [
  { name: '4K UHD',            w: 3840, h: 2160, expectPx: 24 },
  { name: '1080p Full HD',     w: 1920, h: 1080, expectPx: 16 },
  { name: '1440p',             w: 2560, h: 1440, expectPx: 16 },
  { name: '5K',                w: 5120, h: 2880, expectPx: 32 },
  { name: 'iPhone SE (mobile)', w: 375, h: 667,  expectPx: null },
];

console.log('=== Font-size scaling verification ===\n');
let passed = 0;
let failed = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));

  const fontSize = await page.evaluate(() => {
    const el = document.querySelector('.h-screen');
    return parseFloat(getComputedStyle(el).fontSize);
  });

  await page.close();

  const detail = `font-size = ${fontSize.toFixed(1)}px`;

  if (vp.expectPx === null) {
    if (fontSize < 16) {
      console.log(`  \u2713 ${vp.name} (${vp.w}x${vp.h}): ${detail} — vmin-constrained (mobile)`);
      passed++;
    } else {
      console.log(`  \u2717 ${vp.name}: ${detail} — expected <16px for mobile`);
      failed++;
    }
  } else {
    const tolerance = 2;
    if (Math.abs(fontSize - vp.expectPx) <= tolerance) {
      console.log(`  \u2713 ${vp.name} (${vp.w}x${vp.h}): ${detail} — target ~${vp.expectPx}px`);
      passed++;
    } else {
      console.log(`  \u2717 ${vp.name}: ${detail} — expected approx ${vp.expectPx}px`);
      failed++;
    }
  }
}

await browser.close();
server.close();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
