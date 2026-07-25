import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { env } from '../env';
import '@auvora/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: 'Auvora Wallet platform',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body className="auvora-surface">{children}</body>
    </html>
  );
}
