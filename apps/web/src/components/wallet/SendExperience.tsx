'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@auvora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  listContacts,
  markContactUsed,
  recentRecipients,
} from '../../lib/wallet-experience/address-book';
import { DEMO_RECEIVE_ADDRESSES } from '../../lib/wallet-experience/demo-addresses';
import { assessAddressRisk } from '../../lib/wallet-experience/security-prefs';
import {
  NETWORKS,
  TOKENS,
  type FeeSpeed,
  type WalletAsset,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import {
  ASSET_DECIMALS,
  canAppendAmountDigit,
  estimateFeeDisplay,
  isNameLikeRecipient,
  nativeGasAsset,
  parseAmount,
  parseLeadingNumber,
  recipientIssue,
  resolveNamePreview,
  truncateMiddle,
  validateSendAmount,
} from '../../lib/wallet-experience/validation';
import {
  CxActions,
  CxProgressTrack,
  humanizeError,
  TransactionShell,
} from '../transaction/TransactionShell';
import { PublicAddress } from './PublicAddress';
import { networkLabel } from '../../lib/product/networks';
import '../../app/core-experience.css';
import '../../app/wallet-flow.css';

const STEPS = [
  { id: 'asset', label: 'Asset' },
  { id: 'to', label: 'Recipient' },
  { id: 'amount', label: 'Amount' },
  { id: 'fee', label: 'Fee' },
  { id: 'preview', label: 'Review' },
  { id: 'authorize', label: 'Sign' },
  { id: 'progress', label: 'Send' },
  { id: 'receipt', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'] | 'failure';

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

const DEMO_PRICES: Partial<Record<WalletAsset, number>> = {
  BTC: 68420,
  ETH: 3420,
  SOL: 148.2,
  MATIC: 0.55,
  BNB: 580,
  TRX: 0.12,
  USDC: 1,
  USDT: 1,
};

type FailKind =
  'insufficient_gas' | 'rpc' | 'user_rejected' | 'failed' | 'timeout' | 'offline' | 'rate_limited';

function failCopy(kind: FailKind): { title: string; body: string } {
  switch (kind) {
    case 'insufficient_gas':
      return {
        title: 'Not enough network fee',
        body: 'This amount plus the estimated network fee is more than the available gas asset. Reduce the amount or add the native token used for fees.',
      };
    case 'rpc':
      return {
        title: 'Network unavailable',
        body: 'A chain endpoint did not respond. Nothing was sent. Check your connection and try again.',
      };
    case 'user_rejected':
      return {
        title: 'Signing cancelled',
        body: 'You cancelled the request in your local wallet. Nothing was sent.',
      };
    case 'timeout':
      return {
        title: 'Network timed out',
        body: 'The network took too long to respond. Nothing was broadcast. Try again in a moment.',
      };
    case 'offline':
      return {
        title: 'You are offline',
        body: 'Reconnect this device, then review the transaction again.',
      };
    case 'rate_limited':
      return {
        title: 'Temporarily limited',
        body: 'The network asked us to slow down. Wait a moment, then try again.',
      };
    default:
      return {
        title: 'Transaction failed',
        body: 'The transfer could not be completed. Nothing was sent from this wallet.',
      };
  }
}

export function SendExperience(): ReactElement {
  const searchParams = useSearchParams();
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
  const [failKind, setFailKind] = useState<FailKind | null>(null);
  const [signing, setSigning] = useState(false);
  const [reviewChecks, setReviewChecks] = useState({
    recipient: false,
    network: false,
    amount: false,
  });
  const [resolvedTo, setResolvedTo] = useState<{
    address: string;
    provider: string;
  } | null>(null);
  const progressTimer = useRef<number | null>(null);
  const deepLinked = useRef(false);

  useEffect(
    () => () => {
      if (progressTimer.current != null) window.clearInterval(progressTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (deepLinked.current) return;
    const qAsset = searchParams.get('asset')?.toUpperCase();
    const qTo = searchParams.get('to');
    if (!qAsset && !qTo) return;
    deepLinked.current = true;
    if (qAsset) {
      const token = TOKENS.find((t) => t.id === qAsset || t.id.toUpperCase() === qAsset);
      if (token) {
        setAsset(token.id);
        const net = token.networks[0];
        if (net) setNetwork(net);
      }
    }
    if (qTo) {
      setTo(qTo);
      setStep('to');
    } else if (qAsset) {
      setStep('to');
    }
  }, [searchParams]);

  const contacts = useMemo(() => listContacts().filter((c) => c.network === network), [network]);
  const recent = useMemo(() => recentRecipients(4), []);
  const fee = estimateFeeDisplay(network, speed, customGwei);
  const risk = assessAddressRisk(to);
  const tokens = TOKENS.filter((t) => t.networks.includes(network));
  const balance = DEMO_BALANCES[asset] ?? 1;
  const amountNum = parseAmount(amount) ?? 0;
  const price = DEMO_PRICES[asset] ?? 1;
  const fiatApprox = amountNum * price;
  const gasAsset = nativeGasAsset(network);
  const gasBalance = DEMO_BALANCES[gasAsset] ?? 0;
  const feeNative = parseLeadingNumber(fee.feeNative) ?? 0;
  const fromAddress = DEMO_RECEIVE_ADDRESSES[network];
  const destination = resolvedTo?.address ?? to.trim();
  const networkName = NETWORKS.find((n) => n.id === network)?.label ?? networkLabel(network);
  const liveRecipient = to.trim() ? recipientIssue(to, network) : null;

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
    const issue = recipientIssue(trimmed, network);
    if (issue.kind !== 'ok') {
      setError(humanizeError(issue.message, issue.message ?? 'That address is not valid.'));
      return;
    }
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
    setResolvedTo(null);
    setError(null);
    setStep('amount');
  }

  function goFee(): void {
    const check = validateSendAmount(amount, balance, asset);
    if (!check.ok) {
      setError(check.message ?? 'Enter a valid amount.');
      return;
    }
    if (asset === gasAsset && amountNum + feeNative > balance) {
      setError(
        `There is not enough ${asset} to cover this amount plus the estimated network fee (${fee.feeNative}).`,
      );
      return;
    }
    if (asset !== gasAsset && feeNative > gasBalance) {
      setError(
        `Not enough ${gasAsset} to pay the network fee. The fee is paid in ${gasAsset}, not ${asset}.`,
      );
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
    setAmount((a) => {
      if (!canAppendAmountDigit(a, k, ASSET_DECIMALS[asset])) return a;
      return a === '0' && k !== '.' ? k : `${a}${k}`;
    });
  }

  function submit(): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setFailKind('offline');
      setStep('failure');
      return;
    }
    setSigning(true);
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
          setSigning(false);
          setStep('receipt');
          return 100;
        }
        return p + 22;
      });
    }, 280);
  }

  const visibleStep = step === 'failure' ? 'authorize' : step;

  return (
    <TransactionShell
      className="wf"
      title="Send"
      subtitle="Review every step. Nothing leaves until you sign locally."
      reassure="Auvora does not hold your keys and cannot sign this transfer for you."
      steps={[...STEPS]}
      currentStepId={visibleStep}
    >
      <div className="cx-alert cx-alert--info" role="status">
        Transfer preview — confirming does not broadcast until live wallet signing is connected. No
        funds move in this mode. Network fees shown are chain fees, not an Auvora charge.
      </div>
      {step === 'asset' ? (
        <section className="cx-panel">
          <h2>Select asset and network</h2>
          <p>Choose the network first. Tokens on the wrong chain cannot be recovered.</p>
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
                  {n.asset} · {DEMO_BALANCES[n.asset] ?? 0} available
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
          <CxActions onNext={() => setStep('to')} nextLabel={`Send ${asset} on ${networkName}`} />
        </section>
      ) : null}

      {step === 'to' ? (
        <section className="cx-panel">
          <h2>Recipient</h2>
          <p>
            Paste a valid {networkName} address. Auvora will not rewrite a mismatched address for
            you.
          </p>
          <div className="cx-alert cx-alert--warn" role="status">
            <strong>Send only on {networkName}</strong>
            <p>
              This destination must match {networkName}. Addresses on another network may look
              similar and funds sent there can be lost.
            </p>
          </div>
          <div className="cx-field-row">
            <label className="cx-field cx-field--grow" htmlFor="send-destination">
              <span>Destination address</span>
              <input
                id="send-destination"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setResolvedTo(null);
                  setError(null);
                }}
                placeholder={
                  network === 'bitcoin'
                    ? 'bc1…'
                    : network === 'solana'
                      ? 'Base58 address'
                      : network === 'tron'
                        ? 'T…'
                        : '0x…'
                }
                autoComplete="off"
                spellCheck={false}
                aria-invalid={
                  Boolean(error) || Boolean(liveRecipient && liveRecipient.kind !== 'ok')
                }
                aria-describedby="send-recipient-hint"
              />
            </label>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={pasteAddress}>
              Paste
            </button>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setQrOpen(true)}>
              Scan QR
            </button>
          </div>
          {liveRecipient && liveRecipient.kind !== 'ok' && to.trim() ? (
            <div
              className={`cx-alert ${liveRecipient.kind === 'unsupported_network' ? 'cx-alert--warn' : 'cx-alert--error'}`}
              role="alert"
              id="send-recipient-hint"
            >
              {liveRecipient.message}
            </div>
          ) : (
            <p className="cx-meta" id="send-recipient-hint">
              Network: {networkName}
            </p>
          )}
          {isNameLikeRecipient(to) ? (
            <div className="cx-alert cx-alert--info">
              <strong>Name recipient</strong>
              <p>
                Demo name resolve only — not a live ENS or Unstoppable Domains lookup. Destination
                on the review step is a preview address for this session.
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
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setStep('asset')}
            onNext={goAmount}
            nextLabel="Review recipient"
          />
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent>
              <DialogTitle>Scan QR</DialogTitle>
              <DialogDescription>
                Camera scanning is available when the companion camera hook is connected. Paste a
                scanned address below — it will not be rewritten.
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
            Available {balance} {asset} on {networkName}. Max leaves the full balance; keep enough{' '}
            {gasAsset} for the network fee if you are sending the native token.
          </p>
          <label className="cx-field" htmlFor="send-amount">
            <span>Asset amount</span>
            <input
              id="send-amount"
              className="wf-amount-input"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9.]/g, '');
                if (next.includes('-')) return;
                if (decimalSafe(next, ASSET_DECIMALS[asset])) setAmount(next);
              }}
              placeholder="0"
              aria-describedby="send-amount-meta"
            />
          </label>
          <p className="cx-meta" id="send-amount-meta" style={{ textAlign: 'center' }}>
            ≈ ${fiatApprox.toFixed(2)} · Remaining {Math.max(0, balance - amountNum).toFixed(6)}{' '}
            {asset}
          </p>
          <div className="cx-chips" style={{ justifyContent: 'center' }}>
            {PCTS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="cx-chip"
                onClick={() => {
                  const raw = Number(
                    (balance * p.ratio).toFixed(Math.min(8, ASSET_DECIMALS[asset])),
                  );
                  setAmount(String(raw));
                }}
              >
                {p.label === 'Max' ? 'Max' : p.label}
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
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setStep('to')}
            onNext={goFee}
            nextLabel={amountNum ? `Continue with ${amount} ${asset}` : 'Enter amount'}
          />
        </section>
      ) : null}

      {step === 'fee' ? (
        <section className="cx-panel">
          <h2>Network fee</h2>
          <p>
            Estimated {networkName} fee paid in {gasAsset}. Auvora does not add a platform fee on
            top of this estimate.
          </p>
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
                inputMode="numeric"
                value={customGwei}
                onChange={(e) => setCustomGwei(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          <dl className="wf-review">
            <div>
              <dt>Estimated fee</dt>
              <dd>
                {fee.feeNative} ({fee.feeUsd})
              </dd>
            </div>
            <div>
              <dt>Paid in</dt>
              <dd>{gasAsset}</dd>
            </div>
            <div>
              <dt>Total impact</dt>
              <dd>
                {amount || '0'} {asset}
                {asset === gasAsset ? ` + ${fee.feeNative}` : ` and ${fee.feeNative} ${gasAsset}`}
              </dd>
            </div>
          </dl>
          <CxActions
            onBack={() => setStep('amount')}
            onNext={() => setStep('preview')}
            nextLabel="Review transaction"
          />
        </section>
      ) : null}

      {step === 'preview' ? (
        <section className="cx-panel">
          <h2>Review transaction</h2>
          <p>Transfers cannot be reversed. Check every field before signing.</p>
          <dl className="wf-review">
            <div>
              <dt>From</dt>
              <dd>
                <code title={fromAddress}>{truncateMiddle(fromAddress)}</code>
              </dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>
                <code title={destination}>{destination}</code>
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
              <dd>{networkName}</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>
                {amount} {asset}
              </dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>
                {amount} {asset} ≈ ${fiatApprox.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Estimated fee</dt>
              <dd>
                {fee.feeNative} · {fee.eta} (paid in {gasAsset})
              </dd>
            </div>
            <div>
              <dt>Total impact</dt>
              <dd>
                {amount} {asset}
                {asset === gasAsset ? ` + ${fee.feeNative}` : ` + ${fee.feeNative}`}
              </dd>
            </div>
          </dl>
          {risk.level !== 'ok' ? (
            <div className="cx-warn">
              <strong>Proceed carefully</strong>
              <p>Risk signals are still active for this destination.</p>
            </div>
          ) : null}
          <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0' }}>
            <legend style={{ fontWeight: 700, marginBottom: 8 }}>Before you continue</legend>
            {(
              [
                ['recipient', 'I checked the recipient address'],
                ['network', `I confirmed this is ${networkName}`],
                ['amount', 'I confirmed the amount is correct'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}
              >
                <input
                  type="checkbox"
                  checked={reviewChecks[key]}
                  onChange={(e) =>
                    setReviewChecks((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setStep('fee')}
            onNext={() => {
              if (!reviewChecks.recipient || !reviewChecks.network || !reviewChecks.amount) {
                setError('Confirm each checklist item before sending.');
                return;
              }
              setError(null);
              setStep('authorize');
            }}
            nextLabel="Sign with local wallet"
          />
        </section>
      ) : null}

      {step === 'authorize' ? (
        <section className="cx-panel wf-sign">
          <h2>Sign with your local wallet</h2>
          <p>
            Auvora cannot custody or sign this transfer for you. Authorization happens on this
            device or your paired mobile wallet. Your private key and seed phrase stay on-device and
            are never shown here.
          </p>
          <p className="cx-meta">
            You are about to authorize {amount} {asset} on {networkName} to{' '}
            {truncateMiddle(destination)}.
          </p>
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setStep('preview')}
            onNext={() => {
              setError(null);
              void submit();
            }}
            nextLabel={`Send ${amount} ${asset}`}
            nextLoading={signing}
            backLabel="Back to review"
          />
        </section>
      ) : null}

      {step === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Preparing transfer preview — waiting on local wallet…"
          stages={['Queued', 'Local sign', 'Submitted', 'Done']}
        />
      ) : null}

      {step === 'receipt' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Transaction submitted</h2>
          <p>
            This companion recorded a review receipt. Live broadcast stays off until wallet signing
            rails are connected. Treat the reference as a preview hash — not a confirmed on-chain
            transfer.
          </p>
          <dl className="wf-review">
            <div>
              <dt>Amount</dt>
              <dd>
                {amount} {asset}
              </dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd>
                <code title={destination}>{truncateMiddle(destination)}</code>
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{networkName}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>
                <PublicAddress
                  value={txHash ?? ''}
                  copyEnabled
                  label="Preview reference"
                  copyLabel="Copy reference"
                />
              </dd>
            </div>
          </dl>
          <p className="wf-quiet">
            Explorer links open when a live network hash is available. Preview references are not
            sent to a block explorer.
          </p>
          <div className="cx-success__cta">
            <Link href="/dashboard" className="cx-btn cx-btn--primary">
              Back to wallet
            </Link>
            <Link href="/activity" className="cx-btn cx-btn--ghost">
              View activity
            </Link>
          </div>
        </div>
      ) : null}

      {step === 'failure' && failKind ? (
        <section className="cx-panel">
          <h2>{failCopy(failKind).title}</h2>
          <p>{failCopy(failKind).body}</p>
          <div className="wf-actions">
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              onClick={() => {
                setFailKind(null);
                setStep('preview');
              }}
            >
              Review transaction
            </button>
            <Link href="/dashboard" className="cx-btn cx-btn--ghost">
              Back to wallet
            </Link>
          </div>
        </section>
      ) : null}
    </TransactionShell>
  );
}

function decimalSafe(value: string, max: number): boolean {
  if (!value) return true;
  if ((value.match(/\./g) ?? []).length > 1) return false;
  const dot = value.indexOf('.');
  if (dot < 0) return true;
  return value.slice(dot + 1).length <= max;
}
