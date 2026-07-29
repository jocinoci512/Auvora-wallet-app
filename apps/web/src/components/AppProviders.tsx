'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider, ToastProvider, TooltipProvider } from '@auvora/ui';
import { LocaleDocumentSync } from '../lib/i18n/locale-document';
import { OnlineStatusProvider } from '../lib/offline/online-status';

/** Alias kept in sync with `Providers` for legacy imports. */
export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <ToastProvider>
          <OnlineStatusProvider>
            <LocaleDocumentSync>{children}</LocaleDocumentSync>
          </OnlineStatusProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
