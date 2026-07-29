'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import { Bookmark, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { isSecureDappUrl, originFromUrl, web3Fetch } from '../../lib/web3/api';
import {
  listBrowserHistory,
  listLocalBookmarks,
  pushBrowserHistory,
  removeLocalBookmark,
  upsertLocalBookmark,
  type BrowserHistoryEntry,
  type LocalBookmark,
} from '../../lib/web3/prefs';
import { Web3SectionNav } from './Web3SectionNav';
import '../../app/web3-experience.css';

export function DappBrowserExperience(): ReactElement {
  const params = useSearchParams();
  const initial = params.get('url') ?? 'https://app.uniswap.org';
  const [address, setAddress] = useState(initial);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<BrowserHistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<LocalBookmark[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [stackIndex, setStackIndex] = useState(-1);
  const stackRef = useRef<string[]>([]);
  const stackIndexRef = useRef(-1);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabNote = 'Multi-tab placeholder — single session for now';

  useEffect(() => {
    setHistory(listBrowserHistory());
    setBookmarks(listLocalBookmarks());
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, []);

  const applyUrl = useCallback((href: string) => {
    setError(null);
    setAddress(href);
    setActiveUrl(href);
  }, []);

  const navigateTo = useCallback(
    (raw: string, push = true) => {
      const check = isSecureDappUrl(raw);
      if (!check.ok) {
        setError(check.reason);
        setActiveUrl(null);
        return;
      }
      const href = check.url.href;
      setLoading(true);
      applyUrl(href);
      pushBrowserHistory({ url: href, title: check.url.hostname });
      setHistory(listBrowserHistory());
      void web3Fetch('/api/v1/connections/dapps/browser/visit', {
        method: 'POST',
        body: JSON.stringify({ url: href, title: check.url.hostname }),
      }).catch(() => undefined);
      if (push) {
        const base = stackRef.current.slice(0, Math.max(0, stackIndexRef.current + 1));
        const next = [...base, href].slice(-20);
        stackRef.current = next;
        stackIndexRef.current = next.length - 1;
        setStack(next);
        setStackIndex(next.length - 1);
      }
      if (loadTimer.current) clearTimeout(loadTimer.current);
      loadTimer.current = setTimeout(() => setLoading(false), 450);
    },
    [applyUrl],
  );

  useEffect(() => {
    navigateTo(initial, true);
  }, [initial, navigateTo]);

  function goBack(): void {
    if (stackIndexRef.current <= 0) return;
    const next = stackIndexRef.current - 1;
    const url = stackRef.current[next];
    stackIndexRef.current = next;
    setStackIndex(next);
    if (url) applyUrl(url);
  }

  function goForward(): void {
    if (stackIndexRef.current >= stackRef.current.length - 1) return;
    const next = stackIndexRef.current + 1;
    const url = stackRef.current[next];
    stackIndexRef.current = next;
    setStackIndex(next);
    if (url) applyUrl(url);
  }

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    navigateTo(address, true);
  }

  function bookmark(): void {
    if (!activeUrl) return;
    setBookmarks(upsertLocalBookmark(activeUrl, originFromUrl(activeUrl)));
  }

  const bookmarked = Boolean(activeUrl && bookmarks.some((b) => b.url === activeUrl));

  return (
    <div className="w3">
      <header className="w3__header">
        <div>
          <p className="w3__eyebrow">
            <Link href="/web3">Web3 Hub</Link>
          </p>
          <h1>dApp browser</h1>
          <p className="w3__sub">
            HTTPS-only browsing with bookmarks, history, and secure open controls.
          </p>
        </div>
        <p className="w3-meta" aria-live="polite">
          {tabNote}
        </p>
      </header>

      <Web3SectionNav current="/web3/browser" />

      <div className="w3-browser">
        <form className="w3-browser__chrome" onSubmit={onSubmit} aria-label="Browser chrome">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={goBack}
            disabled={stackIndex <= 0}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={goForward}
            disabled={stackIndex >= stack.length - 1}
          >
            Forward
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => activeUrl && navigateTo(activeUrl, false)}
            disabled={!activeUrl}
            aria-label="Refresh"
          >
            <RefreshCw size={14} aria-hidden />
          </Button>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address bar"
            placeholder="https://"
            autoComplete="url"
            inputMode="url"
          />
          <Button type="submit" size="sm">
            Go
          </Button>
          <Button
            type="button"
            size="sm"
            variant={bookmarked ? 'primary' : 'secondary'}
            onClick={bookmark}
            disabled={!activeUrl}
            aria-pressed={bookmarked}
            aria-label="Bookmark page"
          >
            <Bookmark size={14} aria-hidden />
          </Button>
          {activeUrl ? (
            <a href={activeUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="ghost" aria-label="Open in external browser">
                <ExternalLink size={14} aria-hidden />
              </Button>
            </a>
          ) : null}
        </form>

        {loading ? (
          <div className="w3-browser__stage" aria-busy="true" aria-label="Loading page">
            <div className="w3-skeleton" style={{ width: '100%', minHeight: 280 }} />
          </div>
        ) : error ? (
          <div className="w3-browser__stage" role="alert">
            <EmptyState title="Cannot open page" description={error} />
            <Alert tone="warn" title="Suspicious / insecure URL">
              Auvora blocks non-HTTPS and malformed origins. Phishing lookalikes use domain
              verification placeholders before connect.
            </Alert>
          </div>
        ) : activeUrl ? (
          <div className="w3-browser__stage">
            <iframe
              className="w3-browser__iframe"
              title={`dApp frame · ${originFromUrl(activeUrl)}`}
              src={activeUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
            <p className="w3-meta" style={{ marginTop: '0.75rem' }}>
              Sandboxed preview · {originFromUrl(activeUrl)} · Unknown contract warnings appear on
              sign
            </p>
          </div>
        ) : (
          <div className="w3-browser__stage">
            <EmptyState
              title="Enter a secure URL"
              description="Only HTTPS public domains are allowed."
            />
          </div>
        )}
      </div>

      <section className="w3-panel">
        <h2>Bookmarks</h2>
        {bookmarks.length === 0 ? (
          <EmptyState
            title="No bookmarks"
            description="Star a page from the address bar to save it."
          />
        ) : (
          <ul className="w3-list">
            {bookmarks.map((b) => (
              <li key={b.id}>
                <button type="button" className="w3__tab" onClick={() => navigateTo(b.url, true)}>
                  {b.title}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setBookmarks(removeLocalBookmark(b.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="w3-panel">
        <h2>History</h2>
        {history.length === 0 ? (
          <EmptyState title="No history" description="Visited HTTPS pages appear here." />
        ) : (
          <ul className="w3-list">
            {history.slice(0, 12).map((h) => (
              <li key={h.id}>
                <div>
                  <strong>{h.title}</strong>
                  <p className="w3-meta">
                    {h.url} · {new Date(h.visitedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => navigateTo(h.url, true)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
