#!/usr/bin/env node
/**
 * Lightweight accessibility / UX smoke checks for Web + Admin.
 * Usage: node scripts/perf/a11y-smoke.mjs
 */
const targets = [
  { name: 'web', url: process.env.WEB_URL || 'http://localhost:3000' },
  { name: 'admin', url: process.env.ADMIN_URL || 'http://localhost:3001' },
];

const results = [];

for (const target of targets) {
  try {
    const res = await fetch(target.url, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    const checks = {
      statusOk: res.ok,
      hasHtmlLang: /<html[^>]*lang=/i.test(html),
      hasMainOrRole: /<(main|nav|header|footer)\b/i.test(html) || /role=["'](main|navigation)/i.test(html),
      hasViewport: /name=["']viewport["']/i.test(html),
      hasSkipLink: /skip to content/i.test(html),
      hasMainTarget: /id=["']main-content["']/i.test(html),
      avoidsAutoplayAudio: !/<audio[^>]+autoplay/i.test(html),
      contentTypeOptions:
        (res.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff',
    };
    const ok =
      checks.statusOk &&
      checks.hasHtmlLang &&
      checks.hasViewport &&
      checks.hasSkipLink &&
      checks.hasMainTarget;
    results.push({ target: target.name, url: target.url, ok, checks });
  } catch (error) {
    results.push({
      target: target.name,
      url: target.url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify({ results }, null, 2));
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
