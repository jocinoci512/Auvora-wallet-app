'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import { Heart, ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, type ReactElement } from 'react';
import { web3Fetch } from '../../lib/web3/api';
import {
  DEMO_CATEGORIES,
  DEMO_DAPPS,
  DEMO_REQUESTS,
  riskLabel,
  type ConnectionRequest,
  type DappCard,
  type DappCategory,
} from '../../lib/web3/demo';
import { listFavorites, toggleFavorite } from '../../lib/web3/prefs';
import { Web3SectionNav } from './Web3SectionNav';
import '../../app/web3-experience.css';

type HubTab = 'featured' | 'recent' | 'favorites' | 'trending' | 'categories';

export function Web3HubExperience(): ReactElement {
  const [tab, setTab] = useState<HubTab>('featured');
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [network, setNetwork] = useState('all');
  const [category, setCategory] = useState<DappCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [status, setStatus] = useState<{ connected: number; pending: number }>({
    connected: 2,
    pending: DEMO_REQUESTS.length,
  });
  const [requests, setRequests] = useState<ConnectionRequest[]>(DEMO_REQUESTS);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(listFavorites());
    let cancelled = false;
    void (async () => {
      try {
        const [summary, pending] = await Promise.all([
          web3Fetch<{ activeSessions?: number; pendingRequests?: number }>(
            '/api/v1/connections/dapps/sessions/summary',
          ).catch(() => null),
          web3Fetch<ConnectionRequest[]>('/api/v1/connections/dapps/requests').catch(() => null),
        ]);
        if (cancelled) return;
        if (summary) {
          setStatus({
            connected: Number(summary.activeSessions ?? 0),
            pending: Number(summary.pendingRequests ?? 0),
          });
          setLive(true);
        }
        if (Array.isArray(pending) && pending.length) {
          setRequests(pending);
          setStatus((s) => ({ ...s, pending: pending.length }));
          setLive(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalog = DEMO_DAPPS;

  const filtered = useMemo(() => {
    let list = [...catalog];
    if (network !== 'all') list = list.filter((d) => d.network === network);
    if (category !== 'all') list = list.filter((d) => d.category === category);
    if (deferredQ.trim()) {
      const qq = deferredQ.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(qq) ||
          d.origin.toLowerCase().includes(qq) ||
          d.category.toLowerCase().includes(qq) ||
          d.description.toLowerCase().includes(qq),
      );
    }
    if (tab === 'featured') list = list.filter((d) => d.featured);
    if (tab === 'trending') list = list.filter((d) => d.trending);
    if (tab === 'favorites') list = list.filter((d) => favorites.includes(d.id));
    if (tab === 'recent') list = list.slice(0, 4);
    return list;
  }, [catalog, network, category, deferredQ, tab, favorites]);

  async function decide(id: string, action: 'approve' | 'reject'): Promise<void> {
    setBusyId(id);
    try {
      if (live) {
        await web3Fetch(`/api/v1/connections/dapps/requests/${id}/${action}`, {
          method: 'POST',
          body: '{}',
        });
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r,
        ),
      );
      setStatus((s) => ({ ...s, pending: Math.max(0, s.pending - 1) }));
    } catch {
      /* keep request pending on live failure */
    } finally {
      setBusyId(null);
    }
  }

  function onFav(dapp: DappCard): void {
    setFavorites(toggleFavorite(dapp.id));
  }

  return (
    <div className="w3">
      <header className="w3__header">
        <div>
          <p className="w3__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Web3 Hub</h1>
          <p className="w3__sub">
            Discover, connect, and manage dApps with clear permissions, signing, and security cues.
          </p>
        </div>
        <div className="w3-actions">
          <Link href="/web3/browser">
            <Button type="button">Open browser</Button>
          </Link>
          <Link href="/web3/permissions">
            <Button type="button" variant="secondary">
              Permissions
            </Button>
          </Link>
        </div>
      </header>

      {ready && !live ? (
        <Alert tone="warn" title="Preview Web3 data">
          Live connections service unavailable — showing curated hub data.
        </Alert>
      ) : null}

      <div className="w3-kpi" aria-label="Connection status">
        <div className="w3-kpi__card">
          <span>Active sessions</span>
          <strong>{status.connected}</strong>
        </div>
        <div className="w3-kpi__card">
          <span>Pending requests</span>
          <strong>{status.pending}</strong>
        </div>
        <div className="w3-kpi__card">
          <span>Favorites</span>
          <strong>{favorites.length}</strong>
        </div>
        <div className="w3-kpi__card">
          <span>Catalog</span>
          <strong>{catalog.length}</strong>
        </div>
      </div>

      <Web3SectionNav current="/web3" />

      {requests.some((r) => r.status === 'pending') ? (
        <section className="w3-panel">
          <h2>Connection requests</h2>
          <ul className="w3-list">
            {requests
              .filter((r) => r.status === 'pending')
              .map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{r.name}</strong>
                    <p className="w3-meta">
                      {r.origin} · {r.networks.join(', ')}
                    </p>
                    <p className="w3-meta">Permissions: {r.permissions.join(', ')}</p>
                  </div>
                  <div className="w3-actions">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, 'reject')}
                    >
                      Reject
                    </Button>
                    <Link href={`/web3/sign?origin=${encodeURIComponent(r.origin)}`}>
                      <Button type="button" size="sm" variant="ghost">
                        Review
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="w3-panel">
        <div className="w3-toolbar">
          <label className="w3-field">
            <span>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, category, origin"
              aria-label="Search dApps"
            />
          </label>
          <label className="w3-field">
            <span>Network</span>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              aria-label="Network filter"
            >
              <option value="all">All networks</option>
              <option value="ETHEREUM">Ethereum</option>
              <option value="POLYGON">Polygon</option>
              <option value="SOLANA">Solana</option>
            </select>
          </label>
          <label className="w3-field">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'all' || (DEMO_CATEGORIES as string[]).includes(v)) {
                  setCategory(v as DappCategory | 'all');
                }
              }}
              aria-label="Category filter"
            >
              <option value="all">All</option>
              {DEMO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="w3__tabs" role="group" aria-label="Discovery views">
          {(['featured', 'recent', 'favorites', 'trending', 'categories'] as HubTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`w3__tab ${tab === t ? 'w3__tab--on' : ''}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'categories' ? (
          <div className="w3-grid" style={{ marginTop: '0.85rem' }}>
            {DEMO_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="w3-card"
                onClick={() => {
                  setCategory(c);
                  setTab('featured');
                }}
              >
                <strong>{c}</strong>
                <p className="w3-meta">Editorial placeholder · curated soon</p>
              </button>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={tab === 'favorites' ? 'No favorites yet' : 'No dApps match'}
            description="Try another network, clear search, or browse categories."
          />
        ) : (
          <div className="w3-grid" style={{ marginTop: '0.85rem' }}>
            {filtered.map((d) => (
              <article key={d.id} className="w3-card">
                <div className="w3-card__top">
                  <div>
                    <strong>
                      {d.name}{' '}
                      {d.verified ? (
                        <ShieldCheck size={14} aria-label="Verified placeholder" />
                      ) : (
                        <ShieldAlert size={14} aria-label="Unverified" />
                      )}
                    </strong>
                    <p className="w3-meta">
                      {d.category} · {d.network}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="w3__tab"
                    aria-pressed={favorites.includes(d.id)}
                    aria-label={favorites.includes(d.id) ? 'Remove favorite' : 'Favorite'}
                    onClick={() => onFav(d)}
                  >
                    <Heart
                      size={14}
                      fill={favorites.includes(d.id) ? 'currentColor' : 'none'}
                      aria-hidden
                    />
                  </button>
                </div>
                <p className="w3-meta">{d.description}</p>
                <span className={`w3-risk w3-risk--${d.risk}`}>{riskLabel(d.risk)}</span>
                <div className="w3-actions">
                  <Link href={`/web3/browser?url=${encodeURIComponent(d.url)}`}>
                    <Button type="button" size="sm">
                      Open
                    </Button>
                  </Link>
                  <Link href={`/web3/sign?origin=${encodeURIComponent(d.origin)}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Connect
                    </Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="w3-panel">
        <h2>Security cues</h2>
        <Alert tone="info" title="Domain verification architecture">
          Verified badges and phishing warnings are placeholders wired for future domain
          attestation. Unknown contracts and elevated permissions surface risk chips before
          approval.
        </Alert>
        <div className="w3-actions" style={{ marginTop: '0.75rem' }}>
          <Link href="/web3/activity">Activity & alerts</Link>
          <Link href="/notifications">Notifications</Link>
          <Link href="/security">Wallet security</Link>
        </div>
      </section>
    </div>
  );
}
