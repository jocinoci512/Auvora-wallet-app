import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { AccessTokenPanel } from '../components/AccessTokenPanel';
import { Nav } from '../components/Nav';
import { env } from '../env';
import '@auvora/ui/styles.css';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-auvora-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-auvora-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: 'Auvora Wallet platform',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="auvora-surface">
        <a className="auvora-skip-link" href="#main-content">
          Skip to content
        </a>
        <Nav />
        <AccessTokenPanel />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
