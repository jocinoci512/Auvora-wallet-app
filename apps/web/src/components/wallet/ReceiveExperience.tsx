'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import {
  NETWORKS,
  TOKENS,
  type WalletAsset,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import { QrPanel } from './QrPanel';
import { TransactionShell } from '../transaction/TransactionShell';
import '../../app/core-experience.css';

const DEMO_ADDRESSES: Record<WalletNetwork, string> = {
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ethereum: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  solana: '7EqQdEULxWcraVx1VfyQW9XbnAHKKfwdERJXNqTUHxN',
  polygon: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  bnb: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  tron: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
};

const ETA: Record<WalletNetwork, string> = {
  bitcoin: '~10–60 min',
  ethereum: '~15 sec – 2 min',
  solana: '~400 ms – 2 sec',
  polygon: '~2–30 sec',
  bnb: '~3–30 sec',
  tron: '~3–60 sec',
};

export function ReceiveExperience(): ReactElement {
  const [network, setNetwork] = useState<WalletNetwork>('ethereum');
  const [asset, setAsset] = useState<WalletAsset>('ETH');
  const address = DEMO_ADDRESSES[network];
  const tokens = useMemo(() => TOKENS.filter((t) => t.networks.includes(network)), [network]);

  return (
    <TransactionShell
      title="Receive"
      subtitle="Share one clear address. Always match the network."
      reassure="Assets sent on the wrong network may be unrecoverable."
      backHref="/dashboard"
    >
      <section className="cx-panel">
        <h2>Network & token</h2>
        <div className="cx-choice-grid" role="radiogroup" aria-label="Network">
          {NETWORKS.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`cx-choice ${network === n.id ? 'cx-choice--on' : ''}`}
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
        <label className="cx-field">
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

      <section className="cx-panel cx-qr-stage" aria-label="Receive address">
        <div className="cx-alert cx-alert--info" role="status">
          Companion receive preview — addresses here are demo placeholders until funding rails are
          unlocked on the signed mobile wallet.
        </div>
        <div className="cx-warn">
          <strong>
            Only send {asset} on {NETWORKS.find((n) => n.id === network)?.label ?? network}
          </strong>
          <p>
            Estimated confirmation time: {ETA[network]}. Verify the network and address before
            sharing. Wrong-network deposits can be unrecoverable.
          </p>
        </div>
        <QrPanel value={address} label={`Receive ${asset} on ${network}`} />
        <p className="cx-meta">Demo address for {network} · practice sharing only</p>
        <div className="cx-success__cta">
          <Link href="/address-book" className="cx-btn cx-btn--ghost">
            Address book
          </Link>
          <Link href="/send" className="cx-btn cx-btn--ghost">
            Send instead
          </Link>
        </div>
      </section>
    </TransactionShell>
  );
}
