'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'success' | 'warn' | 'error' | 'info';

/** Dismissible toast with unmount-safe timer cleanup. Do not add a second toast library. */
export function useTimedToast(defaultMs = 1800): {
  toast: string | null;
  tone: ToastTone;
  showToast: (message: string, options?: number | { ms?: number; tone?: ToastTone }) => void;
  clearToast: () => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('info');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const clearToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, options?: number | { ms?: number; tone?: ToastTone }) => {
      const ms = typeof options === 'number' ? options : (options?.ms ?? defaultMs);
      const nextTone = typeof options === 'object' ? (options.tone ?? 'info') : 'info';
      if (timer.current) clearTimeout(timer.current);
      setTone(nextTone);
      setToast(message);
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, ms);
    },
    [defaultMs],
  );

  return { toast, tone, showToast, clearToast };
}
