'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { DonutChart } from '../charts/Charts';
import { formatApiError } from '../../lib/api-client';
import { nftFetch } from '../../lib/nft/api';
import { DEMO_COLLECTIONS, DEMO_GALLERY, DEMO_NETWORKS } from '../../lib/nft/demo';
import { getWalletLabels, setWalletLabel } from '../../lib/nft/prefs';
import '../../app/nft-experience.css';

export function DigitalAssetsHub(): ReactElement {
  const [count, setCount] = useState(DEMO_GALLERY.filter((i) => !i.isHidden).length);
  const [collections, setCollections] = useState(DEMO_COLLECTIONS.length);
  const [favorites, setFavorites] = useState(DEMO_GALLERY.filter((i) => i.isFavorite).length);
  const [networks, setNetworks] = useState(DEMO_NETWORKS.filter((n) => n.nftSupported).length);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletKey] = useState('primary');
  const [labelDraft, setLabelDraft] = useState('');

  useEffect(() => {
    const labels = getWalletLabels();
    setLabelDraft(labels.primary ?? 'Primary wallet');
    let cancelled = false;
    void (async () => {
      try {
        const [gallery, cols, nets] = await Promise.all([
          nftFetch<Array<{ isFavorite?: boolean; isHidden?: boolean }>>(
            '/api/v1/nfts/gallery?limit=100&includeHidden=true',
          ),
          nftFetch<unknown[]>('/api/v1/nfts/collections'),
          nftFetch<Array<{ nftSupported: boolean }>>('/api/v1/nfts/networks'),
        ]);
        if (cancelled) return;
        if (Array.isArray(gallery)) {
          const visible = gallery.filter((g) => !g.isHidden);
          setCount(visible.length);
          setFavorites(visible.filter((g) => Boolean(g.isFavorite)).length);
          setLive(true);
        }
        if (Array.isArray(cols)) setCollections(cols.length);
        if (Array.isArray(nets)) setNetworks(nets.filter((n) => n.nftSupported).length);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allocation = useMemo(
    () => [
      { label: 'NFTs', value: Math.max(count, 1), color: 'var(--auvora-color-primary)' },
      {
        label: 'Collectibles',
        value: Math.max(Math.round(count * 0.35), 1),
        color: 'var(--auvora-color-info, #84caff)',
      },
      {
        label: 'Tokenized',
        value: Math.max(Math.round(count * 0.15), 1),
        color: 'color-mix(in srgb, var(--auvora-color-text-muted) 55%, transparent)',
      },
    ],
    [count],
  );

  return (
    <div className="nx" role="main">
      <header className="nx__header">
        <div>
          <p className="nx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Digital Assets</h1>
          <p className="nx__sub">
            NFTs, collectibles, and tokenized assets across chains — elegant gallery, collections,
            and activity.
          </p>
        </div>
        <div className="nx-actions">
          <Link href="/nfts">
            <Button type="button">Open gallery</Button>
          </Link>
          <Link href="/nfts/activity">
            <Button type="button" variant="secondary">
              Activity
            </Button>
          </Link>
        </div>
      </header>

      {!live && error ? (
        <Alert tone="warn" title="Preview digital assets">
          Live NFT service unavailable — showing curated hub data. {error}
        </Alert>
      ) : null}

      <div className="nx-kpi" aria-label="Digital asset summary">
        <div className="nx-kpi__card">
          <span>NFTs</span>
          <strong>{count}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Collections</span>
          <strong>{collections}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Favorites</span>
          <strong>{favorites}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Networks</span>
          <strong>{networks}</strong>
        </div>
      </div>

      <section className="nx-panel">
        <h2>Explore</h2>
        <div className="nx-hub-grid">
          <Link className="nx-hub-card" href="/nfts">
            <strong>NFT Gallery</strong>
            <p>Grid, list, compact, and large previews with search and filters.</p>
          </Link>
          <Link className="nx-hub-card" href="/nfts?view=collection">
            <strong>Collections</strong>
            <p>Browse by collection with floor and volume placeholders.</p>
          </Link>
          <Link className="nx-hub-card" href="/nfts?kind=collectibles">
            <strong>Collectibles</strong>
            <p>Curated digital collectibles ready for future expansion.</p>
          </Link>
          <Link className="nx-hub-card" href="/nfts?kind=tokenized">
            <strong>Tokenized assets</strong>
            <p>Architecture reserved for RWAs and tokenized inventory.</p>
          </Link>
          <Link className="nx-hub-card" href="/nfts/activity">
            <strong>NFT activity</strong>
            <p>Received, sent, minted, transferred, and listed (placeholder).</p>
          </Link>
          <Link className="nx-hub-card" href="/portfolio">
            <strong>Portfolio</strong>
            <p>See NFT allocation alongside fungible holdings.</p>
          </Link>
        </div>
      </section>

      <section className="nx-panel">
        <h2>Wallet label</h2>
        <div className="nx-toolbar">
          <label className="nx-field">
            <span>Label for {walletKey}</span>
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              aria-label="Wallet label"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setWalletLabel(walletKey, labelDraft);
            }}
          >
            Save label
          </Button>
        </div>
        <p className="nx-meta">
          Labels stay on this device and help organize multi-wallet NFT views.
        </p>
      </section>

      <section className="nx-panel">
        <h2>Asset allocation</h2>
        {count === 0 ? (
          <EmptyState
            title="No digital assets yet"
            description="Discover NFTs from a wallet address in the gallery to populate this chart."
            action={
              <Link href="/nfts">
                <Button type="button">Go to gallery</Button>
              </Link>
            }
          />
        ) : (
          <DonutChart slices={allocation} ariaLabel="Digital asset allocation" />
        )}
      </section>
    </div>
  );
}
