'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { createApiClient, formatApiError, getStoredAccessToken } from '../../lib/api-client';
import { NETWORKS, type WalletNetwork } from '../../lib/wallet-experience/types';
import { validateAddressFormat } from '../../lib/wallet-experience/validation';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'intro', label: 'Intro' },
  { id: 'network', label: 'Network' },
  { id: 'address', label: 'Address' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const NETWORK_TO_API: Record<WalletNetwork, string> = {
  bitcoin: 'BITCOIN',
  ethereum: 'ETHEREUM',
  solana: 'SOLANA',
  polygon: 'POLYGON',
  bnb: 'BNB_SMART_CHAIN',
  tron: 'TRON',
};

export function WatchOnlyExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('intro');
  const [network, setNetwork] = useState<WalletNetwork>('ethereum');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('Watch account');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [liveRegistered, setLiveRegistered] = useState(false);

  function validateAndContinue(): void {
    const result = validateAddressFormat(address, network);
    if (!result.ok) {
      setError(result.message ?? 'Invalid address');
      return;
    }
    if (/mnemonic|private.?key|seed/i.test(address) || address.trim().split(/\s+/).length >= 12) {
      setError('Never paste a seed phrase or private key. Public addresses only.');
      return;
    }
    setError(null);
    setStep('confirm');
  }

  async function registerWatch(): Promise<void> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!getStoredAccessToken()) {
        setInfo(
          'Not signed in — address kept locally for this session only. Sign in to sync public addresses to your Auvora account.',
        );
        setLiveRegistered(false);
        setStep('done');
        return;
      }
      const client = createApiClient({ timeoutMs: 15_000 });
      await client.addWatchAddress({
        network: NETWORK_TO_API[network],
        address: address.trim(),
        label: label.trim() || 'Watch account',
      });
      setLiveRegistered(true);
      setInfo(
        'Public address registered on your Auvora account (watch-only). No keys were uploaded.',
      );
      setStep('done');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function startOwnershipChallenge(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!getStoredAccessToken()) {
        setError('Sign in to run an ownership challenge.');
        return;
      }
      const client = createApiClient({ timeoutMs: 15_000 });
      const challenge = await client.createOwnershipChallenge({
        network: NETWORK_TO_API[network],
        address: address.trim(),
      });
      setChallengeId(challenge.challengeId);
      setChallengeMessage(challenge.message);
      setInfo(
        'Sign this message on Auvora Mobile (personal_sign), then paste the signature. Never enter a seed.',
      );
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOwnership(): Promise<void> {
    if (!challengeId || !signature.trim()) {
      setError('Paste the signature from mobile first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = createApiClient({ timeoutMs: 15_000 });
      await client.verifyOwnershipChallenge({
        challengeId,
        signature: signature.trim(),
      });
      setLiveRegistered(true);
      setInfo('Ownership verified. Address linked to your account as ownership_verified.');
      setStep('done');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardShell
      title="Watch-only wallet"
      subtitle="Register a public address on your Auvora account. Keys stay on your devices."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'intro' ? (
        <section className="wx-panel">
          <Alert tone="info" title="Public addresses only">
            Watch-only and ownership-linked addresses never upload private keys, seeds, or
            mnemonics. Supported: BTC, ETH, SOL, BSC, TRON, Polygon.
          </Alert>
          <WizardActions onNext={() => setStep('network')} />
        </section>
      ) : null}

      {step === 'network' ? (
        <section className="wx-panel">
          <div className="wx-choice-grid" role="radiogroup" aria-label="Network">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`wx-choice ${network === n.id ? 'wx-choice--on' : ''}`}
                aria-pressed={network === n.id}
                onClick={() => setNetwork(n.id)}
              >
                <strong>{n.label}</strong>
                <span>{n.asset}</span>
              </button>
            ))}
          </div>
          <WizardActions onBack={() => setStep('intro')} onNext={() => setStep('address')} />
        </section>
      ) : null}

      {step === 'address' ? (
        <section className="wx-panel">
          <label className="wx-field">
            <span>Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={48} />
          </label>
          <label className="wx-field">
            <span>Public address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste address"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {error ? (
            <Alert tone="error" title="Validation">
              {error}
            </Alert>
          ) : null}
          <WizardActions onBack={() => setStep('network')} onNext={validateAndContinue} />
        </section>
      ) : null}

      {step === 'confirm' ? (
        <section className="wx-panel">
          <dl className="wx-kv">
            <div>
              <dt>Label</dt>
              <dd>{label}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{network}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                <code>{address}</code>
              </dd>
            </div>
          </dl>
          {error ? (
            <Alert tone="error" title="Could not register">
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert tone="info" title="Status">
              {info}
            </Alert>
          ) : null}
          {challengeMessage ? (
            <label className="wx-field">
              <span>Challenge message (sign on mobile)</span>
              <textarea rows={6} readOnly value={challengeMessage} />
              <span>Signature (hex)</span>
              <textarea
                rows={3}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                spellCheck={false}
                placeholder="0x…"
              />
            </label>
          ) : null}
          <div className="wx__actions">
            <Button variant="secondary" disabled={busy} onClick={() => setStep('address')}>
              Back
            </Button>
            <Button disabled={busy} onClick={() => void registerWatch()}>
              {busy ? 'Working…' : 'Add watch-only'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void startOwnershipChallenge()}
            >
              Prove ownership (EVM)
            </Button>
            {challengeId ? (
              <Button disabled={busy} onClick={() => void verifyOwnership()}>
                Verify signature
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title={liveRegistered ? 'Address registered' : 'Watch-only staged'}
          description={
            info ||
            'Public metadata only. Open Portfolio when signed in to fetch live balances server-side.'
          }
          action={
            <div className="wx__actions">
              <Link href="/portfolio">
                <Button>Open Portfolio</Button>
              </Link>
              <Link href="/web3/pair">
                <Button variant="secondary">Pair mobile</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="secondary">Sign in</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
