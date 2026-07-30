export type SecurityScoreFactor = {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  href: string;
  action: string;
};

export type DemoSession = {
  id: string;
  current: boolean;
  deviceLabel: string;
  platform: string;
  browser: string;
  location: string;
  lastActive: string;
  expiresAt: string;
};

export type DemoDevice = {
  id: string;
  label: string;
  trusted: boolean;
  current: boolean;
  platform: string;
  browser: string;
  lastLogin: string;
  location: string;
};

import { demoConnectedRows, type ConnectedDappRow } from '../web3/sessions';

export type { ConnectedDappRow };

export type SecurityAlert = {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warn' | 'critical';
  timestamp: string;
};

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: 'sess-current',
    current: true,
    deviceLabel: 'This browser',
    platform: 'Windows',
    browser: 'Chrome',
    location: 'Approximate · Local',
    lastActive: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  },
  {
    id: 'sess-2',
    current: false,
    deviceLabel: 'MacBook Pro',
    platform: 'macOS',
    browser: 'Safari',
    location: 'Approximate · Prior region',
    lastActive: '2026-07-20T18:00:00.000Z',
    expiresAt: '2026-07-28T18:00:00.000Z',
  },
];

export const DEMO_DEVICES: DemoDevice[] = [
  {
    id: 'dev-1',
    label: 'This device',
    trusted: true,
    current: true,
    platform: 'Windows 11',
    browser: 'Chrome',
    lastLogin: new Date().toISOString(),
    location: 'Approximate · Local',
  },
  {
    id: 'dev-2',
    label: 'iPhone 15',
    trusted: true,
    current: false,
    platform: 'iOS',
    browser: 'Safari',
    lastLogin: '2026-07-18T09:00:00.000Z',
    location: 'Approximate · Mobile',
  },
  {
    id: 'dev-3',
    label: 'Unknown desktop',
    trusted: false,
    current: false,
    platform: 'Linux',
    browser: 'Firefox',
    lastLogin: '2026-07-10T22:00:00.000Z',
    location: 'Approximate · Unknown',
  },
];

export const DEMO_DAPPS = demoConnectedRows();

export const DEMO_ALERTS: SecurityAlert[] = [
  {
    id: 'a1',
    title: 'New device sign-in',
    detail: 'A session was created from a previously unused browser fingerprint.',
    severity: 'warn',
    timestamp: '2026-07-26T08:00:00.000Z',
  },
  {
    id: 'a2',
    title: 'Backup reminder',
    detail: 'Recovery phrase verification has not been confirmed recently.',
    severity: 'info',
    timestamp: '2026-07-24T12:00:00.000Z',
  },
];

export function computeSecurityScore(factors: SecurityScoreFactor[]): number {
  const total = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const earned = factors.reduce((s, f) => s + (f.ok ? f.weight : 0), 0);
  return Math.round((earned / total) * 100);
}
