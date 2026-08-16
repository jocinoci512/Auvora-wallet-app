import type { Metadata, Viewport } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { AppChrome } from '../components/Nav';
import { Providers } from '../components/Providers';
import { env } from '../env';
// Self-hosted fonts (deterministic build — no Google Fonts fetch at build time).
import '@fontsource-variable/syne';
import '@fontsource-variable/manrope';
import '@fontsource-variable/source-serif-4';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@auvora/ui/styles.css';
import './globals.css';

const appName = env.NEXT_PUBLIC_APP_NAME;
const appUrl = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl ?? 'https://auvorawallet.com'),
  title: {
    default: `${appName} — Secure, non-custodial multi-chain wallet`,
    template: `%s · ${appName}`,
  },
  description:
    'Auvora is a secure, non-custodial wallet for managing digital assets across Ethereum, Solana, Bitcoin, and more. Your keys stay on your device.',
  applicationName: appName,
  keywords: [
    'Auvora',
    'crypto wallet',
    'self-custody',
    'multi-chain',
    'Ethereum',
    'Bitcoin',
    'Solana',
    'Web3 wallet',
  ],
  authors: [{ name: 'Auvora' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: appName,
    title: `${appName} — Secure, non-custodial multi-chain wallet`,
    description:
      'Manage digital assets across Ethereum, Solana, Bitcoin, and more. Non-custodial by design — your keys never leave your device.',
    ...(appUrl ? { url: appUrl } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — Secure, non-custodial multi-chain wallet`,
    description:
      'Manage digital assets across Ethereum, Solana, Bitcoin, and more. Non-custodial by design — your keys never leave your device.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF1F4' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0C10' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
