import { Button } from '@auvora/ui';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Enterprise wallet platform — wallets, payments, compliance, custody, notifications, AI,
        analytics, and operations surfaces are available through this app and the admin console.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Button>Platform ready</Button>
      </p>
    </main>
  );
}
