'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SuccessState,
} from '@auvora/ui';
import { ScanLine } from 'lucide-react';
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
  parseAmount,
  validateAddressFormat,
} from '../../lib/wallet-experience/validation';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'asset', label: 'Asset' },
  { id: 'to', label: 'Address' },
  { id: 'amount', label: 'Amount' },
  { id: 'fee', label: 'Fees' },
  { id: 'preview', label: 'Preview' },
  { id: 'progress', label: 'Sending' },
  { id: 'receipt', label: 'Receipt' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

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

  function goAmount(): void {
    const v = validateAddressFormat(to, network);
    if (!v.ok) {
      setError(v.message ?? 'Invalid address');
      return;
    }
    setError(null);
    setStep('amount');
  }

  function goFee(): void {
    if (parseAmount(amount) == null) {
      setError('Enter a valid amount greater than zero');
      return;
    }
    setError(null);
    setStep('fee');
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
    <WizardShell
      title="Send"
      subtitle="Address validation, fees, preview, and a clear receipt — built for confidence."
      steps={[...STEPS]}
      currentStepId={step}
      backHref="/wallets"
      backLabel="Wallets"
    >
      {step === 'asset' ? (
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
          <WizardActions onNext={() => setStep('to')} />
        </section>
      ) : null}

      {step === 'to' ? (
        <section className="wx-panel">
          <div className="wx-field-row">
            <label className="wx-field wx-field--grow">
              <span>Destination address</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Paste address"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => setQrOpen(true)}>
              <ScanLine size={16} aria-hidden /> Scan
            </Button>
          </div>

          {risk.level !== 'ok' && to.trim() ? (
            <Alert tone={risk.level === 'high' ? 'error' : 'warn'} title="Address risk warning">
              <ul>
                {risk.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {recent.length ? (
            <div className="wx-chip-block">
              <h3>Recent</h3>
              <div className="wx-chips">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="wx-chip"
                    onClick={() => {
                      setNetwork(c.network);
                      setTo(c.address);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {contacts.length ? (
            <div className="wx-chip-block">
              <h3>Address book</h3>
              <div className="wx-chips">
                {contacts.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="wx-chip"
                    onClick={() => setTo(c.address)}
                  >
                    {c.favorite ? '★ ' : ''}
                    {c.name}
                  </button>
                ))}
              </div>
              <Link href="/address-book" className="wx-text-link">
                Manage contacts
              </Link>
            </div>
          ) : null}

          {error ? (
            <Alert tone="error" title="Validation">
              {error}
            </Alert>
          ) : null}

          <WizardActions onBack={() => setStep('asset')} onNext={goAmount} />

          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent>
              <DialogTitle>Scan QR</DialogTitle>
              <DialogDescription>
                Camera scanning hooks into the device media stream in production builds. For this
                preview, paste an address or pick from your address book.
              </DialogDescription>
              <label className="wx-field">
                <span>Paste scanned value</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x… / bc1… / …"
                />
              </label>
              <Button type="button" onClick={() => setQrOpen(false)}>
                Use address
              </Button>
            </DialogContent>
          </Dialog>
        </section>
      ) : null}

      {step === 'amount' ? (
        <section className="wx-panel">
          <label className="wx-field">
            <span>Amount ({asset})</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <div className="wx-chips">
            {['0.01', '0.1', '0.5', '1'].map((v) => (
              <button key={v} type="button" className="wx-chip" onClick={() => setAmount(v)}>
                {v}
              </button>
            ))}
          </div>
          {error ? (
            <Alert tone="error" title="Amount">
              {error}
            </Alert>
          ) : null}
          <WizardActions onBack={() => setStep('to')} onNext={goFee} />
        </section>
      ) : null}

      {step === 'fee' ? (
        <section className="wx-panel">
          <h2>Network fee</h2>
          <div className="wx-choice-grid" role="radiogroup" aria-label="Fee speed">
            {(['slow', 'standard', 'fast', 'custom'] as FeeSpeed[]).map((s) => {
              const est = estimateFeeDisplay(network, s, customGwei);
              return (
                <button
                  key={s}
                  type="button"
                  className={`wx-choice ${speed === s ? 'wx-choice--on' : ''}`}
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
            <label className="wx-field">
              <span>Custom gwei</span>
              <input
                type="number"
                min={1}
                value={customGwei}
                onChange={(e) => setCustomGwei(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          <p className="wx-meta">
            Est. fee {fee.feeNative} ({fee.feeUsd}) · ETA {fee.eta}
          </p>
          <WizardActions onBack={() => setStep('amount')} onNext={() => setStep('preview')} />
        </section>
      ) : null}

      {step === 'preview' ? (
        <section className="wx-panel">
          <h2>Transaction preview</h2>
          <dl className="wx-kv">
            <div>
              <dt>You send</dt>
              <dd>
                {amount} {asset}
              </dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>
                <code>{to}</code>
              </dd>
            </div>
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
          </dl>
          {risk.level !== 'ok' ? (
            <Alert tone="warn" title="Proceed carefully">
              Risk signals are still active for this destination.
            </Alert>
          ) : null}
          <WizardActions onBack={() => setStep('fee')} onNext={submit} nextLabel="Confirm & send" />
        </section>
      ) : null}

      {step === 'progress' ? (
        <section className="wx-panel" aria-busy="true" aria-live="polite">
          <h2>Sending…</h2>
          <div className="wx__progress" aria-hidden="true">
            <div className="wx__progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="wx-meta">Broadcasting and waiting for first confirmation.</p>
        </section>
      ) : null}

      {step === 'receipt' ? (
        <SuccessState
          title="Sent"
          description={`Your ${amount} ${asset} transfer was submitted.`}
          action={
            <div className="wx-receipt">
              <dl className="wx-kv">
                <div>
                  <dt>Hash</dt>
                  <dd>
                    <code>{txHash}</code>
                  </dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>{fee.feeNative}</dd>
                </div>
              </dl>
              <div className="wx__actions">
                <Link href="/activity">
                  <Button>View activity</Button>
                </Link>
                <Link href="/send">
                  <Button variant="secondary" onClick={() => setStep('asset')}>
                    Send again
                  </Button>
                </Link>
              </div>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
