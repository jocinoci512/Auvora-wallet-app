'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  listContacts,
  markContactUsed,
  recentRecipients,
} from '../../lib/wallet-experience/address-book';
import { assessAddressRisk } from '../../lib/wallet-experience/security-prefs';
import {
  NETWORKS,
  TOKENS,
  type FeeSpeed,
  type WalletAsset,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import {
  estimateFeeDisplay,
  isNameLikeRecipient,
  parseAmount,
  resolveNamePreview,
  validateAddressFormat,
} from '../../lib/wallet-experience/validation';
import {
  CxActions,
  CxProgressTrack,
  humanizeError,
  TransactionShell,
} from '../transaction/TransactionShell';
import '../../app/core-experience.css';

const STEPS = [
  { id: 'asset', label: 'Asset' },
  { id: 'to', label: 'To' },
  { id: 'amount', label: 'Amount' },
  { id: 'fee', label: 'Fee' },
  { id: 'preview', label: 'Review' },
  { id: 'progress', label: 'Send' },
  { id: 'receipt', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const PCTS = [
  { label: '25%', ratio: 0.25 },
  { label: '50%', ratio: 0.5 },
  { label: '75%', ratio: 0.75 },
  { label: 'Max', ratio: 1 },
] as const;

/** Demo available balances for keypad Max — presentation layer only. */
const DEMO_BALANCES: Partial<Record<WalletAsset, number>> = {
  ETH: 8.15,
  BTC: 0.42,
  SOL: 126,
  USDC: 2400,
  USDT: 900,
  MATIC: 420,
  BNB: 3.2,
  TRX: 12000,
};

export function SendExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('asset');
  const [network, setNetwork] = useState<WalletNetwork>('ethereum');
  const [asset, setAsset] = useState<WalletAsset>('ETH');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [speed, setSpeed] = useState<FeeSpeed>('standard');
  const [customGwei, setCustomGwei] = useState(24);
  const [qrOpen, setQrOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [assetQuery, setAssetQuery] = useState('');
  const [resolvedTo, setResolvedTo] = useState<{
    address: string;
    provider: string;
  } | null>(null);
  const progressTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (progressTimer.current != null) window.clearInterval(progressTimer.current);
    },
    [],
  );

  const contacts = useMemo(() => listContacts().filter((c) => c.network === network), [network]);
  const recent = useMemo(() => recentRecipients(4), []);
  const fee = estimateFeeDisplay(network, speed, customGwei);
  const risk = assessAddressRisk(to);
  const tokens = TOKENS.filter((t) => t.networks.includes(network));
  const balance = DEMO_BALANCES[asset] ?? 1;
  const amountNum = parseAmount(amount) ?? 0;
  const fiatApprox = amountNum * (asset === 'BTC' ? 68420 : asset === 'ETH' ? 3420 : 1);

  const filteredNetworks = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    if (!q) return NETWORKS;
    return NETWORKS.filter(
      (n) => n.label.toLowerCase().includes(q) || n.asset.toLowerCase().includes(q),
    );
  }, [assetQuery]);

  function pasteAddress(): void {
    void navigator.clipboard
      ?.readText?.()
      .then((text) => {
        if (text) {
          setTo(text.trim());
          setResolvedTo(null);
          setError(null);
        }
      })
      .catch(() => {
        setError('Clipboard access was blocked. Paste the address manually.');
      });
  }

  function goAmount(): void {
    const trimmed = to.trim();
    if (isNameLikeRecipient(trimmed)) {
      const resolved = resolveNamePreview(trimmed);
      if (!resolved.ok || !resolved.address) {
        setError(
          humanizeError(resolved.message, 'That name could not be resolved for this network.'),
        );
        return;
      }
      setResolvedTo({ address: resolved.address, provider: resolved.provider ?? 'ENS' });
      setError(null);
      setStep('amount');
      return;
    }
    const v = validateAddressFormat(trimmed, network);
    if (!v.ok) {
      setError(humanizeError(v.message, 'That address does not look right for this network.'));
      return;
    }
    setResolvedTo(null);
    setError(null);
    setStep('amount');
  }

  function goFee(): void {
    if (parseAmount(amount) == null) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (amountNum > balance) {
      setError('There is not enough balance for this amount.');
      return;
    }
    setError(null);
    setStep('fee');
  }

  function appendKey(k: string): void {
    if (k === '⌫') {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (k === '.' && amount.includes('.')) return;
    setAmount((a) => (a === '0' && k !== '.' ? k : `${a}${k}`));
  }

  function submit(): void {
    setStep('progress');
    setProgress(12);
    if (progressTimer.current != null) window.clearInterval(progressTimer.current);
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (progressTimer.current != null) window.clearInterval(progressTimer.current);
          progressTimer.current = null;
          const hash = `0x${crypto.randomUUID().replace(/-/g, '')}`;
          setTxHash(hash);
          const match = contacts.find((c) => c.address.toLowerCase() === to.trim().toLowerCase());
          if (match) markContactUsed(match.id);
          setStep('receipt');
          return 100;
        }
        return p + 22;
      });
    }, 280);
  }

  return (
    <TransactionShell
      title="Send"
      subtitle="Clear steps. Clear fees. Nothing leaves until you confirm."
      reassure="Preview flow until live broadcast connects — we still check address and network before you continue."
      steps={[...STEPS]}
      currentStepId={step}
    >
      <div className="cx-alert cx-alert--info" role="status">
        Transfer preview — confirming does not broadcast to a network until wallet signing is
        connected. No funds move in this mode.
      </div>
      {step === 'asset' ? (
        <section className="cx-panel">
          <h2>Choose asset</h2>
          <p>Pick the network and token you want to send.</p>
          <label className="cx-field">
            <span>Search</span>
            <input
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
              placeholder="Bitcoin, Ethereum, SOL…"
              autoComplete="off"
            />
          </label>
          <div className="cx-choice-grid" role="radiogroup" aria-label="Network">
            {filteredNetworks.map((n) => (
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
                <span>
                  {n.asset} · bal {(DEMO_BALANCES[n.asset] ?? 0).toString()}
                </span>
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
          <CxActions onNext={() => setStep('to')} />
        </section>
      ) : null}

      {step === 'to' ? (
        <section className="cx-panel">
          <h2>Recipient</h2>
          <p>Address, ENS-style name, address book, or paste from clipboard.</p>
          <div className="cx-field-row">
            <label className="cx-field cx-field--grow">
              <span>To</span>
              <input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setResolvedTo(null);
                }}
                placeholder="0x… / name.eth / paste"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={pasteAddress}>
              Paste
            </button>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setQrOpen(true)}>
              QR
            </button>
          </div>
          {isNameLikeRecipient(to) ? (
            <div className="cx-alert cx-alert--info">
              <strong>Name recipient</strong>
              <p>
                We will resolve this via ENS or Unstoppable Domains and show the destination address
                on the review step before anything is sent.
              </p>
            </div>
          ) : null}
          {risk.level !== 'ok' && to.trim() && !isNameLikeRecipient(to) ? (
            <div className={`cx-alert ${risk.level === 'high' ? 'cx-alert--error' : 'cx-warn'}`}>
              <strong>
                {risk.level === 'high' ? 'Stop and check' : 'Double-check this address'}
              </strong>
              <ul>
                {risk.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {recent.length ? (
            <>
              <h3 style={{ fontSize: '0.8125rem', color: 'var(--cx-muted)' }}>Recent</h3>
              <div className="cx-chips">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cx-chip"
                    onClick={() => {
                      setNetwork(c.network);
                      setTo(c.address);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {contacts.length ? (
            <>
              <h3 style={{ fontSize: '0.8125rem', color: 'var(--cx-muted)' }}>Address book</h3>
              <div className="cx-chips">
                {contacts.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cx-chip"
                    onClick={() => setTo(c.address)}
                  >
                    {c.favorite ? '★ ' : ''}
                    {c.name}
                  </button>
                ))}
              </div>
              <Link href="/address-book" className="cx-link">
                Manage contacts
              </Link>
            </>
          ) : null}
          {error ? <div className="cx-alert cx-alert--error">{error}</div> : null}
          <CxActions onBack={() => setStep('asset')} onNext={goAmount} />
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent>
              <DialogTitle>Scan QR</DialogTitle>
              <DialogDescription>
                Camera scanning hooks in production. For now, paste the scanned value below.
              </DialogDescription>
              <label className="cx-field">
                <span>Scanned value</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x… / bc1…"
                />
              </label>
              <button
                type="button"
                className="cx-btn cx-btn--primary"
                onClick={() => setQrOpen(false)}
              >
                Use address
              </button>
            </DialogContent>
          </Dialog>
        </section>
      ) : null}

      {step === 'amount' ? (
        <section className="cx-panel">
          <h2>Amount</h2>
          <p>
            Available {balance} {asset}
          </p>
          <p className="cx-amount-display">
            {amount || '0'}{' '}
            <span style={{ fontSize: '1rem', color: 'var(--cx-muted)' }}>{asset}</span>
          </p>
          <p className="cx-meta" style={{ textAlign: 'center' }}>
            ≈ ${fiatApprox.toFixed(2)} · Remaining {(balance - amountNum).toFixed(6)} {asset}
          </p>
          <div className="cx-chips" style={{ justifyContent: 'center' }}>
            {PCTS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="cx-chip"
                onClick={() => setAmount(String(Number((balance * p.ratio).toFixed(8))))}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="cx-keypad" aria-label="Amount keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
              <button key={k} type="button" onClick={() => appendKey(k)}>
                {k}
              </button>
            ))}
          </div>
          {error ? <div className="cx-alert cx-alert--error">{error}</div> : null}
          <CxActions onBack={() => setStep('to')} onNext={goFee} />
        </section>
      ) : null}

      {step === 'fee' ? (
        <section className="cx-panel">
          <h2>Network fee</h2>
          <p>Choose speed. Fees update with network conditions.</p>
          <div className="cx-choice-grid" role="radiogroup" aria-label="Fee speed">
            {(['slow', 'standard', 'fast', 'custom'] as FeeSpeed[]).map((s) => {
              const est = estimateFeeDisplay(network, s, customGwei);
              return (
                <button
                  key={s}
                  type="button"
                  className={`cx-choice ${speed === s ? 'cx-choice--on' : ''}`}
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                >
                  <strong>{est.label}</strong>
                  <span>
                    {est.feeNative} · {est.eta}
                  </span>
                </button>
              );
            })}
          </div>
          {speed === 'custom' ? (
            <label className="cx-field">
              <span>Custom gwei</span>
              <input
                type="number"
                min={1}
                value={customGwei}
                onChange={(e) => setCustomGwei(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          <p className="cx-meta">
            Est. fee {fee.feeNative} ({fee.feeUsd}) · ETA {fee.eta}
          </p>
          <CxActions onBack={() => setStep('amount')} onNext={() => setStep('preview')} />
        </section>
      ) : null}

      {step === 'preview' ? (
        <section className="cx-panel">
          <h2>Review send</h2>
          <p>Confirm every detail. This cannot be undone on-chain.</p>
          <div className="cx-confirm">
            <dl>
              <div>
                <dt>You send</dt>
                <dd>
                  {amount} {asset}
                </dd>
              </div>
              <div>
                <dt>≈ Fiat</dt>
                <dd>${fiatApprox.toFixed(2)}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>
                  <code>{to}</code>
                </dd>
              </div>
              {resolvedTo ? (
                <div>
                  <dt>Resolves to ({resolvedTo.provider})</dt>
                  <dd>
                    <code>{resolvedTo.address}</code>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Network</dt>
                <dd>{network}</dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>
                  {fee.feeNative} · {fee.eta}
                </dd>
              </div>
              <div>
                <dt>Arrival</dt>
                <dd>{fee.eta}</dd>
              </div>
            </dl>
          </div>
          {risk.level !== 'ok' ? (
            <div className="cx-warn">
              <strong>Proceed carefully</strong>
              <p>Risk signals are still active for this destination.</p>
            </div>
          ) : null}
          <CxActions
            onBack={() => setStep('fee')}
            onNext={submit}
            nextLabel={`Send ${amount} ${asset}`}
          />
        </section>
      ) : null}

      {step === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Running transfer preview…"
          stages={['Queued', 'Simulated', 'Review', 'Done']}
        />
      ) : null}

      {step === 'receipt' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Preview complete</h2>
          <p>
            Nothing was sent. This walkthrough prepared {amount} {asset} for review only.
          </p>
          <div className="cx-alert cx-alert--info" role="status">
            The hash below is a simulated reference for UI testing — not an on-chain transaction.
          </div>
          <div className="cx-confirm" style={{ textAlign: 'left' }}>
            <dl>
              <div>
                <dt>Preview reference</dt>
                <dd>
                  <code>{txHash}</code>
                </dd>
              </div>
              <div>
                <dt>Estimated fee</dt>
                <dd>{fee.feeNative}</dd>
              </div>
            </dl>
          </div>
          <div className="cx-success__cta">
            <Link href="/activity" className="cx-btn cx-btn--primary">
              View activity
            </Link>
            <button
              type="button"
              className="cx-btn cx-btn--ghost"
              onClick={() => {
                setStep('asset');
                setAmount('');
                setTo('');
                setTxHash(null);
              }}
            >
              Start again
            </button>
          </div>
        </div>
      ) : null}
    </TransactionShell>
  );
}
