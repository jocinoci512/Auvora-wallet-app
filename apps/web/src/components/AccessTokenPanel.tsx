'use client';

import { Button } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  ACCESS_TOKEN_KEY,
  getStoredAccessToken,
  setStoredAccessToken,
} from '../lib/api-client';

export function AccessTokenPanel(): ReactElement {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getStoredAccessToken();
    if (stored) {
      setToken(stored);
    }
  }, []);

  const save = useCallback(() => {
    const trimmed = token.trim();
    setStoredAccessToken(trimmed || null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, [token]);

  const clear = useCallback(() => {
    setToken('');
    setStoredAccessToken(null);
  }, []);

  return (
    <section className="token-panel">
      <details>
        <summary>API access token</summary>
        <p className="token-panel__hint">
          Requests use a JWT from <code>{ACCESS_TOKEN_KEY}</code> in localStorage. Paste an access
          token from <code>POST /api/v1/auth/login</code> on the gateway.
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
