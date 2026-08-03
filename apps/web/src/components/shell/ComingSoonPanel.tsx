'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { FeatureStatusBadge } from './FeatureStatusBadge';

export function ComingSoonPanel({
  title,
  children,
  href = '/dashboard',
}: {
  title: string;
  children?: ReactNode;
  href?: string;
}): ReactElement {
  return (
    <section className="auv-soon" aria-labelledby="auv-soon-title">
      <div className="auv-soon__head">
        <h1 id="auv-soon-title">{title}</h1>
        <FeatureStatusBadge status="COMING_SOON" />
      </div>
      <p className="auv-soon__body">
        This surface is part of the Auvora roadmap. Preview UI may exist below, but it does not move
        funds and live broadcast remains off.
      </p>
      {children}
      <p>
        <Link href={href}>Back to overview</Link>
        {' · '}
        <Link href="/web3/pair">Pair mobile for signing</Link>
      </p>
    </section>
  );
}
