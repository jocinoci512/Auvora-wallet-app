import { Skeleton } from '@auvora/ui';
import type { ReactElement } from 'react';

export default function Loading(): ReactElement {
  return (
    <main>
      <Skeleton rows={5} label="Loading page" />
    </main>
  );
}
