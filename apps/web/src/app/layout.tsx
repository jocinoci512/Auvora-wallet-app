import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@auvora/ui';
import { AccessTokenPanel } from '../components/AccessTokenPanel';
import { Nav } from '../components/Nav';
import { Providers } from '../components/Providers';
import { env } from '../env';
import '@auvora/ui/styles.css';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-auvora-sans',
  display: 'swap',
  preload: true,
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-auvora-mono',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: 'Auvora Wallet platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('auvora-theme')||'system';var d=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var r=document.documentElement;r.setAttribute('data-theme',d);r.classList.toggle('auvora-theme-dark',d==='dark');r.classList.toggle('auvora-theme-light',d==='light');r.style.colorScheme=d;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="auvora-surface">
        <Providers>
          <a className="auvora-skip-link" href="#main-content">
            Skip to content
          </a>
          <AppShell header={<Nav />}>
            <AccessTokenPanel />
            <div id="main-content">{children}</div>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
