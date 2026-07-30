'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { LEGAL_DISCLAIMER } from '../../lib/brand/voice';
import { PlatformShell } from '../platform/PlatformShell';

const LEGAL_NAV = [
  { href: '/legal', label: 'Overview' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/trust', label: 'Trust & transparency' },
  { href: '/status', label: 'Status' },
] as const;

export function LegalNav({ current }: { current: string }): ReactElement {
  return (
    <nav className="cx-tabs" aria-label="Legal and trust">
      {LEGAL_NAV.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={current === link.href ? 'is-active' : undefined}
          aria-current={current === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalShell({
  title,
  subtitle,
  current,
  children,
}: {
  title: string;
  subtitle: string;
  current: string;
  children: ReactNode;
}): ReactElement {
  return (
    <PlatformShell
      title={title}
      subtitle={subtitle}
      reassure="You control your keys. We explain what we collect and why — without pressure."
      backHref="/settings"
      backLabel="Settings"
      nav={<LegalNav current={current} />}
    >
      <div className="cx-alert cx-alert--info" role="status">
        {LEGAL_DISCLAIMER}
      </div>
      {children}
    </PlatformShell>
  );
}
