import { Skeleton } from '@auvora/ui';
import type { ReactElement } from 'react';

export default function Loading(): ReactElement {
  return (
    <main className="auvora-page" aria-busy="true" aria-label="Loading settings">
      <Skeleton rows={6} label="Loading Security Center" />
    </main>
  );
}
