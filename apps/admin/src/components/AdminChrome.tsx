'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@auvora/ui';
import { AccessTokenPanel } from './AccessTokenPanel';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { AuthGate } from './AuthGate';
import { isAdminPublicPath, isProductionBuild } from '../lib/api-client';
import { AdminRealtimeProvider } from '../lib/admin-realtime-context';

export function AdminChrome({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  if (isAdminPublicPath(pathname)) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <AuthGate>
      <AdminRealtimeProvider>
        <AppShell className="admin-shell" header={<AdminHeader />} sidebar={<AdminSidebar />}>
          {!isProductionBuild() ? <AccessTokenPanel /> : null}
          <main id="main-content" className="admin-main">
            {children}
          </main>
        </AppShell>
      </AdminRealtimeProvider>
    </AuthGate>
  );
}

export function AuthScreen({
  title,
  description,
  children,
  homeLink = true,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  homeLink?: boolean;
}): ReactElement {
  return (
    <section className="admin-auth-screen">
      <div className="admin-auth-card">
        <p className="admin-auth-kicker">Auvora Control Plane</p>
        <h1>{title}</h1>
        <p className="admin-auth-copy">{description}</p>
        {children}
        {homeLink ? (
          <p className="admin-auth-foot">
            <Link href="/login">Return to sign in</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
