'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { searchAssist } from '../../lib/intelligence/guidance';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const FAQ = [
  {
    q: 'How do I recover my wallet?',
    a: 'Use your recovery phrase on Restore or Recovery. Never share it — Auvora support will never ask for it.',
  },
  {
    q: 'Where do I change theme or currency?',
    a: 'Settings → Wallet & appearance. Theme updates instantly. Currency and date formats live there too.',
  },
  {
    q: 'Why don’t I get push notifications?',
    a: 'This release uses an in-app Notification Center and local preferences only. Push delivery comes later.',
  },
  {
    q: 'Are price alerts live?',
    a: 'Alerts are stored on this device and evaluate against preview prices when you tap Check now — not live markets.',
  },
  {
    q: 'How do I revoke a dApp?',
    a: 'Open Web3 → Permissions, or Settings → Connected apps, then revoke the grant.',
  },
  {
    q: 'How do I spot a scam?',
    a: 'Auvora never DMs first asking for seed phrases. Bookmark official URLs. Review every connection and signature.',
  },
  {
    q: 'What is Auvora Intelligence?',
    a: 'Plain-language guidance on fees, security prompts, and portfolio notes. It educates — it never recommends trades or moves funds. Adjust how much you see in Privacy → Guidance.',
  },
] as const;

const LINKS = [
  {
    href: '/learn',
    title: 'Learning Center',
    detail: 'Short lessons on wallets, fees, and networks',
  },
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
  const [query, setQuery] = useState('');
  const assist = useMemo(() => searchAssist(query), [query]);
  const faqFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
    );
  }, [query]);

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
        <h2>Find something</h2>
        <label className="cx-field">
          <span>Search help, settings, or lessons</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fees, recovery, permissions…"
            aria-label="Search help"
          />
        </label>
        {assist.length > 0 ? (
          <ul className="cx-list" style={{ marginTop: '0.75rem' }}>
            {assist.map((hit) => (
              <li key={hit.id}>
                <div>
                  <strong>{hit.title}</strong>
                  <p className="cx-meta">{hit.subtitle}</p>
                </div>
                <Link href={hit.href} className="cx-btn cx-btn--ghost">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="cx-panel">
        <h2>FAQ</h2>
        <div className="cx-faq">
          {faqFiltered.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          {faqFiltered.length === 0 ? (
            <p className="cx-meta">No FAQ matches. Try another word.</p>
          ) : null}
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
