'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { explorerUrl, nftFetch } from '../../lib/nft/api';
import { DEMO_ACTIVITY, DEMO_GALLERY, type NftGalleryItem } from '../../lib/nft/demo';
import { detectMediaKind, mediaLabel } from '../../lib/nft/media';
import { copyText, pushRecentlyViewed, shareAssetUrl } from '../../lib/nft/prefs';
import { NftMediaViewer } from './NftMediaViewer';
import '../../app/nft-experience.css';

type AssetDetail = {
  isFavorite: boolean;
  isHidden: boolean;
  verifiedAt?: string | null;
  asset: NftGalleryItem['asset'] & {
    description?: string;
    standard?: string;
    contractAddress?: string;
    mediaCache?: Array<{ kind: string; status: string; cachedUrl?: string | null }>;
  };
};

function toDetail(item: NftGalleryItem): AssetDetail {
  return {
    isFavorite: item.isFavorite,
    isHidden: item.isHidden,
    verifiedAt: null,
    asset: item.asset,
  };
}

export function NftDetailExperience(): ReactElement {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      try {
        const data = await nftFetch<AssetDetail>(`/api/v1/nfts/assets/${assetId}`);
        if (signal?.cancelled) return;
        setDetail(data);
        setLive(true);
        setError(null);
      } catch (err) {
        if (signal?.cancelled) return;
        const demo = DEMO_GALLERY.find((g) => g.asset.id === assetId);
        if (demo) {
          setDetail(toDetail(demo));
          setLive(false);
          setError(formatApiError(err));
        } else {
          setDetail(null);
          setError(formatApiError(err));
        }
      }
    },
    [assetId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    pushRecentlyViewed(assetId);
    return () => {
      signal.cancelled = true;
    };
  }, [load, assetId]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function patch(
    path: string,
    body: { isFavorite?: boolean; isHidden?: boolean },
  ): Promise<void> {
    setBusy(true);
    try {
      if (live) {
        await nftFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
        await load();
      } else if (detail) {
        setDetail({
          ...detail,
          isFavorite: body.isFavorite ?? detail.isFavorite,
          isHidden: body.isHidden ?? detail.isHidden,
        });
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshMetadata(): Promise<void> {
    setBusy(true);
    try {
      if (live) {
        await nftFetch(`/api/v1/nfts/assets/${assetId}/refresh-metadata`, {
          method: 'POST',
          body: '{}',
        });
        await load();
      }
      setToast('Metadata refresh requested');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const traits = useMemo(() => {
    const t = detail?.asset.traits;
    if (!t) return [];
    if (Array.isArray(t)) return t;
    return Object.entries(t).map(([trait_type, value]) => ({
      trait_type,
      value: String(value),
    }));
  }, [detail]);

  const activity = useMemo(() => DEMO_ACTIVITY.filter((a) => a.assetId === assetId), [assetId]);

  if (!detail && !error) {
    return (
      <div className="nx" role="main" aria-busy="true" aria-label="Loading asset">
        <div className="nx-skeleton" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="nx" role="main">
        <EmptyState title="Asset not found" description={error ?? 'Unknown asset'} />
        <Link href="/nfts">
          <Button type="button" variant="secondary">
            Back to gallery
          </Button>
        </Link>
      </div>
    );
  }

  const a = detail.asset;
  const kind = detectMediaKind(a);
  const explore = a.contractAddress ? explorerUrl(a.network, a.contractAddress, a.tokenId) : null;

  return (
    <div className="nx" role="main">
      <header className="nx__header">
        <div>
          <p className="nx__eyebrow">
            <Link href="/nfts">Gallery</Link>
            {a.collection ? (
              <>
                {' · '}
                <Link
                  href={`/nfts/collections/${a.collection.network ?? a.network}/${a.collection.slug}`}
                >
                  {a.collection.name}
                </Link>
              </>
            ) : null}
          </p>
          <h1>{a.name}</h1>
          <p className="nx__sub">
            {a.network} · {a.standard ?? 'NFT'} · Token #{a.tokenId} · {mediaLabel(kind)}
          </p>
        </div>
      </header>

      {!live && error ? (
        <Alert tone="warn" title="Preview asset">
          Showing demo detail while the NFT service is offline.
        </Alert>
      ) : null}
      {toast ? (
        <Alert tone="info" title="Updated">
          {toast}
        </Alert>
      ) : null}

      <div className="nx-detail">
        <NftMediaViewer
          name={a.name}
          imageUrl={a.imageUrl}
          videoUrl={a.videoUrl}
          animationUrl={a.animationUrl}
          audioUrl={a.audioUrl}
          modelUrl={a.modelUrl}
        />

        <div>
          <section className="nx-panel">
            <h2>About</h2>
            <p>{a.description || 'No description provided.'}</p>
            <dl>
              <div className="nx-meta">Creator / collection: {a.collection?.name ?? '—'}</div>
              <div className="nx-meta">Owner: Connected wallet (verified when live)</div>
              <div className="nx-meta">Contract: {a.contractAddress ?? '—'}</div>
              <div className="nx-meta">
                Rarity:{' '}
                {a.rarityRank != null
                  ? `#${a.rarityRank}${a.rarityScore != null ? ` · score ${a.rarityScore}` : ''}`
                  : '—'}
              </div>
              <div className="nx-meta">
                Status:{' '}
                {detail.isHidden ? (
                  <StatusBadge status="archived" label="Hidden" />
                ) : detail.isFavorite ? (
                  <StatusBadge status="active" label="Favorite" />
                ) : (
                  <StatusBadge status="pending" label="Visible" />
                )}
              </div>
            </dl>
            <div className="nx-actions" style={{ marginTop: '0.85rem' }}>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void patch(`/api/v1/nfts/assets/${assetId}/favorite`, {
                    isFavorite: !detail.isFavorite,
                  })
                }
              >
                {detail.isFavorite ? 'Unfavorite' : 'Favorite'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void patch(`/api/v1/nfts/assets/${assetId}/hidden`, {
                    isHidden: !detail.isHidden,
                  })
                }
              >
                {detail.isHidden ? 'Unhide' : 'Hide'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void refreshMetadata()}
              >
                Refresh metadata
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void copyText(shareAssetUrl(`/nfts/assets/${assetId}`)).then((ok) =>
                    setToast(ok ? 'Link copied' : 'Copy failed'),
                  )
                }
              >
                Copy link
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const url = shareAssetUrl(`/nfts/assets/${assetId}`);
                  if (navigator.share) {
                    void navigator.share({ title: a.name, url }).catch(() => undefined);
                  } else {
                    void copyText(url).then(() => setToast('Share link copied'));
                  }
                }}
              >
                Share
              </Button>
              {explore ? (
                <a className="nx-meta" href={explore} target="_blank" rel="noreferrer">
                  Open explorer
                </a>
              ) : null}
            </div>
          </section>

          <section className="nx-panel">
            <h2>Traits & attributes</h2>
            {traits.length === 0 ? (
              <p className="nx-meta">No traits published.</p>
            ) : (
              <ul className="nx-traits">
                {traits.map((t, i) => (
                  <li key={`${t.trait_type}-${i}`}>
                    <span>{t.trait_type ?? 'Trait'}</span>
                    <strong>{t.value ?? '—'}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nx-panel">
            <h2>Transaction history</h2>
            {activity.length === 0 ? (
              <p className="nx-meta">No local activity for this asset yet.</p>
            ) : (
              <ul className="nx-timeline">
                {activity.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{row.title}</strong>
                      <p className="nx-meta">{row.detail}</p>
                    </div>
                    <StatusBadge
                      status={row.status === 'confirmed' ? 'active' : 'pending'}
                      label={row.kind}
                    />
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: '0.75rem' }}>
              <Link href="/nfts/activity">View all NFT activity</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
