'use client';

import { Alert, Button } from '@auvora/ui';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import {
  NETWORKS,
  TOKENS,
  type WalletAsset,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import { QrPanel } from './QrPanel';
import '../../app/wallet-experience.css';

const DEMO_ADDRESSES: Record<WalletNetwork, string> = {
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ethereum: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  solana: '7EqQdEULxWcra9C2wv2GMqW8t1iQ8W2xQqK8YqK8YqK8',
  polygon: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  bnb: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  tron: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
};

export function ReceiveExperience(): ReactElement {
  const [network, setNetwork] = useState<WalletNetwork>('ethereum');
  const [asset, setAsset] = useState<WalletAsset>('ETH');
  const address = DEMO_ADDRESSES[network];
  const tokens = useMemo(() => TOKENS.filter((t) => t.networks.includes(network)), [network]);

  return (
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href="/wallets">Wallets</Link>
          </p>
          <h1>Receive</h1>
          <p className="wx__sub">
            Share a verified address with QR, copy, or system share — always double-check the
            network.
          </p>
        </div>
      </header>

      <section className="wx-panel">
        <h2>Network & token</h2>
        <div className="wx-choice-grid" role="radiogroup" aria-label="Network">
          {NETWORKS.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`wx-choice ${network === n.id ? 'wx-choice--on' : ''}`}
              aria-pressed={network === n.id}
              onClick={() => {
                setNetwork(n.id);
                const first = TOKENS.find((t) => t.networks.includes(n.id));
                if (first) setAsset(first.id);
              }}
            >
              <strong>{n.label}</strong>
              <span>{n.asset}</span>
            </button>
          ))}
        </div>
        <label className="wx-field">
          <span>Token</span>
          <select value={asset} onChange={(e) => setAsset(e.target.value as WalletAsset)}>
            {tokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.id})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="wx-panel wx-panel--center" aria-label="Receive address">
        <Alert tone="warn" title="Address verification">
          Only send <strong>{asset}</strong> on <strong>{network}</strong> to this address. Assets
          on the wrong network may be unrecoverable.
        </Alert>
        <QrPanel value={address} label={`Receive ${asset} on ${network}`} />
        <div className="wx__actions" style={{ justifyContent: 'center' }}>
          <Link href="/address-book">
            <Button variant="ghost">Address book</Button>
          </Link>
          <Link href="/send">
            <Button variant="secondary">Send instead</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
