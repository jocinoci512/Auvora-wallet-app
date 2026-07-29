'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export function CountUp({
  value,
  format = (n) => n.toFixed(2),
  durationMs = 900,
  className,
}: CountUpProps): ReactElement {
  // Start at the target value so first paint is correct when rAF is throttled
  // (background tabs / embedded previews often starve animation frames).
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const readyRef = useRef(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!readyRef.current) {
      readyRef.current = true;
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    if (reduced || Math.abs(value - fromRef.current) < 0.005) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      setDisplay(value);
      fromRef.current = value;
    };

    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    frame = requestAnimationFrame(tick);
    // Guarantee final value even if rAF never runs (hidden / throttled tabs).
    const fallback = window.setTimeout(finish, durationMs + 100);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
