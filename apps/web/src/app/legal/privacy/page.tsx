'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../../components/legal/LegalShell';

export default function PrivacyPolicyPage(): ReactElement {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How Auvora protects your self-custody privacy, handles identity verification, and secures your data."
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
                security alerts) are transmitted via our transactional email provider (Resend). We
                never send marketing emails without consent.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>3. Identity Verification &amp; Compliance (KYC / AML)</h2>
        <p>
          To prevent financial fraud, terrorism financing, and comply with global anti-money
          laundering (AML) and sanctions regulations, Auvora enforces transfer policies on
          high-value transfers (e.g., identity verification at or above $5,000 USD equivalent).
        </p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Authorized Third-Party Verification Partner</strong>
              <p className="cx-meta">
                Identity verification is performed through our authorized compliance and identity
                verification provider (e.g., Stripe Identity). When initiating verification, you are
                connected directly to the provider&apos;s secure, encrypted hosted environment.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Provider-Hosted Document Processing</strong>
              <p className="cx-meta">
                Your government identity documents (passports, driver&apos;s licenses, national IDs)
                and biometric verification imagery (selfies) are captured and processed directly on
                the compliance provider&apos;s certified infrastructure.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>What Auvora Does NOT Store</strong>
              <p className="cx-meta">
                Auvora does <em>not</em> store unencrypted facial biometric templates, raw selfie
                images, or raw document scans in our databases.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>What Auvora Stores</strong>
              <p className="cx-meta">
                Auvora stores only verification reference identifiers (e.g., external verification
                session IDs), canonical verification status (e.g., Verified, Action Required,
                Rejected), requested verification level, timestamps, and AES-256 field-encrypted
                customer name and date of birth required for legal compliance and sanctions
                screening.
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
                All API communications require TLS 1.3/HTTPS. All sensitive database columns (PII,
                tokens) are encrypted with AES-256 before persistence.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Strict Telemetry &amp; Log Redaction</strong>
              <p className="cx-meta">
                Our application servers automatically redact passwords, tokens, API keys, private
                keys, mnemonics, phone numbers, and identity references from internal logs and
                telemetry.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>5. Account Deletion &amp; Statutory Retention Policy</h2>
        <p>
          You have the right to request deletion of your Auvora account and associated personal data
          at any time:
        </p>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Immediate Deletion</strong>
              <p className="cx-meta">
                For accounts that have not completed formal regulatory identity verification,
                account deletion immediately purges all user profile information, authentication
                sessions, and device links.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Statutory Compliance Retention (Subject to Owner &amp; Legal Review)</strong>
              <p className="cx-meta">
                Where an account has completed identity verification for transactions subject to
                anti-money laundering (AML) and Counter-Terrorist Financing (CTF) regulations (such
                as the Bank Secrecy Act / FinCEN regulations 31 CFR § 1010.410, EU 5AMLD/6AMLD, or
                equivalent local statutes), Auvora is legally mandated to retain customer
                identification records, sanctions screening logs, and transaction audit trails for a
                mandatory statutory retention period [
                <em>
                  Standard statutory window: 5 years following account closure, subject to final
                  legal counsel confirmation
                </em>
                ]. During this period, records are archived, access-controlled, and strictly
                isolated from operational use.
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
