import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), '.qa-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  [1366, 768],
  [1440, 900],
  [1570, 900],
  [1920, 1080],
  [1024, 768],
  [768, 1024],
];

const base = 'http://127.0.0.1:3000';
const pages = ['/dashboard', '/connections'];

const browser = await chromium.launch();
const results = [];

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const route of pages) {
    await page
      .goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const name = `${route.replace('/', '')}-${w}x${h}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: false });
    results.push({ route, w, h, ...metrics });
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(outDir, 'overflow-report.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
