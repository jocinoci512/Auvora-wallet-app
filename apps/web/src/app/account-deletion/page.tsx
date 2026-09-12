'use client';

import type { ReactElement } from 'react';
import { LegalShell } from '../../components/legal/LegalShell';

export default function AccountDeletionPage(): ReactElement {
  return (
    <LegalShell
      title="Account and Data Deletion"
      subtitle="How to delete your Auvora account and what happens to associated data."
      current="/account-deletion"
    >
      <section className="cx-panel">
        <h2>Overview</h2>
        <p>
          You can request deletion of your Auvora account at any time. Deleting the Auvora account
          removes the account and eligible associated cloud data controlled by Auvora. It does{' '}
          <strong>not</strong> erase public blockchain transaction history, because blockchain
          records are not controlled by Auvora.
        </p>
        <p style={{ marginTop: '0.75rem', lineHeight: 1.6 }}>
          Auvora is self-custodial and does not hold your private keys. Account deletion will not
          silently destroy an on-chain wallet. Removing a wallet from a device is a separate action
          inside the app.
        </p>
      </section>

      <section className="cx-panel">
        <h2>Two Ways to Delete Your Account</h2>
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
          <div>
            <h3>Option 1: Inside the Auvora Mobile App</h3>
            <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 1.6 }}>
              <li>
                Open the <strong>Auvora Wallet</strong> app.
              </li>
              <li>
                Go to <strong>More</strong> &rarr; <strong>Account</strong> &rarr;{' '}
                <strong>Account management</strong>.
              </li>
              <li>
                Tap <strong>Delete Auvora account</strong>.
              </li>
              <li>
                Review the self-custody and recovery warnings. If you have a wallet, ensure you can
                independently recover it before continuing. Auvora will not display or transmit your
                recovery phrase during deletion.
              </li>
              <li>
                Re-authenticate with your account password, type <strong>DELETE</strong> to confirm,
                and complete device authentication when prompted.
              </li>
            </ol>
          </div>

          <div>
            <h3>Option 2: External request (no app required)</h3>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
              If you cannot use the app, email{' '}
              <a
                href="mailto:privacy@auvorawallet.com?subject=Account%20Deletion%20Request"
                style={{ color: 'var(--color-accent, #20808D)', textDecoration: 'underline' }}
              >
                privacy@auvorawallet.com
              </a>{' '}
              from the email address registered to your Auvora account with the subject{' '}
              <strong>&quot;Account Deletion Request&quot;</strong>. We verify ownership and process
              the same deletion workflow used in-app. External requests are typically completed
              within 30 days after verification.
            </p>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>What Is Deleted, Anonymized, or Retained</h2>
        <div style={{ display: 'grid', gap: '1rem', marginTop: '0.75rem' }}>
          <div style={{ borderLeft: '3px solid #20808D', paddingLeft: '1rem' }}>
            <h3>Deleted or anonymized (Auvora-controlled)</h3>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
              <li>Account profile identifiers (email and username are anonymized / tombstoned).</li>
              <li>Active sessions, refresh tokens, and device registrations.</li>
              <li>Cloud encrypted wallet backup vault (when present and policy allows).</li>
              <li>Notification preferences and MFA credentials tied to the account.</li>
              <li>Unverified KYC drafts and temporary verification input.</li>
            </ul>
          </div>

          <div style={{ borderLeft: '3px solid #E59866', paddingLeft: '1rem' }}>
            <h3>May be retained (compliance / security)</h3>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
              <li>
                Verified or in-review KYC / identification records may be retained subject to
                applicable legal or compliance requirements. Duration is not fixed on this page —
                marked <strong>KYC RETENTION — LEGAL REVIEW REQUIRED</strong> until counsel confirms
                policy.
              </li>
              <li>Security audit and login history needed to investigate abuse or fraud.</li>
            </ul>
          </div>

          <div style={{ borderLeft: '3px solid #888', paddingLeft: '1rem' }}>
            <h3>Cannot be deleted (public blockchain)</h3>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.5 }}>
              Transactions broadcast to public networks (for example Bitcoin, Ethereum, Solana,
              Polygon, BNB Smart Chain, and Tron) remain on those networks. Auvora cannot modify or
              erase them.
            </p>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>After deletion</h2>
        <p style={{ lineHeight: 1.6 }}>
          A successfully deleted account cannot sign in again with the previous credentials.
          On-device wallets are not automatically removed; use the separate “remove wallet from this
          device” action if you want local keys cleared.
        </p>
      </section>

      <section className="cx-panel">
        <h2>Questions</h2>
        <p>
          Contact{' '}
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
