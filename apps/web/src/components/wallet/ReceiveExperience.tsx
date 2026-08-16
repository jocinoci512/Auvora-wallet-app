'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';
import {
  NETWORKS,
  TOKENS,
  type WalletAsset,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import { ReleaseConfig } from '../../lib/release/config';
import { DEMO_RECEIVE_ADDRESSES } from '../../lib/wallet-experience/demo-addresses';
import { QrPanel } from './QrPanel';
import { PublicAddress } from './PublicAddress';
import { TransactionShell } from '../transaction/TransactionShell';
import { networkLabel, resolveNetwork } from '../../lib/product/networks';
import '../../app/core-experience.css';
import '../../app/wallet-flow.css';

const ETA: Record<WalletNetwork, string> = {
  bitcoin: '~10–60 min',
  ethereum: '~15 sec – 2 min',
  solana: '~400 ms – 2 sec',
  polygon: '~2–30 sec',
  bnb: '~3–30 sec',
  tron: '~3–60 sec',
};

const ADDRESS_FORMAT: Record<WalletNetwork, string> = {
  bitcoin: 'Bitcoin bech32 or legacy (bc1… / 1… / 3…)',
  ethereum: 'EVM 0x address (42 characters)',
  solana: 'Solana base58 address',
  polygon: 'EVM 0x address (same format as Ethereum, Polygon network)',
  bnb: 'EVM 0x address (same format as Ethereum, BNB Smart Chain)',
  tron: 'Tron address starting with T',
};

export function ReceiveExperience(): ReactElement {
  const searchParams = useSearchParams();
  const initial = searchParams.get('asset')?.toUpperCase();
  const initialToken = TOKENS.find((t) => t.id === initial);
  const [network, setNetwork] = useState<WalletNetwork>(initialToken?.networks[0] ?? 'ethereum');
  const [asset, setAsset] = useState<WalletAsset>(initialToken?.id ?? 'ETH');
  const address = DEMO_RECEIVE_ADDRESSES[network];
  const tokens = useMemo(() => TOKENS.filter((t) => t.networks.includes(network)), [network]);
  const fundingUnlocked = ReleaseConfig.allowFundingAddresses;
  const net = resolveNetwork(network);
  const networkName = net?.label ?? networkLabel(network);

  return (
    <TransactionShell
      className="wf"
      title="Receive"
      subtitle="Share this address only for the selected asset and network."
      reassure="Assets sent on the wrong network may be unrecoverable."
      backHref="/dashboard"
    >
      <section className="cx-panel">
        <p className="wf-kicker">Selected network</p>
        <div className="wf-idrow" style={{ marginBottom: '1rem' }}>
          <span className="wf-netmark" aria-hidden>
            {net?.mark ?? networkName.slice(0, 1)}
          </span>
          <span>
            <strong>{networkName}</strong>
            <small>{ADDRESS_FORMAT[network]}</small>
          </span>
        </div>
        <h2>Asset and network</h2>
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
        <div className="cx-warn">
          <strong>
            Only send {asset} on {networkName} to this address.
          </strong>
          <p>
            Estimated confirmation time: {ETA[network]}. Verify the network name, icon, and address
            format before sharing. Wrong-network deposits can be unrecoverable.
            {network === 'ethereum' || network === 'polygon' || network === 'bnb'
              ? ' EVM addresses can look the same across Ethereum, Polygon, and BNB Smart Chain — the selected network still matters.'
              : null}
          </p>
        </div>
        {!fundingUnlocked ? (
          <>
            <div className="cx-alert cx-alert--warn" role="status">
              {ReleaseConfig.fundingBlockedMessage}
            </div>
            <div className="wf-qr-lock" aria-label="Receive QR locked">
              <strong>QR sharing locked</strong>
              <p>
                This preview will encode the public {asset} address on {networkName} when funding is
                unlocked. No secrets are included.
              </p>
            </div>
            <PublicAddress
              value={address}
              copyEnabled={false}
              label={`Public ${networkName} address`}
            />
          </>
        ) : (
          <>
            <div className="cx-alert cx-alert--info" role="status">
              Companion receive preview — addresses here are demo placeholders until funding rails
              are unlocked on the signed mobile wallet.
            </div>
            <QrPanel
              value={address}
              label={`QR code for ${asset} on ${networkName}`}
              copyEnabled
              shareEnabled
            />
            <PublicAddress value={address} copyEnabled label={`Public ${networkName} address`} />
          </>
        )}
        <div className="cx-success__cta">
          <Link href="/dashboard" className="cx-btn cx-btn--primary">
            Back to wallet
          </Link>
          <Link href="/send" className="cx-btn cx-btn--ghost">
            Send instead
          </Link>
        </div>
      </section>
    </TransactionShell>
  );
}
