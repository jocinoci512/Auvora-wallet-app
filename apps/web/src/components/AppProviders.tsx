'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider, ToastProvider, TooltipProvider } from '@auvora/ui';
import { AccountHealthProvider } from '../lib/account/account-health';
import { LocaleDocumentSync } from '../lib/i18n/locale-document';
import { OnlineStatusProvider } from '../lib/offline/online-status';

/** Alias kept in sync with `Providers` for legacy imports. */
export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <ToastProvider>
          <OnlineStatusProvider>
            <AccountHealthProvider>
              <LocaleDocumentSync>{children}</LocaleDocumentSync>
            </AccountHealthProvider>
          </OnlineStatusProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
