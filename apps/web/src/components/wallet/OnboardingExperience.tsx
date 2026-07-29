'use client';

import type { ReactElement } from 'react';
import { Button, Card, CardHeader } from '@auvora/ui';
import { Eye, HardDrive, KeyRound, Plus, RefreshCw, Shield } from 'lucide-react';
import Link from 'next/link';
import '../../app/wallet-experience.css';

const PATHS = [
  {
    href: '/wallets/create',
    title: 'Create wallet',
    description: 'Generate a new account with naming, network selection, and backup guidance.',
    icon: Plus,
  },
  {
    href: '/wallets/import',
    title: 'Import wallet',
    description: 'Bring an existing recovery phrase into Auvora with verification checks.',
    icon: KeyRound,
  },
  {
    href: '/wallets/restore',
    title: 'Restore wallet',
    description: 'Recover access from a backup phrase and confirm word challenges.',
    icon: RefreshCw,
  },
  {
    href: '/wallets/watch',
    title: 'Watch-only',
    description: 'Track balances for a public address without signing capability.',
    icon: Eye,
  },
  {
    href: '/wallets/hardware',
    title: 'Hardware wallet',
    description: 'Pair a Ledger- or Trezor-style device through Connections.',
    icon: HardDrive,
  },
  {
    href: '/wallets/recovery',
    title: 'Recovery rehearsal',
    description: 'Practice secure phrase display, confirmation, and education screens.',
    icon: Shield,
  },
] as const;

export function OnboardingExperience(): ReactElement {
  return (
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href="/wallets">Wallets</Link>
          </p>
          <h1>Wallet onboarding</h1>
          <p className="wx__sub">
            Choose how you want to start. Every path includes progress, validation, and clear
            recovery guidance — designed to feel secure and calm.
          </p>
        </div>
      </header>

      <div className="wx-onboard-grid">
        {PATHS.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.href} className="wx-onboard-card">
              <CardHeader
                title={
                  <span className="wx-onboard-title">
                    <Icon size={18} aria-hidden /> {p.title}
                  </span>
                }
                description={p.description}
                actions={
                  <Link href={p.href}>
                    <Button size="sm">Start</Button>
                  </Link>
                }
              />
            </Card>
          );
        })}
      </div>

      <div className="wx-help">
        <h2>Need help?</h2>
        <p>
          Prefer a guided checklist? Open <Link href="/security">Security settings</Link> for PIN,
          auto-lock, and backup reminders — or continue to your{' '}
          <Link href="/wallets">wallet list</Link>.
        </p>
      </div>
    </div>
  );
}
