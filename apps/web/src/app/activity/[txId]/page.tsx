import type { ReactElement } from 'react';
import Link from 'next/link';
import { DEMO_TXS } from '../../../lib/dashboard-demo';

const DETAILS: Record<
  string,
  {
    hash: string;
    from: string;
    to: string;
    fee: string;
    note: string;
    explorer: string;
  }
> = {
  tx1: {
    hash: '0x9a4f2c8e1b7d6a5f3e2c1b0a9876543210fedcba',
    from: '0x8f3a…91c2',
    to: 'Your wallet',
    fee: '0.0012 ETH',
    note: 'This receive finished successfully on Ethereum.',
    explorer: 'https://etherscan.io/tx/0x9a4f2c8e1b7d6a5f3e2c1b0a9876543210fedcba',
  },
  tx2: {
    hash: '5Kd9mN2pQ8rT1vW3xY6zA4bC7dE0fG2hJ5kL8mN',
    from: 'Your wallet',
    to: 'Your wallet',
    fee: '0.00005 SOL',
    note: 'Swap settled on Solana.',
    explorer: 'https://solscan.io/tx/5Kd9mN2pQ8rT1vW3xY6zA4bC7dE0fG2hJ5kL8mN',
  },
  tx3: {
    hash: '0xcafebabe11223344556677889900aabbccddee',
    from: 'Your wallet',
    to: 'Staking pool',
    fee: '0.001 ETH',
    note: 'Still confirming — usually finishes in a few minutes.',
    explorer: 'https://etherscan.io/tx/0xcafebabe11223344556677889900aabbccddee',
  },
  tx4: {
    hash: '0x1b2c3d4e5f678901234567890abcdef12345678',
    from: 'Your wallet',
    to: 'Bridge destination',
    fee: '2.40 USDC',
    note: 'Bridge completed across networks.',
    explorer: 'https://etherscan.io/tx/0x1b2c3d4e5f678901234567890abcdef12345678',
  },
  tx5: {
    hash: 'b10c4a9e8f7d6c5b4a39281706f5e4d3c2b1a09',
    from: 'Your wallet',
    to: 'bc1q…0wlh',
    fee: '0.00012 BTC',
    note: 'Send confirmed on Bitcoin.',
    explorer: 'https://mempool.space/tx/b10c4a9e8f7d6c5b4a39281706f5e4d3c2b1a09',
  },
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ txId: string }>;
}): Promise<ReactElement> {
  const { txId } = await params;
  const tx = DEMO_TXS.find((t) => t.id === txId) ?? DEMO_TXS[0];
  const detail = DETAILS[tx?.id ?? 'tx1'] ?? DETAILS.tx1!;

  if (!tx) {
    return (
      <main style={{ padding: 24 }}>
        <p>Transaction not found.</p>
        <Link href="/activity">Back to activity</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 48px' }}>
      <p style={{ margin: '0 0 12px' }}>
        <Link href="/activity">← Activity</Link>
        {' · '}
        <Link href="/dashboard">Dashboard</Link>
      </p>
      <h1 style={{ margin: '0 0 8px' }}>
        {tx.type} · {tx.asset}
      </h1>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem' }}>{tx.amount}</p>
      <p style={{ color: '#5C6570' }}>
        Status: {tx.status} · {tx.network} · {tx.at}
      </p>
      <p style={{ lineHeight: 1.5, color: '#5C6570' }}>{detail.note}</p>
      <dl style={{ display: 'grid', gap: 10, marginTop: 24 }}>
        <div>
          <dt style={{ color: '#5C6570', fontSize: 13 }}>From</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{detail.from}</dd>
        </div>
        <div>
          <dt style={{ color: '#5C6570', fontSize: 13 }}>To</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{detail.to}</dd>
        </div>
        <div>
          <dt style={{ color: '#5C6570', fontSize: 13 }}>Fee</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{detail.fee}</dd>
        </div>
        <div>
          <dt style={{ color: '#5C6570', fontSize: 13 }}>Hash</dt>
          <dd
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            {detail.hash}
          </dd>
        </div>
      </dl>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <a href={detail.explorer} target="_blank" rel="noreferrer">
          Open in explorer
        </a>
        <Link href="/activity">Back to history</Link>
      </div>
    </main>
  );
}
