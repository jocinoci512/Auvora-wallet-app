'use client';

import { Alert, Button, Checkbox, SuccessState, Textarea } from '@auvora/ui';
import Link from 'next/link';
import { useMemo, useState, useEffect, type ReactElement } from 'react';
import {
  generateDemoPhrase,
  normalizePhrase,
  pickChallengeIndexes,
} from '../../lib/wallet-experience/recovery-demo';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'educate', label: 'Learn' },
  { id: 'enter', label: 'Enter' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function RestoreWalletExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('educate');
  /** Session reference for demo restore rehearsal */
  const [reference] = useState(() => generateDemoPhrase(12));
  const [useReference, setUseReference] = useState(false);
  const [phraseText, setPhraseText] = useState('');
  const [challenges, setChallenges] = useState<{ index: number; value: string }[]>([]);
  const [checks, setChecks] = useState({ device: false, alone: false, verified: false });
  const [error, setError] = useState<string | null>(null);

  const words = useMemo(() => normalizePhrase(phraseText), [phraseText]);

  useEffect(() => {
    return () => {
      setPhraseText('');
    };
  }, []);

  function startChallenge(): void {
    const target = useReference ? reference : words;
    if (target.length !== 12 && target.length !== 24) {
      setError('Need a 12- or 24-word phrase.');
      return;
    }
    setError(null);
    const idxs = pickChallengeIndexes(target.length, 3);
    setChallenges(idxs.map((index) => ({ index, value: '' })));
    setStep('challenge');
  }

  function verifyChallenge(): void {
    const target = useReference ? reference : words;
    const ok = challenges.every((c) => (target[c.index] ?? '') === c.value.trim().toLowerCase());
    if (!ok) {
      setError('Challenge words do not match.');
      return;
    }
    setError(null);
    setStep('checklist');
  }

  return (
    <WizardShell
      title="Restore wallet"
      subtitle="Recover access from a backup phrase with verification and a safety checklist."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'educate' ? (
        <section className="wx-panel">
          <Alert tone="info" title="How restore works">
            Restoring re-derives accounts from your recovery phrase on this device. Auvora account
            APIs never accept a mnemonic. Stay somewhere private.
          </Alert>
          <label className="wx-inline-check">
            <Checkbox
              checked={useReference}
              onCheckedChange={(v) => setUseReference(v === true)}
              label="Practice with a disposable demo phrase (recommended offline)"
            />
          </label>
          {useReference ? (
            <Alert tone="warn" title="Practice mode">
              A disposable demo phrase stays in memory for this session. It is not shown unless you
              reach the entry step.
            </Alert>
          ) : null}
          <WizardActions onNext={() => setStep('enter')} />
        </section>
      ) : null}

      {step === 'enter' ? (
        <section className="wx-panel">
          <label className="wx-field">
            <span>Recovery phrase</span>
            <Textarea
              value={useReference ? reference.join(' ') : phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              rows={4}
              readOnly={useReference}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="auvora-recovery-phrase"
            />
          </label>
          {error ? (
            <Alert tone="error" title="Cannot continue">
              {error}
            </Alert>
          ) : null}
          <WizardActions onBack={() => setStep('educate')} onNext={startChallenge} />
        </section>
      ) : null}

      {step === 'challenge' ? (
        <section className="wx-panel">
          <h2>Phrase verification</h2>
          <div className="wx-challenge-grid">
            {challenges.map((c) => (
              <label key={c.index} className="wx-field">
                <span>Word #{c.index + 1}</span>
                <input
                  value={c.value}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) =>
                    setChallenges((prev) =>
                      prev.map((x) => (x.index === c.index ? { ...x, value: e.target.value } : x)),
                    )
                  }
                />
              </label>
            ))}
          </div>
          {error ? (
            <Alert tone="error" title="Verification failed">
              {error}
            </Alert>
          ) : null}
          <WizardActions
            onBack={() => setStep('enter')}
            onNext={verifyChallenge}
            nextLabel="Verify"
          />
        </section>
      ) : null}

      {step === 'checklist' ? (
        <section className="wx-panel">
          <h2>Confirmation checklist</h2>
          <ul className="wx-checklist">
            <li>
              <Checkbox
                checked={checks.device}
                onCheckedChange={(v) => setChecks((c) => ({ ...c, device: v === true }))}
                label="I am on a device I trust"
              />
            </li>
            <li>
              <Checkbox
                checked={checks.alone}
                onCheckedChange={(v) => setChecks((c) => ({ ...c, alone: v === true }))}
                label="Nobody else can see this screen"
              />
            </li>
            <li>
              <Checkbox
                checked={checks.verified}
                onCheckedChange={(v) => setChecks((c) => ({ ...c, verified: v === true }))}
                label="I verified the challenge words successfully"
              />
            </li>
          </ul>
          <WizardActions
            onBack={() => setStep('challenge')}
            onNext={() => {
              setPhraseText('');
              setStep('done');
            }}
            nextDisabled={!(checks.device && checks.alone && checks.verified)}
            nextLabel="Complete restore"
          />
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title="Restore rehearsal complete"
          description="Wire this UX to custody restore APIs in production. Next: security lock screen."
          action={
            <div className="wx__actions">
              <Link href="/wallets">
                <Button>Wallets</Button>
              </Link>
              <Link href="/security">
                <Button variant="secondary">Security</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
