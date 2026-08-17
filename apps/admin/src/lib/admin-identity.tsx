'use client';

import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import type { AdminOperator } from './admin-session';

export interface AdminIdentityValue {
  operator: AdminOperator;
  sessionId: string;
  stepUpExp: number | null;
}

const AdminIdentityContext = createContext<AdminIdentityValue | null>(null);

export function AdminIdentityProvider({
  value,
  children,
}: {
  value: AdminIdentityValue;
  children: ReactNode;
}): ReactElement {
  return <AdminIdentityContext.Provider value={value}>{children}</AdminIdentityContext.Provider>;
}

export function useAdminIdentity(): AdminIdentityValue | null {
  return useContext(AdminIdentityContext);
}

export function useRequiredAdminIdentity(): AdminIdentityValue {
  const value = useContext(AdminIdentityContext);
  if (!value) {
    throw new Error('Admin identity is not available');
  }
  return value;
}
