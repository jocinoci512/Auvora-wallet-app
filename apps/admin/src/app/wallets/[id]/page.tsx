'use client';

import type { ChainAddress, Wallet } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatWhen } from '../../../lib/admin-format';
import { createApiClient, formatAdminError } from '../../../lib/api-client';

export default function AdminWalletDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const walletId = params.id;
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [walletData, addressData] = await Promise.all([
        client.adminGetWallet(walletId),
        client
          .adminListAddresses({ walletId, take: 50 })
          .catch(() => ({ items: [] as ChainAddress[] })),
      ]);
      setWallet(walletData);
      setAddresses(addressData.items);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="Wallet metadata"
        subtitle="Public identifiers only. Signing material is never available to Admin."
        actions={
          <Link href="/wallets">
            <Button variant="ghost">Back</Button>
          </Link>
        }
      />

      <AsyncStates
        loading={loading}
        loadingMessage="Loading wallet…"
        error={error}
        errorTitle="Could not load wallet"
        onRetry={() => void load()}
        empty={!loading && !error && !wallet}
        emptyTitle="Wallet not found"
      >
        {wallet ? (
          <>
            <dl className="admin-dl">
              <dt>Wallet ID</dt>
              <dd className="mono">{wallet.id}</dd>
              <dt>Network / asset</dt>
              <dd>{wallet.assetCode}</dd>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={wallet.status} />
              </dd>
              <dt>Owner</dt>
              <dd className="mono">{wallet.ownerUserId}</dd>
              <dt>Created</dt>
              <dd>{formatWhen(wallet.createdAt)}</dd>
            </dl>
            <section className="admin-section">
              <h2>Public addresses</h2>
              {addresses.length === 0 ? (
                <p className="page-subtitle">No public addresses reported for this wallet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <caption className="auvora-sr-only">Public addresses</caption>
                    <thead>
                      <tr>
                        <th scope="col">Network</th>
                        <th scope="col">Address</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addresses.map((row) => (
                        <tr key={row.id}>
                          <td>{row.chain}</td>
                          <td className="mono">{row.address}</td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </AsyncStates>
    </div>
  );
}
