import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nodemailer = require('../../services/auth/node_modules/nodemailer');

async function sendTestEmail() {
  const cmd =
    'pnpm dlx @railway/cli variable list --project 458e0c14-654e-4d96-8009-4b70b2279cf8 --environment production --service auth-prods --json';
  const raw = execSync(cmd, { encoding: 'utf8' });
  const vars = JSON.parse(raw);

  const transporter = nodemailer.createTransport({
    host: vars.SMTP_HOST,
    port: parseInt(vars.SMTP_PORT, 10),
    secure: parseInt(vars.SMTP_PORT, 10) === 465,
    auth: {
      user: vars.SMTP_USER,
      pass: vars.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  const from = `"${vars.SMTP_FROM_NAME || 'Auvora Wallet'}" <${vars.SMTP_FROM}>`;
  const to = 'jocinoci512@gmail.com';
  const subject = 'Auvora Email Verification Test';
  const text = `This is an automated verification of the Auvora Resend production email infrastructure.\nSent from: ${from}\nTimestamp: ${new Date().toISOString()}`;

  console.log(`Sending test email from: ${from} to: ${to}`);
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  console.log('Nodemailer send result:');
  console.log(' - accepted:', info.accepted);
  console.log(' - rejected:', info.rejected);
  console.log(' - messageId:', info.messageId);
  console.log(' - response:', info.response);

  // Now check status in Resend API
  console.log('Waiting 3 seconds to check delivery status on Resend API...');
  await new Promise((r) => setTimeout(r, 3000));

  const res = await fetch('https://api.resend.com/emails', {
    headers: { Authorization: `Bearer ${vars.SMTP_PASS}` },
  });
  const data = await res.json();
  if (data.data && data.data.length > 0) {
    const latest = data.data[0];
    console.log('Latest email in Resend:');
    console.log(' - ID:', latest.id);
    console.log(' - To:', latest.to);
    console.log(' - From:', latest.from);
    console.log(' - Subject:', latest.subject);

    // Get detail
    const detailRes = await fetch(`https://api.resend.com/emails/${latest.id}`, {
      headers: { Authorization: `Bearer ${vars.SMTP_PASS}` },
    });
    const detail = await detailRes.json();
    console.log(' - Delivery status:', detail.last_event);
  }
}

sendTestEmail().catch(console.error);
