'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { formatApiError } from '../../lib/api-client';
import { nftFetch } from '../../lib/nft/api';
import {
  DEMO_COLLECTIONS,
  DEMO_GALLERY,
  DEMO_NETWORKS,
  type NftCollectionSummary,
  type NftGalleryItem,
} from '../../lib/nft/demo';
import { listRecentlyViewed } from '../../lib/nft/prefs';
import { PlatformShell } from '../platform/PlatformShell';
import '../../app/nft-experience.css';

type ViewMode = 'grid' | 'list' | 'compact' | 'large' | 'collection';
type SortMode = 'name_asc' | 'name_desc' | 'recent' | 'acquired' | 'viewed';

const VIEW_MODES: ViewMode[] = ['grid', 'list', 'compact', 'large', 'collection'];
const SORT_MODES: SortMode[] = ['name_asc', 'name_desc', 'recent', 'acquired', 'viewed'];

function parseView(raw: string | null): ViewMode {
  return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : 'grid';
}

function parseSort(raw: string): SortMode {
  return SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : 'name_asc';
}

function traitsText(item: NftGalleryItem): string {
  const t = item.asset.traits;
  if (!t) return '';
  if (Array.isArray(t)) {
    return t
      .map((x) => `${x.trait_type ?? ''} ${x.value ?? ''}`)
      .join(' ')
      .toLowerCase();
  }
  return Object.entries(t)
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(' ')
    .toLowerCase();
}

function onThumbError(e: { currentTarget: HTMLImageElement }): void {
  const img = e.currentTarget;
  if (!img.src.endsWith('/nft-placeholder.svg')) img.src = '/nft-placeholder.svg';
}

