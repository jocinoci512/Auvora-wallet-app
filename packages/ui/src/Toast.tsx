'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { cn } from './utils/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title?: string;
  description: string;
  tone?: ToastTone;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { ...toast, id, tone: toast.tone ?? 'info' }]);
      window.setTimeout(() => dismiss(id), 5000);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function Toaster(): ReactElement | null {
  const ctx = useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <div className="auvora-toaster" aria-live="polite" aria-relevant="additions">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={cn('auvora-toast', `auvora-toast--${t.tone ?? 'info'}`)}
          role={t.tone === 'error' || t.tone === 'warning' ? 'alert' : 'status'}
        >
          <div className="auvora-toast__body">
            {t.title ? <strong className="auvora-toast__title">{t.title}</strong> : null}
            <p className="auvora-toast__desc">{t.description}</p>
          </div>
          <IconButton label="Dismiss notification" size="sm" onClick={() => ctx.dismiss(t.id)}>
            <Icon icon={X} size="sm" aria-hidden />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
