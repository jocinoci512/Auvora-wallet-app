'use client';

import { ThemeProvider, ToastProvider, TooltipProvider } from '@auvora/ui';
import type { ReactElement, ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider delayDuration={200}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
