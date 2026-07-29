'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { nftFetch } from '../../lib/nft/api';
import { DEMO_COLLECTIONS, DEMO_GALLERY, type NftCollectionSummary } from '../../lib/nft/demo';
import '../../app/nft-experience.css';

export function NftCollectionExperience(): ReactElement {
  const params = useParams<{ network: string; slug: string }>();
  const [collection, setCollection] = useState<NftCollectionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await nftFetch<NftCollectionSummary>(
          `/api/v1/nfts/collections/${params.network}/${params.slug}`,
        );
        if (cancelled) return;
        setCollection(data);
        setLive(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const demo = DEMO_COLLECTIONS.find(
          (c) => c.network === params.network && c.slug === params.slug,
        );
        if (demo) {
          setCollection({
            ...demo,
            assets: DEMO_GALLERY.filter((g) => g.asset.collection?.slug === demo.slug).map((g) => ({
              id: g.asset.id,
              name: g.asset.name,
              tokenId: g.asset.tokenId,
              imageUrl: g.asset.imageUrl,
            })),
          });
          setLive(false);
        } else {
          setCollection(null);
        }
        setError(formatApiError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.network, params.slug]);

  if (!collection && !error) {
    return (
      <div className="nx" role="main" aria-busy="true" aria-label="Loading collection">
        <div className="nx-skeleton" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="nx" role="main">
        <EmptyState title="Collection not found" description={error ?? ''} />
        <Link href="/nfts?view=collection">
          <Button type="button" variant="secondary">
            Back to collections
          </Button>
        </Link>
      </div>
    );
  }

  const assets = collection.assets ?? [];

  return (
    <div className="nx" role="main">
      <header className="nx__header">
        <div>
          <p className="nx__eyebrow">
            <Link href="/digital-assets">Digital Assets</Link> ·{' '}
            <Link href="/nfts?view=collection">Collections</Link>
          </p>
          <h1>
            {collection.name}
            {collection.verified ? ' ✓' : ''}
          </h1>
          <p className="nx__sub">
            {collection.network} · {collection.standard ?? 'NFT'} · {collection.totalSupply} items
          </p>
        </div>
        <Link href={`/nfts?collection=${collection.slug}`}>
          <Button type="button" variant="secondary">
            Filter gallery
          </Button>
        </Link>
      </header>

      {!live && error ? (
        <Alert tone="warn" title="Preview collection">
          Showing demo collection data while offline.
        </Alert>
      ) : null}

      <div className="nx-banner">
        <img src={collection.logoUrl || '/nft-placeholder.svg'} alt="" />
        <div>
          <strong>{collection.name}</strong>
          <p className="nx-meta">{collection.description || 'No description.'}</p>
        </div>
      </div>

      <div className="nx-kpi" aria-label="Collection statistics">
        <div className="nx-kpi__card">
          <span>Items</span>
          <strong>{collection.totalSupply}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Owners</span>
          <strong>{collection.ownersCount ?? '—'}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Floor (placeholder)</span>
          <strong>{collection.floorPriceUsd != null ? `$${collection.floorPriceUsd}` : '—'}</strong>
        </div>
        <div className="nx-kpi__card">
          <span>Volume (placeholder)</span>
          <strong>
            {collection.volumeUsd != null
              ? `$${Number(collection.volumeUsd).toLocaleString()}`
              : '—'}
          </strong>
        </div>
      </div>

      <section className="nx-panel">
        <h2>Recently added</h2>
        {assets.length === 0 ? (
          <EmptyState
            title="No synced assets"
            description="Discover ownership to populate this collection."
          />
        ) : (
          <ul className="nx-gallery nx-gallery--grid">
            {assets.map((asset) => (
              <li key={asset.id} className="nx-card">
                <Link href={`/nfts/assets/${asset.id}`}>
                  <div className="nx-card__media">
                    <img
                      src={asset.imageUrl || '/nft-placeholder.svg'}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.src.endsWith('/nft-placeholder.svg')) {
                          img.src = '/nft-placeholder.svg';
                        }
                      }}
                    />
                  </div>
                  <div className="nx-card__body">
                    <strong>{asset.name}</strong>
                    <p className="nx-meta">#{asset.tokenId}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
