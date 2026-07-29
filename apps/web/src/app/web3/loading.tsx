import { Skeleton } from '@auvora/ui';
import type { ReactElement } from 'react';

export default function Loading(): ReactElement {
  return (
    <main className="auvora-page" aria-busy="true" aria-label="Loading Web3 hub">
      <Skeleton rows={6} label="Loading Web3 Hub" />
    </main>
  );
}
