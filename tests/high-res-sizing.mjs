import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();
const browser = await puppeteer.launch({ headless: true });

const TESTS = [
  { name: '1080p reference', w: 1920, h: 1080 },
  { name: '4K UHD',          w: 3840, h: 2160 },
  { name: '5K',              w: 5120, h: 2880 },
];

console.log('=== Element sizing verification at high resolutions ===\n');
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.log(`  \u2717 ${label} — ${detail}`);
    failed++;
  }
}

for (const t of TESTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: t.w, height: t.h });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));

  const sizes = await page.evaluate(() => {
    const root = getComputedStyle(document.querySelector('.h-screen'));
    const sun = document.querySelector('.sun')?.getBoundingClientRect();
    const player = document.querySelector('.player')?.getBoundingClientRect();
    const disc = document.querySelector('#disc')?.getBoundingClientRect();
    const info = document.querySelector('.info-text')?.getBoundingClientRect();
    const controls = document.querySelector('.controls')?.getBoundingClientRect();
    const timeline = document.querySelector('.timeline-row')?.getBoundingClientRect();
    const volume = document.querySelector('.volume-control')?.getBoundingClientRect();
    const gridContainer = document.querySelector('.grid-container')?.getBoundingClientRect();

    return {
      fontSize: parseFloat(root.fontSize),
      sun: sun ? { w: sun.width, h: sun.height, top: sun.top, bottom: sun.bottom } : null,
      player: player ? { w: player.width, h: player.height, top: player.top, bottom: player.bottom } : null,
      disc: disc ? { w: disc.width, h: disc.height } : null,
      infoText: info ? { w: info.width } : null,
      controls: controls ? { w: controls.width } : null,
      timeline: timeline ? { w: timeline.width } : null,
      volume: volume ? { w: volume.width } : null,
      grid: gridContainer ? { w: gridContainer.width, h: gridContainer.height } : null,
      vp: { w: window.innerWidth, h: window.innerHeight },
    };
  });

  console.log(`\n--- ${t.name} (${t.w}x${t.h}) @ font-size: ${sizes.fontSize}px ---`);

  // Sun is at least larger at 4K than at 1080p proportional to font-size
  check('Sun is visible', sizes.sun.w > 0, 'sun has no width');
  check('Disc is visible', sizes.disc.w > 0, 'disc has no width');
  check('Player is visible', sizes.player.w > 0, 'player has no width');

  // Sun width at 4K should be > 1080p since font-size increases
  // This is a sanity check - at 4K all em-based elements should be larger
  if (sizes.fontSize > 16) {
    const ratio = sizes.fontSize / 16;
    check(`Sun scales at 4K (ratio ${ratio.toFixed(2)})`,
      sizes.sun.w > 480, // 30em * 16px = 480px is the 1080p size
      `sun width = ${sizes.sun.w.toFixed(0)}px`);
    check(`Player scales at 4K (ratio ${ratio.toFixed(2)})`,
      sizes.player.w > 640, // 40em * 16px = 640px is the 1080p width
      `player width = ${sizes.player.w.toFixed(0)}px`);
    check(`Disc scales at 4K (ratio ${ratio.toFixed(2)})`,
      sizes.disc.w > 416, // 26em * 16px = 416px is the 1080p size
      `disc width = ${sizes.disc.w.toFixed(0)}px`);
  }

  // Player doesn't overflow viewport
  check('Player not wider than viewport', sizes.player.w <= sizes.vp.w,
    `player ${sizes.player.w.toFixed(0)}px > vp ${sizes.vp.w}px`);

  // All UI rows have same width as controls
  if (sizes.infoText && sizes.controls) {
    check('Info text and controls same width',
      Math.abs(sizes.infoText.w - sizes.controls.w) < 1,
      `info=${sizes.infoText.w.toFixed(0)}px controls=${sizes.controls.w.toFixed(0)}px`);
  }

  // Grid fills viewport
  check('Grid container fills width', sizes.grid.w >= sizes.vp.w - 2,
    `grid=${sizes.grid.w.toFixed(0)}px vp=${sizes.vp.w}px`);
  check('Grid container fills height', sizes.grid.h >= sizes.vp.h - 2,
    `grid=${sizes.grid.h.toFixed(0)}px vp=${sizes.vp.h}px`);

  await page.close();
}

await browser.close();
server.close();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
