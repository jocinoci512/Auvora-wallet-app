'use client';

import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page">
      <h1>Something went wrong</h1>
      <p className="page-subtitle">
        An unexpected error occurred in the admin console. Retry, or return to the overview. No
        customer funds are moved from this screen.
      </p>
      <div className="action-row">
        <button type="button" className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/">Overview</Link>
      </div>
      {error.digest ? <p className="page-subtitle">Reference: {error.digest}</p> : null}
    </main>
  );
}
