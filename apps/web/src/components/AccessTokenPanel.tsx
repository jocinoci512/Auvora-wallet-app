'use client';

import { Button } from '@auvora/ui';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { getStoredAccessToken, setStoredAccessToken } from '../lib/api-client';
import { loadMe, notifyAuthUserUpdated } from '../lib/auth/session';

export function AccessTokenPanel(): ReactElement | null {
  const pathname = usePathname() || '/';
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pathname === '/') return;
    const stored = getStoredAccessToken();
    if (stored) {
      setToken(stored);
    }
  }, [pathname]);

  const save = useCallback(() => {
    const trimmed = token.trim();
    setStoredAccessToken(trimmed || null);
    setSaved(true);
    if (trimmed) {
      void loadMe().then(() => notifyAuthUserUpdated());
    } else {
      notifyAuthUserUpdated();
    }
    window.setTimeout(() => setSaved(false), 2000);
  }, [token]);

  const clear = useCallback(() => {
    setToken('');
    setStoredAccessToken(null);
  }, []);

  if (pathname === '/') {
    return null;
  }

  return (
    <section className="token-panel">
      <details>
        <summary>API access token</summary>
        <p className="token-panel__hint">
          For local testing only: paste a sign-in token to load your account in this browser tab.
        </p>
        <div className="token-panel__row">
          <input
            type="password"
            className="field-input token-panel__input"
            placeholder="Bearer access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label="Access token"
            autoComplete="off"
          />
          <Button type="button" onClick={save}>
            Save token
          </Button>
          <Button type="button" variant="ghost" onClick={clear}>
            Clear
          </Button>
          {saved ? (
            <span className="token-panel__saved" role="status" aria-live="polite">
              Saved
            </span>
          ) : null}
        </div>
      </details>
    </section>
  );
}
