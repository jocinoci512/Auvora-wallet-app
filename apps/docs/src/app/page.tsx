import { Button } from '@auvora/ui';
import type { ReactElement } from 'react';
import { env } from '../env';

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      <p>
        Engineering foundation for the Auvora Wallet platform. Product surfaces will land in later
        phases.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Button>Platform ready</Button>
      </p>
    </main>
  );
}
