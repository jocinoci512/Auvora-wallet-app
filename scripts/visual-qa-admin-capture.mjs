import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(
  'C:/Users/kwasi/.cursor/projects/d-auvora-wallet/artifacts/design-increment-3/qa.mjs',
);
const { chromium } = require('playwright');

const creds = JSON.parse(
  fs.readFileSync(path.join(root, '.local-data', 'visual-qa-admin.json'), 'utf8'),
);
const outDir = path.join(root, 'apps/admin/qa-screenshots/final-admin-visual');
fs.mkdirSync(outDir, { recursive: true });

const SECRET_LEAK =
  /passwordHash|mfaSecret|secretEncrypted|codeHash|refreshToken|privateKey|seed phrase|mnemonic|symKey|DATABASE_URL|REDIS_URL|INTERNAL_API_KEY|AUTH_FIELD_ENCRYPTION_KEY|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/i;

const report = {
  overflow: [],
  secrets: [],
  missing: [],
  notes: [],
};

function totpCode(secret, nowMs = Date.now()) {
  const step = Math.floor(nowMs / 1000 / 30);
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(step, 4);
  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error('Invalid TOTP secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

async function setTheme(page, dark) {
  await page.evaluate((isDark) => {
    const t = isDark ? 'dark' : 'light';
    localStorage.setItem('auvora-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.toggle('auvora-theme-dark', isDark);
    document.documentElement.classList.toggle('auvora-theme-light', !isDark);
    document.documentElement.style.colorScheme = t;
  }, dark);
}

async function inspect(page, name) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const text = document.body?.innerText ?? '';
    const html = document.documentElement.outerHTML;
    return {
      overflowX: doc.scrollWidth > doc.clientWidth + 2,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasTokenPanel: /access token|paste a jwt|bearer token/i.test(text),
      hasSkip: Boolean(document.querySelector('a.auvora-skip-link')),
      hasMenu: Boolean(document.querySelector('.admin-header__menu')),
      text,
      html,
    };
  });
  if (metrics.overflowX) {
    report.overflow.push(`${name} ${metrics.scrollWidth}>${metrics.clientWidth}`);
  }
  if (metrics.hasTokenPanel) {
    report.notes.push(`${name} showed token-paste UI`);
  }
  if (SECRET_LEAK.test(metrics.text) || SECRET_LEAK.test(metrics.html)) {
    report.secrets.push(name);
  }
  return metrics;
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  const file = `${name}.png`;
  await page.screenshot({
    path: path.join(outDir, file),
    fullPage: true,
    animations: 'disabled',
  });
  await inspect(page, file);
  process.stdout.write(`wrote ${file}\n`);
}

