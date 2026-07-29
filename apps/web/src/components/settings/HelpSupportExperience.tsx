'use client';

import { Button } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

const LINKS = [
  { href: '/status', title: 'FAQ / Status', detail: 'Platform status and common questions entry' },
  {
    href: 'mailto:support@auvora.example',
    title: 'Contact support',
    detail: 'Email support (placeholder)',
  },
  { href: '/design-system', title: 'Documentation', detail: 'In-app design system & docs gallery' },
  {
    href: 'mailto:security@auvora.example?subject=Issue%20report',
    title: 'Report issue',
    detail: 'File a product or security issue',
  },
  {
    href: '/settings',
    title: 'Security resources',
    detail: 'Return to Security Center recommendations',
  },
] as const;

export function HelpSupportExperience(): ReactElement {
  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Help & support</h1>
          <p className="sc__sub">
            FAQ entry, contact, documentation, issue reporting, and security resources.
          </p>
        </div>
      </header>
      <SettingsSectionNav current="/settings/help" />

      <div className="sc-grid">
        {LINKS.map((l) =>
          l.href.startsWith('mailto:') ? (
            <a key={l.title} className="sc-card" href={l.href}>
              <strong>{l.title}</strong>
              <p className="sc-meta">{l.detail}</p>
            </a>
          ) : (
            <Link key={l.title} className="sc-card" href={l.href}>
              <strong>{l.title}</strong>
              <p className="sc-meta">{l.detail}</p>
            </Link>
          ),
        )}
      </div>

      <section className="sc-panel">
        <h2>Quick links</h2>
        <div className="sc-actions">
          <Link href="/wallets/recovery">
            <Button type="button" variant="secondary">
              Recovery help
            </Button>
          </Link>
          <Link href="/web3">
            <Button type="button" variant="secondary">
              Web3 Hub
            </Button>
          </Link>
          <Link href="/notifications">
            <Button type="button" variant="secondary">
              Notifications inbox
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
