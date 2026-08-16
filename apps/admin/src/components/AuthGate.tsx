'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Loader } from '@auvora/ui';
import { isAdminPublicPath } from '../lib/api-client';
import { adminRefresh, adminSession } from '../lib/admin-session';

export function AuthGate({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [ready, setReady] = useState(isAdminPublicPath(pathname));

  useEffect(() => {
    if (isAdminPublicPath(pathname)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await adminSession();
        if (!cancelled) setReady(true);
      } catch (error) {
        const status = (error as { status?: number }).status;
        try {
          await adminRefresh();
          await adminSession();
          if (!cancelled) setReady(true);
          return;
        } catch {
          /* fall through */
        }
        if (cancelled) return;
        if (status === 403) {
          router.replace('/forbidden');
          return;
        }
        router.replace('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready && !isAdminPublicPath(pathname)) {
    return (
      <div className="admin-auth-loading" role="status">
        <Loader />
        <span>Checking administrator session…</span>
      </div>
    );
  }

  return <>{children}</>;
}
