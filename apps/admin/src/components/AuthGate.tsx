'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Loader } from '@auvora/ui';
import { AdminIdentityProvider } from '../lib/admin-identity';
import { isAdminPublicPath } from '../lib/api-client';
import { canEnterAdminControlPlane } from '../lib/admin-rbac';
import { adminRefresh, adminSession, type AdminOperator } from '../lib/admin-session';

export function AuthGate({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [ready, setReady] = useState(isAdminPublicPath(pathname));
  const [identity, setIdentity] = useState<{
    operator: AdminOperator;
    sessionId: string;
    stepUpExp: number | null;
  } | null>(null);

  useEffect(() => {
    if (isAdminPublicPath(pathname)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const session = await adminSession();
        if (!cancelled) {
          if (!canEnterAdminControlPlane(session.operator)) {
            router.replace('/forbidden');
            return;
          }
          setIdentity(session);
          setReady(true);
        }
      } catch (error) {
        const status = (error as { status?: number }).status;
        try {
          await adminRefresh();
          const session = await adminSession();
          if (!cancelled) {
            if (!canEnterAdminControlPlane(session.operator)) {
              router.replace('/forbidden');
              return;
            }
            setIdentity(session);
            setReady(true);
          }
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

  if (!identity) {
    return <>{children}</>;
  }

  return <AdminIdentityProvider value={identity}>{children}</AdminIdentityProvider>;
}
