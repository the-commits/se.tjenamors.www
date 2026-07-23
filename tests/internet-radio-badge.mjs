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

  // Test element attributes
  const badgeInfo = await page.evaluate(() => {
    const el = document.querySelector('#internet-radio-badge');
    if (!el) return null;
    const img = el.querySelector('img');
    return {
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      imgSrc: img ? img.getAttribute('src') : null,
      imgAlt: img ? img.getAttribute('alt') : null,
    };
  });

  console.log('\n--- Checking Internet Radio Badge Attributes ---');
  check('Badge element exists', badgeInfo !== null);
  check(
    'Badge links to http://www.internet-radio.com',
    badgeInfo?.href === 'http://www.internet-radio.com',
    badgeInfo?.href
  );
  const expectedBadgeUrl = 'https://www.internet-radio.com/images/internet-radio-badge.gif';
  check(
    'Badge image src is valid',
    badgeInfo?.imgSrc === expectedBadgeUrl,
    badgeInfo?.imgSrc
  );
  check('Badge opens in new tab (_blank)', badgeInfo?.target === '_blank');
  check('Badge rel includes noopener', badgeInfo?.rel?.includes('noopener'));

  // Test positioning across viewports
  console.log('\n--- Checking Badge Positioning Across Viewports ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await new Promise((r) => setTimeout(r, 200));

    const pos = await page.evaluate(() => {
      const el = document.querySelector('#internet-radio-badge');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        left: r.left,
        bottomOffset: window.innerHeight - r.bottom,
        position: style.position,
        leftCss: style.left,
        bottomCss: style.bottom,
      };
    });

    check(`${vp.name}: Position is fixed`, pos?.position === 'fixed', pos?.position);
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
