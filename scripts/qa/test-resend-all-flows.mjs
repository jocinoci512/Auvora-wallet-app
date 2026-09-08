import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  buildVerifyEmail,
  buildPasswordResetEmail,
  buildNewLoginNotice,
} from '../../services/auth/dist/infrastructure/mail/auth-email.templates.js';

const require = createRequire(import.meta.url);
const nodemailer = require('../../services/auth/node_modules/nodemailer');

async function testAllFlows() {
  console.log('=== Auvora Real Application Flows Test via Resend ===');

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
  const recipient = 'delivered@resend.dev';

  const flows = [
    {
      name: '1. Account Verification Flow',
      content: buildVerifyEmail(
        'https://auvorawallet.com/auth/verify?token=safe-flow-verification-test',
      ),
    },
    {
      name: '2. Password Reset Flow',
      content: buildPasswordResetEmail(
        'https://auvorawallet.com/auth/reset-password?token=safe-flow-reset-test',
      ),
    },
    {
      name: '3. KYC Status Email Flow',
      content: {
        subject: 'Auvora KYC Verification Approved',
        text: 'Your identity verification for Auvora Wallet has been approved. Tier 1 access is now active.',
        html: '<p>Your identity verification for Auvora Wallet has been <strong>approved</strong>. Tier 1 access is now active.</p>',
      },
    },
    {
      name: '4. Transaction Notification Flow',
      content: {
        subject: 'Auvora Transfer Approved & Confirmed',
        text: 'Your withdrawal of 50.00 USDC has been policy-approved and successfully processed.',
        html: '<p>Your transfer of <strong>50.00 USDC</strong> has been policy-approved and processed.</p>',
      },
    },
    {
      name: '5. Security / Account Notice Flow',
      content: buildNewLoginNotice({
        deviceName: 'Samsung Galaxy SM-S901B',
        platform: 'android',
        ipAddress: '192.0.2.1',
      }),
    },
  ];

  for (const flow of flows) {
    console.log(`\nTesting: ${flow.name}`);
    console.log(`  Subject: "${flow.content.subject}"`);
    try {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: flow.content.subject,
        text: flow.content.text,
        html: flow.content.html,
      });

      console.log(`  Send result: 250 OK - messageId: ${info.messageId}`);
      console.log(`  Response: ${info.response}`);
    } catch (err) {
      console.error(`  Send failed: ${err.message}`);
    }
  }

  console.log('\nQuerying Resend API for recent deliveries...');
  await new Promise((r) => setTimeout(r, 4000));

  const res = await fetch('https://api.resend.com/emails', {
    headers: { Authorization: `Bearer ${vars.SMTP_PASS}` },
  });
  const data = await res.json();
  if (data.data) {
    console.log(`Resend contains ${data.data.length} total messages:`);
    for (const item of data.data.slice(0, 5)) {
      console.log(
        `  - [${item.id}] "${item.subject}" -> ${item.to.join(', ')} (${item.created_at})`,
      );
    }
  }
}

testAllFlows().catch(console.error);
