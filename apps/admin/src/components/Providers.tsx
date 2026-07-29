'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider, ToastProvider, TooltipProvider } from '@auvora/ui';

export function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
