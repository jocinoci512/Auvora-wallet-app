'use client';

import { AuvoraClientError, type NetworkStatus, type SupportedChain } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

function findStatus(statuses: NetworkStatus[], chain: string): NetworkStatus | undefined {
  return statuses.find((status) => status.chain === chain);
}

export default function BlockchainPage(): ReactElement {
  const [chains, setChains] = useState<SupportedChain[]>([]);
  const [statuses, setStatuses] = useState<NetworkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [chainList, statusList] = await Promise.all([
        client.listChains(),
        client.getNetworkStatus(),
      ]);
      setChains(chainList);
      setStatuses(statusList);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Blockchain</h1>
          <p className="page-subtitle">Supported chains and live network status</p>
        </div>
        <Link href="/blockchain/addresses">
          <Button>Manage addresses</Button>
        </Link>
      </header>

      {loading ? <p className="state-message">Loading chains…</p> : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load()}
            style={{ marginTop: '0.75rem' }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error ? (
        <ul className="chain-grid">
          {chains.map((chain) => {
            const status = findStatus(statuses, chain.chain);
            return (
              <li key={chain.id} className="chain-card">
                <span className="chain-card__name">{chain.displayName}</span>
                <span className="chain-card__symbol">{chain.nativeSymbol}</span>
                <div className="chain-card__meta">
                  <span>Required confirmations: {chain.requiredConfirmations}</span>
                  <span>Block time: ~{chain.blockTimeSeconds}s</span>
                  <span>
                    {status ? (
                      <>
                        <span
                          className={`dot ${status.isHealthy ? 'dot--healthy' : 'dot--unhealthy'}`}
                        />
                        {status.isHealthy ? 'Healthy' : 'Degraded'}
                        {status.blockHeight ? ` · block ${status.blockHeight}` : ''}
                      </>
                    ) : (
                      'Status unavailable'
                    )}
                  </span>
                  {chain.explorerUrl ? (
                    <a href={chain.explorerUrl} target="_blank" rel="noreferrer">
                      Explorer ↗
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && !error && chains.length === 0 ? (
        <p className="state-message">No chains configured yet.</p>
      ) : null}
    </main>
  );
}
