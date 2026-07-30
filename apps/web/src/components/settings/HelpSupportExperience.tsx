'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const FAQ = [
  {
    q: 'How do I recover my wallet?',
    a: 'Use your recovery phrase on Restore or Recovery. Never share it — Auvora support will never ask for it.',
  },
  {
    q: 'I sent funds to the wrong network. What now?',
    a: 'Wrong-network sends can be irreversible. Check Activity for the hash, then contact the destination exchange if applicable. Prevention: always confirm network on Receive and Send.',
  },
  {
    q: 'How do I revoke a dApp?',
    a: 'Open Web3 → Permissions, or Settings → Connected apps, then revoke the grant. Also disconnect WalletConnect sessions you no longer use.',
  },
  {
    q: 'What is a security score?',
    a: 'A simple health check across PIN, backup, biometrics, devices, and dApp hygiene. Improve each item from Security Center recommendations.',
  },
  {
    q: 'How do I spot a scam?',
    a: 'Auvora never DMs first asking for seed phrases or remote access. Bookmark official URLs. Use address risk warnings on Send.',
  },
] as const;

const LINKS = [
  {
    href: '/status',
    title: 'Service status',
    detail: 'Is Auvora up? Check before you worry',
  },
  {
    href: '/legal',
    title: 'Legal & privacy drafts',
    detail: 'Privacy, terms, and company transparency',
  },
  {
    href: '/trust',
    title: 'Trust & transparency',
    detail: 'How we communicate risk and incidents',
  },
  {
    href: 'mailto:support@auvora.example',
    title: 'Contact support (placeholder)',
    detail: 'Replace with production inbox before public launch — never share your recovery phrase',
  },
  {
    href: 'mailto:security@auvora.example?subject=Issue%20report',
    title: 'Report a problem (placeholder)',
    detail: 'Product or security issue — placeholder address until launch',
  },
  {
    href: '/settings/security',
    title: 'Security tips',
    detail: 'Score, checklist, and recommendations',
  },
  {
    href: '/wallets/recovery',
    title: 'Recovery assistance',
    detail: 'Guided recovery phrase help',
  },
] as const;

export function HelpSupportExperience(): ReactElement {
  return (
    <PlatformShell
      title="Help & support"
      subtitle="Clear answers, recovery help, and scam awareness — in human language."
      reassure="We will never ask for your recovery phrase or private keys."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/help" />}
    >
      <section className="cx-panel">
        <h2>FAQ</h2>
        <div className="cx-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cx-panel">
        <h2>Support & education</h2>
        <div className="cx-card-grid">
          {LINKS.map((l) => (
            <PlatformCardLink
              key={l.title}
              href={l.href}
              title={l.title}
              detail={l.detail}
              external={l.href.startsWith('mailto:')}
            />
          ))}
        </div>
      </section>

      <section className="cx-panel">
        <h2>Legal</h2>
        <p className="cx-meta">
          Terms and privacy policy ship with your distribution. Contact support if you need the
          latest copies for your region.
        </p>
        <div className="cx-platform__actions">
          <Link href="/settings/security" className="cx-btn cx-btn--ghost">
            Security Center
          </Link>
          <Link href="/web3" className="cx-btn cx-btn--ghost">
            Web3 Hub
          </Link>
          <Link href="/notifications" className="cx-btn cx-btn--ghost">
            Notification center
          </Link>
        </div>
      </section>
    </PlatformShell>
  );
}
