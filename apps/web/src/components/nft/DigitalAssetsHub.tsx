'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';

const LINKS = [
  {
    href: '/nfts',
    title: 'NFT Gallery',
    detail: 'Grid, list, compact, and large previews with search and filters.',
  },
  {
    href: '/nfts?view=collection',
    title: 'Collections',
    detail: 'Browse by collection with floor and volume placeholders.',
  },
  {
    href: '/nfts?kind=collectibles',
    title: 'Collectibles',
    detail: 'Curated digital collectibles ready for future expansion.',
  },
  {
    href: '/nfts?kind=tokenized',
    title: 'Tokenized assets',
    detail: 'Architecture reserved for RWAs and tokenized inventory.',
  },
  {
    href: '/nfts/activity',
    title: 'NFT activity',
    detail: 'Received, sent, minted, transferred, and listed (placeholder).',
  },
  {
    href: '/portfolio',
    title: 'Portfolio',
    detail: 'See NFT allocation alongside fungible holdings.',
  },
] as const;

/** Landing hub — primary path is the NFT gallery at /nfts. */
export function DigitalAssetsHub(): ReactElement {
  return (
    <PlatformShell
      title="Digital Assets"
      subtitle="NFTs, collectibles, and tokenized assets — open the gallery to browse your holdings."
      reassure="Hide spam and favor verified collections when you explore."
      backHref="/dashboard"
      backLabel="Wallet"
      actions={
        <>
          <Link href="/nfts" className="cx-btn cx-btn--primary">
            Open gallery
          </Link>
          <Link href="/nfts/activity" className="cx-btn cx-btn--ghost">
            Activity
          </Link>
        </>
      }
    >
      <section className="cx-panel">
        <h2>Explore collectibles</h2>
        <p className="cx-meta">
          Digital Assets now lives in the Collectibles gallery. Pick a destination below or open the
          gallery directly.
        </p>
        <div className="cx-card-grid">
          {LINKS.map((link) => (
            <PlatformCardLink
              key={link.href}
              href={link.href}
              title={link.title}
              detail={link.detail}
            />
          ))}
        </div>
      </section>
    </PlatformShell>
  );
}
