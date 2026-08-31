#!/usr/bin/env node
/**
 * LOCAL QA ONLY — replay category-A EMAIL dead letters via trusted local DB + internal queue drain.
 * Does NOT use Admin JWT. Uses INTERNAL_API_KEY + docker psql only.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function parseEnv(contents) {
  const result = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  const file = path.join(repoRoot, '.env');
  const fromFile = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  return { ...fromFile, ...process.env };
}

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'auvora-postgres', 'psql', '-U', 'auvora', '-d', 'auvora_wallet', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
}

function psqlJson(sql) {
  const raw = psql(sql);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const smtpAbsent =
  /no provider configured|smtp|mailpit|econnrefused|enotfound|connection refused|timeout|provider.*absent/i;
const malformed = /template|render|invalid.*payload|missing.*field|schema/i;
const duplicate = /duplicate|idempotency|already sent/i;
const nonRetriable = /unsubscribed|suppressed|blocked|bounced permanently|invalid.*recipient/i;

function classify(reason = '', dedupeKey = '') {
  const r = `${reason} ${dedupeKey}`.toLowerCase();
  if (duplicate.test(r)) return 'D';
  if (nonRetriable.test(r)) return 'E';
  if (malformed.test(r)) return 'B';
  if (smtpAbsent.test(r) || reason.trim() === '') return 'A';
  if (!reason.includes('@') && reason.length < 120) return 'C';
  return 'E';
}

async function assertQaGuards(env) {
  const flag = String(env.AUVORA_QA_ALLOW_EMAIL_REPLAY ?? 'true').toLowerCase();
  if (!['true', '1', 'yes'].includes(flag)) {
    throw new Error(
      'Refusing replay — set AUVORA_QA_ALLOW_EMAIL_REPLAY=true (QA lab bootstrap sets this).',
    );
  }
  const db = String(env.DATABASE_URL ?? '').toLowerCase();
  if (/amazonaws|neon\.tech|supabase|planetscale|azure\.com/.test(db)) {
    throw new Error('Refusing replay — production-like DATABASE_URL detected');
  }
  const emailUrl = String(env.NOTIFICATIONS_EMAIL_PROVIDER_URL ?? 'http://127.0.0.1:3099/send');
  if (!/127\.0\.0\.1|localhost/.test(emailUrl)) {
    throw new Error('Refusing replay — local Mailpit bridge URL required');
  }
  if (/sendgrid|mailgun|ses\.amazonaws|postmark|resend\.com/i.test(emailUrl)) {
    throw new Error('Refusing replay — production SMTP provider detected');
  }
  try {
    const bridge = await fetch('http://127.0.0.1:3099/health');
    if (!bridge.ok) throw new Error('mailpit bridge unhealthy');
  } catch {
    throw new Error('Mailpit email bridge not healthy at http://127.0.0.1:3099/health');
  }
}

async function drainQueue(env, maxItems = 120) {
  const key = env.INTERNAL_API_KEY;
  if (!key || key.length < 32) throw new Error('INTERNAL_API_KEY missing from local .env');
  const base = env.NOTIFICATIONS_URL ?? 'http://127.0.0.1:3006';
  const res = await fetch(`${base}/api/v1/internal/notifications/qa/drain-queue`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-api-key': key,
    },
    body: JSON.stringify({ maxItems }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`drain-queue HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return body?.data ?? body;
}

function requeueIds(ids) {
  if (ids.length === 0) return 0;
  const idList = ids.map((id) => `'${id}'`).join(',');
  psql(`
    UPDATE notification_queue_items
    SET status = 'QUEUED', available_at = NOW(), attempt_count = 0,
        dead_lettered_at = NULL, next_attempt_at = NULL, locked_at = NULL, locked_by = NULL
    WHERE id IN (${idList}) AND status = 'DEAD_LETTER';
  `);
  psql(`
    UPDATE notification_messages m
    SET status = 'QUEUED', failure_reason = NULL, failed_at = NULL
    FROM notification_queue_items q
    WHERE q.notification_id = m.id AND q.id IN (${idList});
  `);
  return ids.length;
}

async function runReplay(dryRun = false) {
  const env = loadEnv();
  await assertQaGuards(env);

  const rows = psqlJson(`
    SELECT json_build_object(
      'queueId', q.id,
      'notificationId', m.id,
      'reason', COALESCE(m.failure_reason, ''),
      'dedupeKey', COALESCE(m.dedupe_key, ''),
      'templateCode', COALESCE(t.code, ''),
      'subject', COALESCE(m.subject, ''),
      'status', q.status
    )::text
    FROM notification_queue_items q
    JOIN notification_messages m ON m.id = q.notification_id
    LEFT JOIN notification_templates t ON t.id = m.template_id
    WHERE q.status = 'DEAD_LETTER' AND m.channel = 'EMAIL'
    ORDER BY q.dead_lettered_at ASC;
  `);

  const report = {
    deadLettersBefore: rows.length,
    byCategory: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    replayAttempted: 0,
    replaySent: 0,
    skippedAlreadySent: 0,
    deadLettersAfter: rows.length,
    failures: [],
    usesAdminJwt: false,
  };

  const categoryA = [];
  for (const row of rows) {
    const cat = classify(row.reason, row.dedupeKey);
    report.byCategory[cat] = (report.byCategory[cat] ?? 0) + 1;
    if (cat === 'A') categoryA.push(row.queueId);
  }

  if (dryRun) {
    console.log(JSON.stringify({ ...report, dryRun: true, replayable: categoryA.length }, null, 2));
    return report;
  }

  report.replayAttempted = requeueIds(categoryA);
  const drain1 = await drainQueue(env, Math.max(categoryA.length + 10, 80));
  report.replaySent = Number(drain1?.succeeded ?? 0);

  const after = Number(
    psql(
      `SELECT COUNT(*) FROM notification_queue_items q JOIN notification_messages m ON m.id = q.notification_id WHERE q.status = 'DEAD_LETTER' AND m.channel = 'EMAIL';`,
    ),
  );
  report.deadLettersAfter = after;

  const sentNow = Number(
    psql(`SELECT COUNT(*) FROM notification_messages WHERE channel = 'EMAIL' AND status = 'SENT';`),
  );
  report.emailSentTotal = sentNow;

  console.log(JSON.stringify(report, null, 2));
  return report;
}

const dryRun = process.argv.includes('--dry-run');
runReplay(dryRun).catch((err) => {
  console.error(err);
  process.exit(1);
});
