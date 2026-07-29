'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'intro', label: 'Intro' },
  { id: 'device', label: 'Device' },
  { id: 'pair', label: 'Pair' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const DEVICES = [
  { id: 'ledger', label: 'Ledger', hint: 'Nano S / X / Stax' },
  { id: 'trezor', label: 'Trezor', hint: 'Model T / Safe' },
  { id: 'keystone', label: 'Keystone', hint: 'Air-gapped QR' },
] as const;

export function HardwareWalletExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('intro');
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('ledger');
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);
  const pairTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pairTimer.current != null) window.clearTimeout(pairTimer.current);
    },
    [],
  );

  function simulatePair(): void {
    setPairing(true);
    if (pairTimer.current != null) window.clearTimeout(pairTimer.current);
    pairTimer.current = window.setTimeout(() => {
      pairTimer.current = null;
      setPairing(false);
      setPaired(true);
      setStep('accounts');
    }, 1200);
  }

  return (
    <WizardShell
      title="Hardware wallet"
      subtitle="Connect a signing device. Keys never leave the hardware."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'intro' ? (
        <section className="wx-panel">
          <Alert tone="info" title="Secure by default">
            Pairing uses the Connections service device session APIs. Confirm every signature on the
            device screen.
          </Alert>
          <WizardActions onNext={() => setStep('device')} />
        </section>
      ) : null}

      {step === 'device' ? (
        <section className="wx-panel">
          <div className="wx-choice-grid" role="radiogroup" aria-label="Device type">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`wx-choice ${device === d.id ? 'wx-choice--on' : ''}`}
                aria-pressed={device === d.id}
                onClick={() => setDevice(d.id)}
              >
                <strong>{d.label}</strong>
                <span>{d.hint}</span>
              </button>
            ))}
          </div>
          <WizardActions onBack={() => setStep('intro')} onNext={() => setStep('pair')} />
        </section>
      ) : null}

      {step === 'pair' ? (
        <section className="wx-panel">
          <h2>Connect {DEVICES.find((d) => d.id === device)?.label}</h2>
          <ol className="wx-bullets">
            <li>Unlock the device</li>
            <li>Open the appropriate app (ETH / BTC / SOL)</li>
            <li>Approve the Auvora pairing request</li>
          </ol>
          {!paired ? (
            <WizardActions
              onBack={() => setStep('device')}
              onNext={simulatePair}
              nextLabel={pairing ? 'Waiting for device…' : 'Start pairing'}
              nextLoading={pairing}
            />
          ) : (
            <WizardActions onNext={() => setStep('accounts')} />
          )}
        </section>
      ) : null}

      {step === 'accounts' ? (
        <section className="wx-panel">
          <h2>Select accounts</h2>
          <ul className="wx-account-list">
            <li>
              <strong>Account 0</strong>
              <span>0x71C7…976F · Ethereum</span>
            </li>
            <li>
              <strong>Account 1</strong>
              <span>0xAbCd…1234 · Ethereum</span>
            </li>
            <li>
              <strong>Bitcoin</strong>
              <span>bc1qxy…0wlh</span>
            </li>
          </ul>
          <WizardActions
            onBack={() => setStep('pair')}
            onNext={() => setStep('done')}
            nextLabel="Import selected"
          />
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title="Hardware connected"
          description="Continue in Connections for live device sessions, permissions, and signing."
          action={
            <div className="wx__actions">
              <Link href="/connections">
                <Button>Open Connections</Button>
              </Link>
              <Link href="/wallets">
                <Button variant="secondary">Wallets</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
