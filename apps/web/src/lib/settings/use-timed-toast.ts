'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Dismissible toast with unmount-safe timer cleanup. */
export function useTimedToast(defaultMs = 1800): {
  toast: string | null;
  showToast: (message: string, ms?: number) => void;
  clearToast: () => void;
} {
  const [toast, setToast] = useState<string | null>(null);
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
    (message: string, ms = defaultMs) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(message);
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, ms);
    },
    [defaultMs],
  );

  return { toast, showToast, clearToast };
}
