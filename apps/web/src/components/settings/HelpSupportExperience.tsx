'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ReleaseConfig } from '../../lib/release/config';
import { searchAssist } from '../../lib/intelligence/guidance';
import { OFFLINE_CACHE_NS, writeOfflineCache } from '../../lib/offline/cache';
import { useOnlineStatus } from '../../lib/offline/online-status';
import { fuzzyRank } from '../../lib/search/fuzzy';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const FAQ = [
  {
    q: 'What is an Auvora Account versus a wallet?',
    a: 'An Auvora Account is identity, sessions, and preferences. A wallet is the non-custodial key material on your device. Signing in never sends your private keys or recovery phrase to Auvora.',
  },
  {
    q: 'How do I recover my wallet?',
    a: 'Use your recovery phrase on Import or Recovery. Anyone with the phrase can move funds. Auvora support will never ask for it.',
  },
  {
    q: 'Where do I change theme or currency?',
    a: 'Settings → Preferences. Theme and currency apply on this device.',
  },
  {
    q: 'How do I revoke a connected app?',
    a: 'Open Connections, then disconnect the app. You can do this anytime.',
  },
  {
    q: 'How do I spot a scam?',
    a: 'Auvora never asks for a recovery phrase in email, chat, or a dApp popup. Bookmark official URLs. Review every signature.',
  },
  {
    q: 'What are network fees?',
    a: 'Network fees pay validators to include your transfer. They vary by congestion. Review the fee before you confirm. Confirmed transfers cannot be reversed.',
  },
  {
    q: 'How do I report an issue?',
    a: `Email ${ReleaseConfig.supportEmail}. Never include your recovery phrase or private keys.`,
  },
] as const;

const LINKS = [
  {
    href: '/learn',
    title: 'Security guidance',
    detail: 'Short lessons on wallets, fees, and self-custody',
  },
  {
    href: '/legal',
    title: 'Privacy & terms',
    detail: 'Legal documents for this product',
  },
  {
    href: '/trust',
    title: 'Trust',
    detail: 'How we communicate risk',
  },
  {
    href: '/status',
    title: 'Service status',
    detail: 'Check whether account services are up',
  },
  {
    href: '/settings/security',
    title: 'Security settings',
    detail: 'Backup, devices, and sessions',
  },
  {
    href: '/wallets/recovery',
    title: 'Recovery rehearsal',
    detail: 'Practice backup without sending the phrase anywhere',
  },
  {
    href: `mailto:${ReleaseConfig.supportEmail}`,
    title: 'Contact',
    detail: ReleaseConfig.supportEmail,
  },
] as const;

export function HelpSupportExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const { online } = useOnlineStatus();
  const assist = useMemo(() => searchAssist(query), [query]);
  const faqFiltered = useMemo(() => {
    const q = query.trim();
    if (!q) return [...FAQ];
    return fuzzyRank(q, FAQ, (item) => [item.q, item.a]);
  }, [query]);

  useEffect(() => {
    writeOfflineCache(
      OFFLINE_CACHE_NS.help,
      'faq-bundle',
      FAQ.map((item) => ({ q: item.q, a: item.a })),
      1000 * 60 * 60 * 24 * 14,
    );
  }, []);

  return (
    <PlatformShell
      title="Support"
      subtitle="Help, security guidance, and contact — with honest availability."
      reassure="We will never ask for your recovery phrase or private keys."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/help" />}
    >
      {!online ? (
        <p className="cx-muted" role="status">
          You are offline. This FAQ stays available on the page.
        </p>
      ) : null}
      <section className="cx-panel">
        <h2>Find something</h2>
        <label className="cx-field">
          <span>Search help</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recovery, connections, fees…"
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
        <h2>Help & contact</h2>
        <p className="cx-meta">
          Email support is available at {ReleaseConfig.supportEmail}. This Alpha does not offer 24/7
          live chat.
        </p>
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
    </PlatformShell>
  );
}
