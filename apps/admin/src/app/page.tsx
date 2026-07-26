import { Button } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Admin console for wallets, blockchain, payments, compliance, custody, notifications,
        analytics, AI, observability, and infrastructure operations.
      </p>
      <p className="action-row" style={{ marginTop: '1.5rem' }}>
        <Link href="/wallets">
          <Button>Open wallets</Button>
        </Link>
        <Link href="/observability">
          <Button variant="secondary">Operations</Button>
        </Link>
        <Link href="/infrastructure">
          <Button variant="ghost">Infrastructure</Button>
        </Link>
      </p>
    </main>
  );
}
