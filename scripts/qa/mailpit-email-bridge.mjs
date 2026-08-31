/**
 * LOCAL QA ONLY — HTTP → Mailpit SMTP bridge for Notifications EMAIL channel.
 *
 * Notifications posts JSON { recipient, subject, body } here.
 * This process SMTP-delivers to Mailpit (127.0.0.1:1025).
 *
 * Never expose outside the QA host. Never use in production.
 *
 * Usage:
 *   node scripts/qa/mailpit-email-bridge.mjs
 *   NOTIFICATIONS_EMAIL_PROVIDER_URL=http://127.0.0.1:3099/send
 */

import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(path.join(repoRoot, 'package.json'));

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  try {
    nodemailer = require(path.join(repoRoot, 'services', 'auth', 'node_modules', 'nodemailer'));
  } catch (e) {
    console.error('nodemailer not found — install auth deps or root nodemailer');
    process.exit(1);
  }
}

const PORT = Number(process.env.AUVORA_QA_MAIL_BRIDGE_PORT || 3099);
const SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@auvora.local';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Auvora Wallet QA';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  tls: { rejectUnauthorized: false },
  disableFileAccess: true,
  disableUrlAccess: true,
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'auvora-mailpit-bridge',
        smtp: `${SMTP_HOST}:${SMTP_PORT}`,
      }),
    );
    return;
  }
  if (req.method === 'POST' && (url.pathname === '/send' || url.pathname === '/')) {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const to = String(payload.recipient || payload.to || '').trim();
      const subject = String(payload.subject || 'Auvora notification').trim();
      const body = String(payload.body || payload.text || '').trim();
      if (!to || !to.includes('@')) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'missing recipient' }));
        return;
      }
      // Refuse anything that looks like private material in subject/body for safety logging.
      const lower = `${subject}\n${body}`.toLowerCase();
      if (
        lower.includes('mnemonic') ||
        lower.includes('private key') ||
        lower.includes('seed phrase')
      ) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'refusing secret-looking content' }));
        return;
      }
      const info = await transporter.sendMail({
        from: `"${SMTP_FROM_NAME.replace(/"/g, '')}" <${SMTP_FROM}>`,
        to,
        subject,
        text: body,
        html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, messageId: info.messageId }));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    }
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `Auvora Mailpit email bridge http://127.0.0.1:${PORT}/send → smtp://${SMTP_HOST}:${SMTP_PORT}`,
  );
});

// Keep process alive; parent scripts manage lifecycle.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

// Touch net to satisfy some bundlers — unused.
void net;