async function gotoReady(page, pathName) {
  await page.goto(`http://localhost:3001${pathName}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await gotoReady(page, '/login');
await page.locator('input[type="email"]').fill(creds.email);
await page.locator('input[type="password"]').fill(creds.password);
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForURL(/\/mfa/, { timeout: 20000 });

if (page.url().includes('/mfa/enroll')) {
  await page.waitForSelector('code', { timeout: 15000 });
  const secret = await page.locator('.admin-auth-secret code').innerText();
  creds.totpSecret = secret;
  fs.writeFileSync(
    path.join(root, '.local-data', 'visual-qa-admin.json'),
    JSON.stringify(creds, null, 2),
  );
  let enrolled = false;
  for (const offset of [0, 30000, -30000]) {
    await page
      .locator('input')
      .last()
      .fill(totpCode(secret, Date.now() + offset));
    await page.getByRole('button', { name: 'Confirm enrollment' }).click();
    try {
      await page
        .getByRole('button', { name: 'I have saved these codes' })
        .waitFor({ timeout: 4000 });
      enrolled = true;
      break;
    } catch {
      /* retry another TOTP window */
    }
  }
  if (!enrolled) {
    throw new Error('MFA enrollment did not complete');
  }
  await page.getByRole('button', { name: 'I have saved these codes' }).click();
} else {
  const secret = creds.totpSecret;
  if (!secret) throw new Error(`MFA verify required but no local TOTP secret (${page.url()})`);
  let verified = false;
  for (const offset of [0, 30000, -30000]) {
    await page
      .locator('input')
      .first()
      .fill(totpCode(secret, Date.now() + offset));
    await page.getByRole('button', { name: 'Verify' }).click();
    try {
      await page.waitForURL('http://localhost:3001/', { timeout: 5000 });
      verified = true;
      break;
    } catch {
      /* retry another TOTP window */
    }
  }
  if (!verified) throw new Error('MFA verify did not complete');
}

await page.waitForURL('http://localhost:3001/', { timeout: 20000 });
await page.waitForSelector('.admin-sidebar__brand', { timeout: 15000 });
const body = await page.locator('body').innerText();
if (/access token|paste a jwt/i.test(body)) {
  report.notes.push('token paste visible after login');
}
if (!/visualqa\.super@auvora\.test/i.test(body)) {
  report.missing.push('admin identity email');
}
if (!/Super Admin/i.test(body)) {
  report.missing.push('role chip');
}

const pages = [
  ['/', 'dashboard'],
  ['/users', 'users'],
  ['/security', 'security'],
  ['/security/audit', 'audit'],
  ['/observability/health', 'health'],
  ['/operators', 'operators'],
];

await setTheme(page, false);
await shot(page, 'dashboard-1440');
await page.setViewportSize({ width: 1280, height: 900 });
await shot(page, 'dashboard-1280');
await page.setViewportSize({ width: 1024, height: 900 });
await shot(page, 'dashboard-1024');
const menu = page.locator('.admin-header__menu');
if (await menu.isVisible()) {
  await menu.click();
  await page.waitForTimeout(250);
  await shot(page, 'dashboard-1024-nav-open');
  await page
    .locator('.admin-nav-backdrop')
    .click({ force: true })
    .catch(() => undefined);
}
await page.setViewportSize({ width: 768, height: 1024 });
await shot(page, 'dashboard-768');

for (const [href, slug] of pages.slice(1)) {
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({
      width,
      height: width === 768 ? 1024 : 900,
    });
    await setTheme(page, false);
    await gotoReady(page, href);
    await shot(page, `${slug}-${width}`);
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await gotoReady(page, '/users');
const openLink = page.getByRole('link', { name: 'Open' }).first();
if (await openLink.count()) {
  await openLink.click();
  await page.waitForTimeout(800);
  await shot(page, 'user-detail-1440');
  await page.setViewportSize({ width: 1024, height: 900 });
  await shot(page, 'user-detail-1024');
  await page.setViewportSize({ width: 768, height: 1024 });
  await shot(page, 'user-detail-768');
} else {
  report.missing.push('user detail link');
}

await page.setViewportSize({ width: 1440, height: 900 });
await gotoReady(page, '/operators');
const reset = page.getByRole('button', { name: 'Reset MFA' }).first();
if (await reset.count()) {
  await reset.click();
  await page.waitForTimeout(300);
  await shot(page, 'operators-high-risk-dialog-1440');
  await page.getByRole('button', { name: 'Cancel' }).click();
}

await page.setViewportSize({ width: 1440, height: 900 });
for (const [href, slug] of [
  ['/', 'dashboard'],
  ['/users', 'users'],
  ['/security', 'security'],
  ['/security/audit', 'audit'],
]) {
  await gotoReady(page, href);
  await setTheme(page, true);
  await shot(page, `${slug}-dark`);
}

await setTheme(page, false);
await gotoReady(page, '/forbidden');
await shot(page, 'forbidden-403');
await gotoReady(page, '/session-expired');
await shot(page, 'session-expired');

const existingLogin = path.join(root, 'apps/admin/qa-screenshots/admin-login-dark.png');
const existingMfa = path.join(root, 'apps/admin/qa-screenshots/admin-mfa-dark.png');
if (fs.existsSync(existingLogin)) {
  fs.copyFileSync(existingLogin, path.join(outDir, 'login-dark.png'));
}
if (fs.existsSync(existingMfa)) {
  fs.copyFileSync(existingMfa, path.join(outDir, 'mfa-dark.png'));
}

fs.writeFileSync(path.join(outDir, 'qa-report.json'), JSON.stringify(report, null, 2));
await browser.close();
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.overflow.length || report.secrets.length) {
  process.exit(2);
}
