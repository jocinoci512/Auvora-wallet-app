'use client';

import { AuvoraClientError, type ChainBlock, type ChainNetwork } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

const CHAINS: Array<ChainNetwork | ''> = [
  '',
  'BITCOIN',
  'ETHEREUM',
  'POLYGON',
  'SOLANA',
  'BNB_SMART_CHAIN',
  'TRON',
  'LITECOIN',
];

export default function AdminBlockchainBlocksPage(): ReactElement {
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);
  const [total, setTotal] = useState(0);
  const [chain, setChain] = useState<ChainNetwork | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListBlocks({ chain: chain || undefined });
      setBlocks(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Blocks</h1>
          <p className="page-subtitle">{total} recent block{total === 1 ? '' : 's'}</p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Chain</span>
            <select
              className="field-input"
              value={chain}
              onChange={(e) => setChain(e.target.value as ChainNetwork | '')}
            >
              {CHAINS.map((c) => (
                <option key={c || 'all'} value={c}>
                  {c ? c.replace(/_/g, ' ') : 'All'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? <p className="state-message">Loading blocks…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && blocks.length === 0 ? (
        <p className="state-message">No blocks synced yet.</p>
      ) : null}

      {!loading && blocks.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Height</th>
              <th>Hash</th>
              <th>Orphan</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.id}>
                <td>{block.chain.replace(/_/g, ' ')}</td>
                <td>{block.height}</td>
                <td className="mono">{block.hash.slice(0, 16)}…</td>
                <td>{block.isOrphan ? 'Yes' : 'No'}</td>
                <td>{new Date(block.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
