import { Button } from '@auvora/ui';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Platform documentation hub for Auvora Wallet — architecture, ADRs, deployment, and
        operational readiness references.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Button>Platform ready</Button>
      </p>
    </main>
  );
}