export function NftGalleryExperience(): ReactElement {
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind');
  const collectionParam = searchParams.get('collection') ?? '';

  const [networks, setNetworks] = useState(DEMO_NETWORKS);
  const [items, setItems] = useState<NftGalleryItem[]>(DEMO_GALLERY);
  const [collections, setCollections] = useState<NftCollectionSummary[]>(DEMO_COLLECTIONS);
  const [network, setNetwork] = useState('ETHEREUM');
  const [collectionSlug, setCollectionSlug] = useState(collectionParam);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [traitQ, setTraitQ] = useState('');
  const deferredTrait = useDeferredValue(traitQ);
  const [sort, setSort] = useState<SortMode>('name_asc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [recentlyViewedOnly, setRecentlyViewedOnly] = useState(false);
  const [view, setView] = useState<ViewMode>(() => parseView(searchParams.get('view')));
  const [ownerAddress, setOwnerAddress] = useState('0x1111111111111111111111111111111111111111');
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [viewed, setViewed] = useState<string[]>([]);

  useEffect(() => {
    setViewed(listRecentlyViewed());
  }, []);

  useEffect(() => {
    setView(parseView(searchParams.get('view')));
  }, [searchParams]);

  useEffect(() => {
    setCollectionSlug(collectionParam);
  }, [collectionParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (network) params.set('network', network);
        if (collectionSlug) params.set('collectionSlug', collectionSlug);
        if (deferredQ) params.set('q', deferredQ);
        if (sort === 'name_asc' || sort === 'name_desc' || sort === 'recent')
          params.set('sort', sort);
        if (favoritesOnly) params.set('favoritesOnly', 'true');
        if (includeHidden) params.set('includeHidden', 'true');
        params.set('limit', '120');
        const data = await nftFetch<NftGalleryItem[]>(`/api/v1/nfts/gallery?${params.toString()}`);
        if (cancelled) return;
        if (Array.isArray(data) && data.length) {
          setItems(data);
          setLive(true);
          setError(null);
        } else {
          setItems(DEMO_GALLERY);
          setLive(false);
        }
      } catch (err) {
        if (cancelled) return;
        setItems(DEMO_GALLERY);
        setLive(false);
        setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network, collectionSlug, deferredQ, sort, favoritesOnly, includeHidden]);

  const reloadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (network) params.set('network', network);
      if (collectionSlug) params.set('collectionSlug', collectionSlug);
      if (deferredQ) params.set('q', deferredQ);
      if (sort === 'name_asc' || sort === 'name_desc' || sort === 'recent')
        params.set('sort', sort);
      if (favoritesOnly) params.set('favoritesOnly', 'true');
      if (includeHidden) params.set('includeHidden', 'true');
      params.set('limit', '120');
      const data = await nftFetch<NftGalleryItem[]>(`/api/v1/nfts/gallery?${params.toString()}`);
      if (Array.isArray(data) && data.length) {
        setItems(data);
        setLive(true);
        setError(null);
      } else {
        setItems(DEMO_GALLERY);
        setLive(false);
      }
    } catch (err) {
      setItems(DEMO_GALLERY);
      setLive(false);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [network, collectionSlug, deferredQ, sort, favoritesOnly, includeHidden]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nets = await nftFetch<typeof DEMO_NETWORKS>('/api/v1/nfts/networks');
        if (!cancelled && Array.isArray(nets) && nets.length) setNetworks(nets);
      } catch {
        /* demo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cols = await nftFetch<NftCollectionSummary[]>(
          `/api/v1/nfts/collections?network=${network}`,
        );
        if (!cancelled && Array.isArray(cols) && cols.length) setCollections(cols);
      } catch {
        if (!cancelled) {
          setCollections(DEMO_COLLECTIONS.filter((c) => c.network === network));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (!live) {
      if (network) list = list.filter((i) => i.asset.network === network);
      if (collectionSlug) {
        list = list.filter((i) => i.asset.collection?.slug === collectionSlug);
      }
      if (deferredQ.trim()) {
        const qq = deferredQ.trim().toLowerCase();
        list = list.filter(
          (i) =>
            i.asset.name.toLowerCase().includes(qq) ||
            i.asset.tokenId.toLowerCase().includes(qq) ||
            (i.asset.contractAddress ?? '').toLowerCase().includes(qq) ||
            (i.asset.collection?.name ?? '').toLowerCase().includes(qq),
        );
      }
    }
    if (!includeHidden) list = list.filter((i) => !i.isHidden);
    if (favoritesOnly) list = list.filter((i) => i.isFavorite);
    if (recentlyViewedOnly) list = list.filter((i) => viewed.includes(i.asset.id));
    if (kind === 'tokenized') {
      list = list.filter(
        (i) =>
          (i.asset.standard ?? '').includes('1155') || i.asset.name.toLowerCase().includes('key'),
      );
    }
    if (deferredTrait.trim()) {
      const tq = deferredTrait.trim().toLowerCase();
      list = list.filter((i) => traitsText(i).includes(tq));
    }
    if (sort === 'acquired') {
      list.sort((a, b) => (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? ''));
    } else if (sort === 'viewed') {
      list.sort((a, b) => {
        const ai = viewed.indexOf(a.asset.id);
        const bi = viewed.indexOf(b.asset.id);
        const av = ai === -1 ? Number.POSITIVE_INFINITY : ai;
        const bv = bi === -1 ? Number.POSITIVE_INFINITY : bi;
        return av - bv;
      });
    } else if (sort === 'name_desc') {
      list.sort((a, b) => b.asset.name.localeCompare(a.asset.name));
    } else if (sort === 'name_asc' && !live) {
      list.sort((a, b) => a.asset.name.localeCompare(b.asset.name));
    }
    return list;
  }, [
    items,
    live,
    network,
    collectionSlug,
    deferredQ,
    includeHidden,
    favoritesOnly,
    recentlyViewedOnly,
    viewed,
    kind,
    deferredTrait,
    sort,
  ]);

  async function discover(): Promise<void> {
    setSyncing(true);
    try {
      await nftFetch('/api/v1/nfts/discover', {
        method: 'POST',
        body: JSON.stringify({ network, ownerAddress }),
      });
      await reloadGallery();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSyncing(false);
    }
  }

  async function toggleFavorite(item: NftGalleryItem): Promise<void> {
    try {
      if (live) {
        await nftFetch(`/api/v1/nfts/assets/${item.asset.id}/favorite`, {
          method: 'PATCH',
          body: JSON.stringify({ isFavorite: !item.isFavorite }),
        });
        await reloadGallery();
      } else {
        setItems((prev) =>
          prev.map((x) => (x.asset.id === item.asset.id ? { ...x, isFavorite: !x.isFavorite } : x)),
        );
      }
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  const galleryClass =
    view === 'list'
      ? 'nx-gallery nx-gallery--list'
      : view === 'compact'
        ? 'nx-gallery nx-gallery--compact'
        : view === 'large'
          ? 'nx-gallery nx-gallery--large'
          : 'nx-gallery nx-gallery--grid';

  return (
    <PlatformShell
      title="Collectibles"
      subtitle="Search, filter, and browse your gallery with grid, list, compact, and large preview modes."
      reassure="Hide spam and favor verified collections — your gallery stays calm and under your control."
      backHref="/dashboard"
      backLabel="Wallet"
      actions={
        <div className="cx-chips" role="group" aria-label="Gallery view">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              className={`cx-chip${view === mode ? ' is-on' : ''}`}
              onClick={() => setView(mode)}
            >
              {mode[0]!.toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      {!live && error ? (
        <Alert tone="warn" title="Preview gallery">
          Showing demo collectibles while the NFT service is offline.
        </Alert>
      ) : null}

      <section className="cx-panel nx-panel">
        <div className="cx-toolbar nx-toolbar">
          <label className="cx-field nx-field">
            <span>Network</span>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              aria-label="Network"
            >
              {networks.map((n) => (
                <option key={n.network} value={n.network} disabled={!n.nftSupported}>
                  {n.network}
                  {!n.nftSupported ? ' (unsupported)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="cx-field nx-field">
            <span>Collection</span>
            <select
              value={collectionSlug}
              onChange={(e) => setCollectionSlug(e.target.value)}
              aria-label="Collection filter"
            >
              <option value="">All</option>
              {collections.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cx-field nx-field cx-field--grow">
            <span>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, token, contract"
              aria-label="Search NFTs"
            />
          </label>
          <label className="cx-field nx-field">
            <span>Traits</span>
            <input
              value={traitQ}
              onChange={(e) => setTraitQ(e.target.value)}
              placeholder="Background, tier…"
              aria-label="Search traits"
            />
          </label>
          <label className="cx-field nx-field">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(parseSort(e.target.value))}
              aria-label="Sort"
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="recent">Recently synced</option>
              <option value="acquired">Recently acquired</option>
              <option value="viewed">Recently viewed</option>
            </select>
          </label>
        </div>
        <div className="nx-checks cx-chips" style={{ alignItems: 'center' }}>
          <label>
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />{' '}
            Favorites
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => setIncludeHidden(e.target.checked)}
            />{' '}
            Include hidden
          </label>
          <label>
            <input
              type="checkbox"
              checked={recentlyViewedOnly}
              onChange={(e) => setRecentlyViewedOnly(e.target.checked)}
            />{' '}
            Recently viewed
          </label>
          <label className="cx-field nx-field" style={{ margin: 0 }}>
            <span>Discover owner</span>
            <input
              value={ownerAddress}
              onChange={(e) => setOwnerAddress(e.target.value)}
              aria-label="Owner address"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={syncing}
            onClick={() => void discover()}
          >
            {syncing ? 'Syncing…' : 'Discover & sync'}
          </Button>
        </div>
      </section>

      {view === 'collection' ? (
        <section className="cx-panel nx-panel">
          <h2>Collections overview</h2>
          {collections.length === 0 ? (
            <EmptyState
              title="No collections"
              description="Sync or discover assets to populate collections."
            />
          ) : (
            <ul className="nx-gallery nx-gallery--grid">
              {collections.map((c) => (
                <li key={c.id} className="nx-card">
                  <Link href={`/nfts/collections/${c.network}/${c.slug}`}>
                    <div className="nx-card__media">
                      <img src={c.logoUrl || '/nft-placeholder.svg'} alt="" loading="lazy" />
                    </div>
                    <div className="nx-card__body">
                      <strong>
                        {c.name} {c.verified ? '✓' : ''}
                      </strong>
                      <p className="cx-meta nx-meta">
                        {c.totalSupply} items · Floor{' '}
                        {c.floorPriceUsd != null ? `$${c.floorPriceUsd}` : '—'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view !== 'collection' ? (
        <section className="cx-panel nx-panel" aria-busy={loading}>
          <h2>
            {kind === 'tokenized'
              ? 'Tokenized assets'
              : kind === 'collectibles'
                ? 'Collectibles'
                : 'Gallery'}{' '}
            <span className="cx-meta nx-meta">({filtered.length})</span>
          </h2>
          {loading ? (
            <div className="nx-gallery nx-gallery--grid" aria-hidden>
              <div className="nx-skeleton" />
              <div className="nx-skeleton" />
              <div className="nx-skeleton" />
              <div className="nx-skeleton" />
            </div>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState
              title="No NFTs match"
              description="Try clearing filters, including hidden assets, or discover from an owner address."
            />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <ul className={galleryClass}>
              {filtered.map((item) => (
                <li key={item.ownershipId || item.asset.id} className="nx-card">
                  <button
                    type="button"
                    className={`nx-fav ${item.isFavorite ? 'nx-fav--on' : ''}`}
                    aria-label={item.isFavorite ? 'Remove favorite' : 'Favorite'}
                    aria-pressed={item.isFavorite}
                    onClick={() => void toggleFavorite(item)}
                  >
                    <Heart size={14} fill={item.isFavorite ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                  <Link href={`/nfts/assets/${item.asset.id}`} className="nx-card__link">
                    <div className="nx-card__media">
                      <img
                        src={
                          item.asset.imageUrl || item.asset.animationUrl || '/nft-placeholder.svg'
                        }
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={onThumbError}
                      />
                    </div>
                    <div className="nx-card__body">
                      <strong>{item.asset.name}</strong>
                      <p className="cx-meta nx-meta">
                        {item.asset.collection?.name ?? 'Uncollected'} · #{item.asset.tokenId}
                      </p>
                      {item.isHidden ? <StatusBadge status="archived" label="Hidden" /> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </PlatformShell>
  );
}
