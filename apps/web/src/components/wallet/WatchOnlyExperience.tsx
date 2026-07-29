'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
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

export function WatchOnlyExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('intro');
  const [network, setNetwork] = useState<WalletNetwork>('ethereum');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('Watch account');
  const [error, setError] = useState<string | null>(null);

  function validateAndContinue(): void {
    const result = validateAddressFormat(address, network);
    if (!result.ok) {
      setError(result.message ?? 'Invalid address');
      return;
    }
    setError(null);
    setStep('confirm');
  }

  return (
    <WizardShell
      title="Watch-only wallet"
      subtitle="Track balances without granting signing power. Ideal for cold storage monitoring."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'intro' ? (
        <section className="wx-panel">
          <Alert tone="info" title="Read-only by design">
            Watch-only accounts cannot send, swap, or approve. Pair a hardware device later if you
            need to sign.
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
          <WizardActions
            onBack={() => setStep('address')}
            onNext={() => setStep('done')}
            nextLabel="Add watch-only"
          />
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title="Watch-only added"
          description="Persisted via Connections READONLY adapters in production. You can also manage devices under Connect."
          action={
            <div className="wx__actions">
              <Link href="/connections">
                <Button>Open Connections</Button>
              </Link>
              <Link href="/receive">
                <Button variant="secondary">Receive view</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
