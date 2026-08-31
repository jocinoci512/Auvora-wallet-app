#!/usr/bin/env node
/**
 * Classify and safely replay category-A EMAIL DEAD_LETTER rows (SMTP absent only).
 * LOCAL QA ONLY — Mailpit bridge at 127.0.0.1:3099.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

function loadEnvKey(key) {
  try {
    const envPath = resolve(repoRoot, '.env');
    const raw = readFileSync(envPath, 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (!line) return process.env[key] ?? '';
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    return process.env[key] ?? '';
  }
}

const apiKey = loadEnvKey('INTERNAL_API_KEY');
const base = process.env.NOTIFICATIONS_URL ?? 'http://127.0.0.1:3006';
const headers = {
  'content-type': 'application/json',
  ...(apiKey ? { 'x-internal-api-key': apiKey } : {}),
};

const smtpAbsent =
  /smtp|mailpit|ECONNREFUSED|ENOTFOUND|provider|connection refused|no such host|timeout/i;
const malformed = /template|render|invalid.*payload|missing.*field|schema/i;
const duplicate = /duplicate|idempotency|already sent/i;

async function fetchJson(path, init) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  return body;
}

function classify(reason = '', channel = '') {
  const r = `${reason} ${channel}`.toLowerCase();
  if (duplicate.test(r)) return 'C';
  if (malformed.test(r)) return 'B';
  if (smtpAbsent.test(r) || reason.trim() === '') return 'A';
  return 'D';
}

const report = {
  deadLettersBefore: 0,
  replayable: 0,
  replayedSent: 0,
  skippedDuplicate: 0,
  deadLettersAfter: 0,
  byCategory: { A: 0, B: 0, C: 0, D: 0 },
  failures: [],
};

async function listDeadLetterPage(skip, take) {
  const data = await fetchJson(`/api/v1/admin/notifications/failed?skip=${skip}&take=${take}`);
  return data?.data ?? data;
}

async function main() {
  const all = [];
  for (let skip = 0; skip < 500; skip += 50) {
    const page = await listDeadLetterPage(skip, 50);
    const items = page?.items ?? page?.data ?? [];
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < 50) break;
  }

  report.deadLettersBefore = all.length;
  const replayable = [];
  for (const item of all) {
    const reason =
      item.failureReason ??
      item.notification?.failureReason ??
      item.lastError ??
      item.message?.failureReason ??
      '';
    const channel = item.channel ?? item.notification?.channel ?? '';
    const cat = classify(String(reason), String(channel));
    report.byCategory[cat] = (report.byCategory[cat] ?? 0) + 1;
    if (cat === 'A' && String(channel).toUpperCase() === 'EMAIL') {
      replayable.push(item);
    }
  }
  report.replayable = replayable.length;

  for (const item of replayable) {
    const id = item.id ?? item.queueItemId;
    if (!id) continue;
    try {
      await fetchJson(`/api/v1/admin/notifications/queue/${id}/requeue`, {
        method: 'POST',
        body: '{}',
      });
      report.replayedSent++;
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (duplicate.test(msg)) {
        report.skippedDuplicate++;
      } else {
        report.failures.push({ id, reason: msg.slice(0, 160) });
      }
    }
  }

  // Allow worker to drain requeued items
  await new Promise((r) => setTimeout(r, 3000));

  const afterPage = await listDeadLetterPage(0, 1);
  const afterTotal = afterPage?.total ?? afterPage?.meta?.total;
  if (typeof afterTotal === 'number') {
    report.deadLettersAfter = afterTotal;
  } else {
    const afterAll = [];
    for (let skip = 0; skip < 500; skip += 50) {
      const page = await listDeadLetterPage(skip, 50);
      const items = page?.items ?? page?.data ?? [];
      if (!Array.isArray(items) || items.length === 0) break;
      afterAll.push(...items);
      if (items.length < 50) break;
    }
    report.deadLettersAfter = afterAll.length;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
