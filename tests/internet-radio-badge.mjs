import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();

const VIEWPORTS = [
  { name: 'xs mobile (375x667)',   w: 375,  h: 667  },
  { name: 'sm tablet (640x800)',    w: 640,  h: 800  },
  { name: 'md iPad (768x1024)',    w: 768,  h: 1024 },
  { name: 'lg laptop (1024x768)',  w: 1024, h: 768  },
  { name: 'xl desktop (1280x800)', w: 1280, h: 800  },
];

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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Test container flexbox properties
  console.log('\n--- Checking Flexbox Container (#bottom-left-links) ---');
  const containerInfo = await page.evaluate(() => {
    const container = document.querySelector('#bottom-left-links');
    if (!container) return null;
    const style = window.getComputedStyle(container);
    const cookieStyle = window.getComputedStyle(document.querySelector('#cookie-notice'));
    return {
      display: style.display,
      position: style.position,
      gap: style.gap,
      left: style.left,
      bottom: style.bottom,
      zIndex: parseInt(style.zIndex, 10),
      cookieZIndex: parseInt(cookieStyle.zIndex, 10),
    };
  });

  check('Container #bottom-left-links exists', containerInfo !== null);
  check('Container is display: flex', containerInfo?.display === 'flex');
  check('Container is position: fixed', containerInfo?.position === 'fixed');
  check('Container gap is 3px', containerInfo?.gap === '3px');
  check('Container left is 3px', containerInfo?.left === '3px');
  check('Container bottom is 3px', containerInfo?.bottom === '3px');

  // Test element attributes & local image
  console.log('\n--- Checking Internet Radio Badge Attributes ---');
  const badgeInfo = await page.evaluate(() => {
    const el = document.querySelector('#internet-radio-badge');
    if (!el) return null;
    const img = el.querySelector('img');
    return {
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      imgSrc: img ? img.getAttribute('src') : null,
      imgNaturalWidth: img ? img.naturalWidth : 0,
    };
  });

  check('Badge element exists', badgeInfo !== null);
  check(
    'Badge links to https://www.internet-radio.com',
    badgeInfo?.href === 'https://www.internet-radio.com',
    badgeInfo?.href
  );
  check(
    'Badge image uses local src images/internet-radio-badge.gif',
    badgeInfo?.imgSrc === 'images/internet-radio-badge.gif',
    badgeInfo?.imgSrc
  );
  check('Badge opens in new tab (_blank)', badgeInfo?.target === '_blank');
  check('Badge rel includes noopener', badgeInfo?.rel?.includes('noopener'));

  // Test vertical stacking order: surf-tips > cookie-notice > links
  console.log('\n--- Checking Vertical Stacking Order ---');
  const stackPositions = await page.evaluate(() => {
    const links = document.querySelector('#bottom-left-links')?.getBoundingClientRect();
    const cookie = document.querySelector('#cookie-notice')?.getBoundingClientRect();
    const tip = document.querySelector('#surf-tip')?.getBoundingClientRect();

    return {
      linksBottom: links ? window.innerHeight - links.bottom : null,
      cookieBottom: cookie ? window.innerHeight - cookie.bottom : null,
      tipBottom: tip ? window.innerHeight - tip.bottom : null,
    };
  });

  check(
    'Cookie notice is stacked above links',
    stackPositions.cookieBottom > stackPositions.linksBottom,
    `cookie: ${stackPositions.cookieBottom}px, links: ${stackPositions.linksBottom}px`
  );
  check(
    'Surf tip is stacked above cookie notice',
    stackPositions.tipBottom > stackPositions.cookieBottom,
    `tip: ${stackPositions.tipBottom}px, cookie: ${stackPositions.cookieBottom}px`
  );

  // Test multi-link flexbox layout spacing
  console.log('\n--- Checking Multi-Link Flexbox Layout Spacing ---');
  const multiLinkPos = await page.evaluate(() => {
    const container = document.querySelector('#bottom-left-links');
    const link2 = document.createElement('a');
    link2.id = 'test-second-link';
    link2.href = 'https://example.com';
    link2.innerHTML = '<span style="display:inline-block;width:50px;height:15px;"></span>';
    container.appendChild(link2);

    const r1 = document.querySelector('#internet-radio-badge').getBoundingClientRect();
    const r2 = link2.getBoundingClientRect();
    return {
      r1Left: r1.left,
      r1Right: r1.right,
      r2Left: r2.left,
      gapBetween: r2.left - r1.right,
    };
  });

  check('First link stays at left margin (3px)', Math.abs(multiLinkPos.r1Left - 3) < 1);
  check(
    'Second link appears to the right with 3px gap',
    Math.abs(multiLinkPos.gapBetween - 3) < 1,
    `gap was ${multiLinkPos.gapBetween}px`
  );

  // Test positioning across viewports
  console.log('\n--- Checking Container Positioning Across Viewports ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await new Promise((r) => setTimeout(r, 200));

    const pos = await page.evaluate(() => {
      const el = document.querySelector('#bottom-left-links');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        bottomOffset: window.innerHeight - r.bottom,
      };
    });

    check(`${vp.name}: Left is 3px`, Math.abs((pos?.left ?? -1) - 3) < 1, `got ${pos?.left}px`);
    check(
      `${vp.name}: Bottom offset is 3px`,
      Math.abs((pos?.bottomOffset ?? -1) - 3) < 1,
      `got ${pos?.bottomOffset}px`
    );
  }
} catch (err) {
  console.error(`Unexpected error: ${err.message}`);
  failures++;
} finally {
  await browser.close();
  server.close();
}

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
process.exit(failures ? 1 : 0);
