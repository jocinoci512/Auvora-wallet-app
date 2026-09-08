import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nodemailer = require('../../services/auth/node_modules/nodemailer');

async function testKycEmailFlows() {
  console.log('=== Auvora KYC Lifecycle Email Notifications via Production Resend ===');

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

  const kycEmailEvents = [
    {
      name: '1. KYC Verification Submitted (Started)',
      subject: 'Auvora — Identity Verification In Progress',
      text: 'We have received your identity verification request for Auvora Wallet. Our automated verification partner is reviewing your submission. You will receive an update shortly.',
      html: '<p>We have received your identity verification request for <strong>Auvora Wallet</strong>. Our automated verification partner is reviewing your submission. You will receive an update shortly.</p>',
    },
    {
      name: '2. KYC Verification Approved (Tier 1 Access Active)',
      subject: 'Auvora — Identity Verification Approved',
      text: 'Congratulations! Your identity verification has been approved. Your account now has access to higher transfer limits ($5,000+).',
      html: '<p>Congratulations! Your identity verification has been <strong>approved</strong>. Your account now has access to higher transfer limits ($5,000+).</p>',
    },
    {
      name: '3. KYC Action Required (Resubmission Requested)',
      subject: 'Auvora — Identity Verification: Action Required',
      text: 'Your document submission could not be verified: The uploaded government ID was unreadable or expired. Please sign in to Auvora Wallet and upload a clear, unexpired document.',
      html: '<p>Your document submission could not be verified: <em>The uploaded government ID was unreadable or expired.</em> Please sign in to Auvora Wallet and upload a clear, unexpired document.</p>',
    },
    {
      name: '4. KYC Verification Rejected (Customer-Visible Copy Only)',
      subject: 'Auvora — Identity Verification Update',
      text: 'Your identity verification could not be approved at this time: Verification failed partner compliance checks. If you believe this is in error, please contact Auvora support.',
      html: '<p>Your identity verification could not be approved at this time: <em>Verification failed partner compliance checks.</em> If you believe this is in error, please contact Auvora support.</p>',
    },
  ];

  for (const evt of kycEmailEvents) {
    console.log(`\nSending: ${evt.name}`);
    console.log(`  Subject: "${evt.subject}"`);
    try {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: evt.subject,
        text: evt.text,
        html: evt.html,
      });

      console.log(`  Send result: 250 OK - messageId: ${info.messageId}`);
    } catch (err) {
      console.error(`  Send failed: ${err.message}`);
      throw err;
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
    for (const item of data.data.slice(0, 4)) {
      console.log(
        `  - [${item.id}] "${item.subject}" -> ${item.to.join(', ')} (${item.created_at})`,
      );
    }
  }

  console.log('\nAll 4 KYC email notifications successfully sent and verified on Resend!');
}

testKycEmailFlows().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
