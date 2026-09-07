'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../components/legal/LegalShell';

export default function AccountDeletionPage(): ReactElement {
  return (
    <LegalShell
      title="Account and Data Deletion"
      subtitle="How to request deletion of your Auvora account and associated personal data."
      current="/account-deletion"
    >
      <section className="cx-panel">
        <h2>Overview</h2>
        <p>
          At Auvora, we believe in user privacy and data ownership. You have the right to request
          complete deletion of your Auvora user account, profile information, and associated
          off-chain data at any time.
        </p>
      </section>

      <section className="cx-panel">
        <h2>Two Ways to Delete Your Account</h2>
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
          <div>
            <h3>Option 1: Inside the Auvora Mobile App (Immediate)</h3>
            <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: '1.6' }}>
              <li>
                Open the <strong>Auvora Wallet</strong> app on your Android or iOS device.
              </li>
              <li>
                Navigate to <strong>Settings</strong> &rarr; <strong>Account</strong>.
              </li>
              <li>
                Scroll to the <strong>Danger Zone</strong> section at the bottom.
              </li>
              <li>
                Tap <strong>Delete Account &amp; Data</strong>.
              </li>
              <li>
                Confirm your biometric or passcode authorization. Your account session, profile
                records, and encrypted backup references will be permanently deleted from our
                servers.
              </li>
            </ol>
          </div>

          <div>
            <h3>Option 2: Web Deletion Request (External)</h3>
            <p style={{ marginTop: '0.5rem', lineHeight: '1.6' }}>
              If you have uninstalled the app or cannot access your mobile device, you can submit an
              account deletion request directly by emailing our data privacy team at{' '}
              <a
                href="mailto:privacy@auvorawallet.com"
                style={{ color: 'var(--color-accent, #20808D)', textDecoration: 'underline' }}
              >
                privacy@auvorawallet.com
              </a>{' '}
              with the subject line <strong>&quot;Account Deletion Request&quot;</strong> from the
              email address registered with your Auvora account.
            </p>
            <p style={{ marginTop: '0.5rem', lineHeight: '1.6' }}>
              Requests submitted by email are processed and verified within 30 days.
            </p>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>What Is Deleted vs. What Cannot Be Deleted</h2>
        <div style={{ display: 'grid', gap: '1rem', marginTop: '0.75rem' }}>
          <div style={{ borderLeft: '3px solid #20808D', paddingLeft: '1rem' }}>
            <h3 style={{ color: 'var(--color-foreground, #fff)' }}>Data Deleted Permanently</h3>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: '1.5' }}>
              <li>Auvora account profile (email address, display name, preferences).</li>
              <li>Authentication tokens, active device sessions, and login audit records.</li>
              <li>Encrypted cloud backup vaults stored on Auvora servers (if enabled).</li>
              <li>Notification tokens, contact address book nicknames, and watchlists.</li>
            </ul>
          </div>

          <div style={{ borderLeft: '3px solid #E59866', paddingLeft: '1rem' }}>
            <h3 style={{ color: 'var(--color-foreground, #fff)' }}>
              Data That Cannot Be Deleted (Public Blockchain)
            </h3>
            <p style={{ marginTop: '0.5rem', lineHeight: '1.5' }}>
              Auvora is a <strong>non-custodial cryptocurrency wallet</strong>. Public blockchains
              (such as Bitcoin, Ethereum, Solana, Polygon, BNB Smart Chain, and Tron) are
              decentralized, immutable ledgers.
            </p>
            <p style={{ marginTop: '0.5rem', lineHeight: '1.5' }}>
              Transactions that you broadcast to any public blockchain are permanent, public records
              that cannot be modified, deleted, or removed by Auvora or any other party.
            </p>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Important: Backup Your Recovery Phrase</h2>
        <p>
          Because Auvora is self-custodial, deleting your Auvora cloud account does{' '}
          <strong>not</strong> touch or delete your funds on the blockchain. Your cryptocurrency
          balances are secured by your 12- or 24-word recovery phrase.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          Always ensure you have safely recorded your recovery phrase offline before deleting your
          account or clearing local device storage.
        </p>
      </section>

      <section className="cx-panel">
        <h2>Questions &amp; Support</h2>
        <p>
          For privacy inquiries or assistance with data deletion, contact{' '}
          <a
            href="mailto:privacy@auvorawallet.com"
            style={{ color: 'var(--color-accent, #20808D)', textDecoration: 'underline' }}
          >
            privacy@auvorawallet.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
