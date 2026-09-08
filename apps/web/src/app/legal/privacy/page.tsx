'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../../components/legal/LegalShell';

export default function PrivacyPolicyPage(): ReactElement {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How Auvora protects your self-custody privacy, handles first-party identity verification, and secures your data."
      current="/legal/privacy"
    >
      <section className="cx-panel">
        <h2>1. Core Principles: Self-Custody First</h2>
        <p>
          Auvora is built as a non-custodial (self-custody) cryptocurrency wallet. The fundamental
          tenet of our architecture is that your private keys and recovery phrases belong solely to
          you:
        </p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>On-Device Vault Isolation</strong>
              <p className="cx-meta">
                Your private keys, mnemonics, seed phrases, and biometric secrets are generated and
                stored exclusively in platform-native secure hardware storage (such as iOS Keychain
                or Android KeyStore). They never leave your device, are never transmitted over the
                network, and are never accessible to Auvora servers or staff.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>No Server-Side Signing</strong>
              <p className="cx-meta">
                All transaction signing occurs locally on your hardware. Auvora cannot access, move,
                freeze, or confiscate your on-chain assets.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>2. Data We Collect &amp; Process</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Account &amp; Authentication Information</strong>
              <p className="cx-meta">
                If you choose to register for an optional Auvora cloud sync or notification account,
                we collect your email address, hashed credentials (Argon2id), session identifiers,
                and device metadata (e.g., client platform, OS version, coarse device fingerprint)
                to secure your account and prevent abuse.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Blockchain Read Operations</strong>
              <p className="cx-meta">
                When you inspect balances or transactions, public blockchain addresses are sent via
                secure HTTPS to node infrastructure providers (such as Alchemy). No private keys or
                recovery words are ever included.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Transactional Email &amp; Communications</strong>
              <p className="cx-meta">
                Critical account security notices (verification links, password reset tokens,
                compliance status updates) are transmitted via our transactional email provider
                (Resend). We never send marketing emails without consent.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>3. Identity Verification &amp; Compliance (First-Party Admin Review)</h2>
        <p>
          To prevent financial fraud, terrorism financing, and comply with applicable anti-money
          laundering (AML) and sanctions regulations, Auvora enforces transfer policies on
          high-value transfers (e.g., identity verification required for transfers of $5,000 USD
          equivalent or more, and administrative review for transfers of $10,000 USD or more).
        </p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>First-Party Manual Verification by Authorized Personnel</strong>
              <p className="cx-meta">
                Auvora does NOT use external commercial KYC verification providers (such as Stripe
                Identity, Persona, Veriff, or Sumsub). Customer identity documents are submitted
                directly and securely to Auvora's encrypted compliance backend for manual review by
                authorized Auvora administrators.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>What We Collect for Verification</strong>
              <p className="cx-meta">
                When initiating verification, customers provide legal name, date of birth, country
                of residence, ID type (passport, national ID card, driver's license, or residence
                permit), ID document number, expiration date, and encrypted image files of the
                government ID.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Secure Document Storage &amp; Encryption at Rest</strong>
              <p className="cx-meta">
                Government ID images are never stored in plain text or raw database columns. All
                document binaries are sanitized (stripping unnecessary EXIF/GPS metadata), validated
                against malicious file structures, and encrypted at rest using server-side
                AES-256-GCM encryption before storage. Documents are never exposed through permanent
                public URLs.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Strict Role-Based Access Control &amp; Short-Lived Access</strong>
              <p className="cx-meta">
                Only authorized Super Administrators have permission to review government ID
                documents. Support agents and general staff are strictly blocked. Viewing documents
                requires ephemeral, short-lived signed tokens, and every document access is
                immutably audited.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>4. Data Security</h2>
        <p>We implement industry-standard cryptographic and architectural defenses:</p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Encryption in Transit &amp; at Rest</strong>
              <p className="cx-meta">
                All API communications require TLS 1.3/HTTPS. Sensitive database columns (PII,
                tokens, ID numbers) are encrypted with AES-256 before persistence. Document
                encryption keys remain strictly server-side and completely separate from customer
                self-custody wallet vaults.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Strict Telemetry &amp; Log Redaction</strong>
              <p className="cx-meta">
                Our application servers automatically redact passwords, tokens, API keys, private
                keys, mnemonics, phone numbers, ID numbers, document binaries, and signed URLs from
                internal logs and telemetry.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>5. Account Deletion &amp; Data Retention Policy</h2>
        <p>
          You have the right to request deletion of your Auvora account and associated personal data
          at any time:
        </p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Immediate Deletion for Unverified Accounts</strong>
              <p className="cx-meta">
                For accounts that have not completed formal regulatory identity verification,
                account deletion immediately purges all user profile information, authentication
                sessions, draft records, and device links.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>
                Configurable Retention &amp; Audit Records (Subject to Legal Confirmation)
              </strong>
              <p className="cx-meta">
                Where an account has completed identity verification for high-value transactions,
                applicable AML/CTF regulations require retention of identification records and audit
                logs. Raw ID document images and audit logs are managed under distinct, configurable
                retention policies. Formal statutory retention durations remain subject to final
                confirmation by legal counsel prior to public launch. During any applicable
                retention period, records remain encrypted, access-controlled, and strictly isolated
                from operational use.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>6. Your Privacy Controls</h2>
        <p>
          You can review your active sessions, revoke connected devices, and manage data settings at
          any time in the <Link href="/settings/privacy">Privacy Center</Link>.
        </p>
        <p className="cx-meta">
          For privacy inquiries or data subject access requests, please contact
          privacy@auvorawallet.com.
        </p>
      </section>
    </LegalShell>
  );
}
