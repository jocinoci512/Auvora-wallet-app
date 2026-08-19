'use client';

import { Alert, PageHeader } from '@auvora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactElement } from 'react';

function UnavailableBody(): ReactElement {
  const feature = useSearchParams().get('feature') ?? 'This console';

  return (
    <main className="page">
      <PageHeader
        title="Not on the production mesh"
        subtitle="Closed Beta Admin only talks to gateway, auth, wallet, blockchain, market-data, and connections."
      />
      <Alert tone="warn" title={`${feature} is not deployed`}>
        This route is not connected to a live Railway service. It is not offered as a working
        operations console until that service joins the production mesh.
      </Alert>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/observability/health">Open System Health</Link>
        {' · '}
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </main>
  );
}

export default function ServiceNotOnMeshPage(): ReactElement {
  return (
    <Suspense>
      <UnavailableBody />
    </Suspense>
  );
}
