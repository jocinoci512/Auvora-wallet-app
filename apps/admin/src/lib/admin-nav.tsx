'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

interface AdminNavValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const AdminNavContext = createContext<AdminNavValue | null>(null);

export function AdminNavProvider({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((current) => !current),
    }),
    [open],
  );

  return <AdminNavContext.Provider value={value}>{children}</AdminNavContext.Provider>;
}

export function useAdminNav(): AdminNavValue {
  const value = useContext(AdminNavContext);
  if (!value) {
    throw new Error('Admin nav context is not available');
  }
  return value;
}
