'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { issueCopy, type AppIssue } from '../../lib/dashboard/status-copy';
import '../../app/consumer.css';

export function AppIssuePanel({
  kind,
  title,
  body,
  primaryHref = '/auth/login',
  primaryLabel = 'Sign in',
  secondaryHref = '/dashboard',
  secondaryLabel = 'Back to wallet',
}: {
  kind?: AppIssue;
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}): ReactElement {
  const copy = kind
    ? issueCopy(kind)
    : { title: title ?? 'Something went wrong', body: body ?? '' };
  const warn =
    kind === 'session' || kind === 'locked' || kind === 'suspended' || kind === 'revoked';
  return (
    <div className="as">
      <div className={`as-issue ${warn ? 'as-issue--warn' : 'as-issue--error'}`}>
        <h1 className="as__title">{title ?? copy.title}</h1>
        <p className="as__lede">{body ?? copy.body}</p>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link className="as-btn as-btn--primary" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="as-btn as-btn--ghost" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
