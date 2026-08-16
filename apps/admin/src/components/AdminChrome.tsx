'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@auvora/ui';
import { AccessTokenPanel } from './AccessTokenPanel';
import { AuthGate } from './AuthGate';
import { Nav } from './Nav';
import { isAdminPublicPath, isProductionBuild } from '../lib/api-client';

export function AdminChrome({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  if (isAdminPublicPath(pathname)) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <AuthGate>
      <AppShell header={<Nav />}>
        {!isProductionBuild() ? <AccessTokenPanel /> : null}
        <main id="main-content">{children}</main>
      </AppShell>
    </AuthGate>
  );
}

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <section className="admin-auth-screen">
      <div className="admin-auth-card">
        <p className="admin-auth-kicker">Auvora Admin</p>
        <h1>{title}</h1>
        <p className="admin-auth-copy">{description}</p>
        {children}
        <p className="admin-auth-foot">
          <Link href="/login">Return to sign in</Link>
        </p>
      </div>
    </section>
  );
}
