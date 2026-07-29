'use client';

import { Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { DEMO_ACTIVITY, type NftActivityKind } from '../../lib/nft/demo';
import '../../app/nft-experience.css';

const FILTERS: Array<'all' | NftActivityKind> = [
  'all',
  'received',
  'sent',
  'minted',
  'transferred',
  'listed',
];

export function NftActivityExperience(): ReactElement {
  const [filter, setFilter] = useState<'all' | NftActivityKind>('all');

  const rows = useMemo(() => {
    const list = filter === 'all' ? DEMO_ACTIVITY : DEMO_ACTIVITY.filter((r) => r.kind === filter);
    return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [filter]);

  return (
    <div className="nx" role="main">
      <header className="nx__header">
        <div>
          <p className="nx__eyebrow">
            <Link href="/digital-assets">Digital Assets</Link>
          </p>
          <h1>NFT activity</h1>
          <p className="nx__sub">
            Timeline of received, sent, minted, transferred, and listed (placeholder) events.
          </p>
        </div>
        <Link href="/activity">
          <Button type="button" variant="secondary">
            Full activity
          </Button>
        </Link>
      </header>

      <div className="nx__tabs" role="group" aria-label="Activity filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`nx__tab ${filter === f ? 'nx__tab--on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f[0]!.toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <section className="nx-panel">
        {rows.length === 0 ? (
          <EmptyState
            title="No NFT activity"
            description="Transfers and mints will appear here as your gallery syncs."
          />
        ) : (
          <ol className="nx-timeline">
            {rows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.title}</strong>
                  <p className="nx-meta">
                    {row.detail} · {new Date(row.timestamp).toLocaleString()}
                  </p>
                  {row.assetId ? (
                    <p className="nx-meta">
                      <Link href={`/nfts/assets/${row.assetId}`}>View asset</Link>
                    </p>
                  ) : null}
                </div>
                <StatusBadge
                  status={row.status === 'confirmed' ? 'active' : 'pending'}
                  label={row.kind}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
