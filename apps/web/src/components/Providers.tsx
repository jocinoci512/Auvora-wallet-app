'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider, ToastProvider, TooltipProvider } from '@auvora/ui';
import { LocaleDocumentSync } from '../lib/i18n/locale-document';
import { OnlineStatusProvider } from '../lib/offline/online-status';

export function Providers({ children }: { children: ReactNode }): ReactElement {
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
