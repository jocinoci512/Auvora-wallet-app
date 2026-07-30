import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Manrope, Source_Serif_4, Syne } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@auvora/ui';
import { AccessTokenPanel } from '../components/AccessTokenPanel';
import { Nav } from '../components/Nav';
import { Providers } from '../components/Providers';
import { env } from '../env';
import '@auvora/ui/styles.css';
import './globals.css';

const display = Syne({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-auvora-display',
  display: 'swap',
  preload: true,
});

const body = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-auvora-body',
  display: 'swap',
  preload: true,
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-auvora-serif',
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

const appName = env.NEXT_PUBLIC_APP_NAME;
const appUrl = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: {
    default: `${appName} — The quiet operating system for digital value`,
    template: `%s · ${appName}`,
  },
  description:
    'Auvora web companion for Internal Alpha — preview flows and settings. Mobile holds on-device signing.',
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
    title: `${appName} — Internal Alpha companion`,
    description:
      'Web companion for Auvora Internal Alpha. Preview balances and flows — not a live custodian.',
    ...(appUrl ? { url: appUrl } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — Internal Alpha companion`,
    description:
      'Web companion for Auvora Internal Alpha. Preview balances and flows — not a live custodian.',
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
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
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
            {process.env.NODE_ENV !== 'production' ? <AccessTokenPanel /> : null}
            <main id="main-content">{children}</main>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
