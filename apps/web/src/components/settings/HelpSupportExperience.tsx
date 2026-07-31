'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { searchAssist } from '../../lib/intelligence/guidance';
import { OFFLINE_CACHE_NS, writeOfflineCache } from '../../lib/offline/cache';
import { useOnlineStatus } from '../../lib/offline/online-status';
import { fuzzyRank } from '../../lib/search/fuzzy';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const FAQ = [
  {
    q: 'How do I recover my wallet?',
    a: 'Use your recovery phrase on Restore or Recovery. Your recovery phrase is the master key to your wallet. Never share it — Auvora support will never ask for it.',
  },
  {
    q: 'Where do I change theme or currency?',
    a: 'Settings → Appearance (or Wallet & appearance). Theme updates instantly. Currency and date formats live there too.',
  },
  {
    q: 'Why don’t I get push notifications?',
    a: 'This release uses an in-app Notification Center and local preferences. You can still prepare OS permission on mobile. Every alert category can be toggled independently.',
  },
  {
    q: 'Are price alerts live?',
    a: 'Alerts are stored on this device and evaluate against preview prices when you tap Check now — not live markets.',
  },
  {
    q: 'How do I revoke a dApp?',
    a: 'Open Web3 → Permissions, or Settings → Connected apps, then revoke the grant. You can disconnect this application at any time.',
  },
  {
    q: 'How do I spot a scam?',
    a: 'Auvora never DMs first asking for seed phrases. Bookmark official URLs. Review every connection and signature.',
  },
  {
    q: 'What is Auvora Intelligence?',
    a: 'Plain-language guidance on fees, security prompts, and portfolio notes. It educates quietly — it never recommends trades or moves funds. Adjust how much you see in Privacy → Guidance.',
  },
  {
    q: 'What are gas fees?',
    a: 'Network fees pay validators to include your transfer. They vary by congestion and are separate from any Auvora product fee. Review the fee before you confirm. This transaction cannot be reversed after confirmation.',
  },
  {
    q: 'How do I report an issue?',
    a: 'Use Alpha feedback in Settings → Support. Never include your recovery phrase in any report.',
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
    href: '/settings/feedback',
    title: 'Alpha feedback',
    detail: 'Bug, UX, performance, security, accessibility — local until you share',
  },
  {
    href: '/settings/feedback',
    title: 'Report a security concern',
    detail: 'Use the Security category. Never share your recovery phrase in any channel.',
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
      title="Help & support"
      subtitle="Clear answers, recovery help, and scam awareness — in human language."
      reassure="We will never ask for your recovery phrase or private keys."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/help" />}
    >
      {!online ? (
        <p className="cx-muted" role="status">
          You are offline. FAQ on this page stays available from the bundled copy; cached help
          titles refresh when you reconnect.
        </p>
      ) : null}
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
