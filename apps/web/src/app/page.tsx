import { Button } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Enterprise wallet platform — wallets, payments, compliance, custody, notifications, AI,
        analytics, and platform status are available in this app.
      </p>
      <p className="action-row" style={{ marginTop: '1.5rem' }}>
        <Link href="/wallets">
          <Button>View wallets</Button>
        </Link>
        <Link href="/payments">
          <Button variant="secondary">Payments</Button>
        </Link>
        <Link href="/status">
          <Button variant="ghost">Status</Button>
        </Link>
      </p>
    </main>
  );
}
