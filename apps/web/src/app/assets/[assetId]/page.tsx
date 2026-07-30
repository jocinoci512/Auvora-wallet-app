'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactElement, useMemo } from 'react';
import { DEMO_HOLDINGS, formatPct, formatUsd, sparklineFor } from '../../../lib/dashboard-demo';
import { LineChart } from '../../../components/charts/Charts';

export default function AssetDetailPage(): ReactElement {
  const params = useParams<{ assetId: string }>();
  const asset = useMemo(
    () => DEMO_HOLDINGS.find((h) => h.id === params.assetId) ?? DEMO_HOLDINGS[0],
    [params.assetId],
  );

  if (!asset) {
    return (
      <main style={{ padding: 24 }}>
        <p>Asset not found.</p>
        <Link href="/dashboard">Back to dashboard</Link>
      </main>
    );
  }

  const up = asset.change24hPct >= 0;

  return (
    <main className="wd" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 48px' }}>
      <p style={{ margin: '0 0 12px' }}>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display, Syne, sans-serif)' }}>
        {asset.name}
      </h1>
      <p style={{ margin: 0, color: 'var(--wd-muted, #5C6570)' }}>
        {asset.symbol} · {asset.network}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 700, margin: '20px 0 4px' }}>
        {asset.balance} {asset.symbol}
      </p>
      <p style={{ margin: 0, color: 'var(--wd-muted, #5C6570)' }}>{formatUsd(asset.valueUsd)}</p>
      <p className={up ? 'wd-pos' : 'wd-neg'} style={{ fontWeight: 600 }}>
        {formatPct(asset.change24hPct)} · {formatUsd(asset.priceUsd)} each
      </p>
      <div style={{ margin: '20px 0' }}>
        <LineChart
          data={sparklineFor(asset.valueUsd, 24)}
          height={120}
          stroke="var(--wd-lagoon, #0E4F5C)"
          ariaLabel={`${asset.symbol} trend`}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
        <Link href={`/send?asset=${asset.symbol}`}>Send</Link>
        <Link href={`/receive?asset=${asset.symbol}`}>Receive</Link>
        <Link href={`/swap?from=${asset.symbol}`}>Swap</Link>
        <Link href={`/buy?asset=${asset.symbol}`}>Buy</Link>
      </div>
      <p style={{ marginTop: 28, fontSize: 13, color: 'var(--wd-muted, #5C6570)' }}>
        Desktop companion view. Live balances sync with the mobile wallet when networks are
        connected.
      </p>
    </main>
  );
}
