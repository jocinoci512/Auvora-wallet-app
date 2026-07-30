'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import '../../app/core-experience.css';

/**
 * Aether shell for Settings / Security / Web3 / NFT / Help / Notifications.
 * Same Mist/Lagoon language as TransactionShell, without step progress.
 */
export function PlatformShell({
  title,
  subtitle,
  reassure,
  children,
  backHref = '/dashboard',
  backLabel = 'Wallet',
  nav,
  actions,
  wide = true,
}: {
  title: string;
  subtitle?: string;
  reassure?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  nav?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={`cx${wide ? ' cx--wide' : ''}`}>
      <div className="cx-atmosphere" aria-hidden />
      <header className="cx__header">
        <div className="cx-platform__head">
          <div>
            <p className="cx__eyebrow">
              <Link href={backHref}>{backLabel}</Link>
            </p>
            <h1 className="cx__title">{title}</h1>
            {subtitle ? <p className="cx__sub">{subtitle}</p> : null}
            {reassure ? <p className="cx__reassure">{reassure}</p> : null}
          </div>
          {actions ? <div className="cx-platform__actions">{actions}</div> : null}
        </div>
        {nav ? <div className="cx-platform__nav">{nav}</div> : null}
      </header>
      <div className="cx__body">{children}</div>
    </div>
  );
}

export function PlatformCardLink({
  href,
  title,
  detail,
  external,
}: {
  href: string;
  title: string;
  detail: string;
  external?: boolean;
}): ReactElement {
  const className = 'cx-card-link';
  if (external || href.startsWith('mailto:') || href.startsWith('http')) {
    const isHttp = href.startsWith('http');
    return (
      <a
        className={className}
        href={href}
        {...(isHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <strong>{title}</strong>
        <span>{detail}</span>
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </Link>
  );
}
