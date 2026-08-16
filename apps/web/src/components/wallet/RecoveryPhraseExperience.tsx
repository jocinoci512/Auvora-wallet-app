'use client';

import { Alert, Button, Checkbox, SuccessState } from '@auvora/ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useEffect, type ReactElement } from 'react';
import {
  generateDemoPhrase,
  pickChallengeIndexes,
} from '../../lib/wallet-experience/recovery-demo';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';
import '../../app/consumer.css';

const STEPS = [
  { id: 'warn', label: 'Warnings' },
  { id: 'educate', label: 'Education' },
  { id: 'display', label: 'Display' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'verify', label: 'Verify' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function RecoveryPhraseExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('warn');
  const [phrase] = useState(() => generateDemoPhrase(12));
  const [revealed, setRevealed] = useState(false);
  const [acks, setAcks] = useState({ alone: false, write: false, neverShare: false });
  const [challenges, setChallenges] = useState<{ index: number; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const masked = useMemo(() => phrase.map(() => '••••'), [phrase]);

  useEffect(() => {
    if (step !== 'display') setRevealed(false);
    return () => setRevealed(false);
  }, [step]);

  function beginVerify(): void {
    const idxs = pickChallengeIndexes(phrase.length, 3);
    setChallenges(idxs.map((index) => ({ index, value: '' })));
    setStep('verify');
  }

  function check(): void {
    const ok = challenges.every((c) => phrase[c.index] === c.value.trim().toLowerCase());
    if (!ok) {
      setError('Those words do not match. Look at your written backup and try again.');
      return;
    }
    setError(null);
    setStep('done');
  }

  return (
    <WizardShell
      title="Recovery rehearsal"
      subtitle="Secure display, confirmation checklist, and verification — without persisting secrets."
      steps={[...STEPS]}
      currentStepId={step}
      backHref="/wallets/onboarding"
    >
      {step === 'warn' ? (
        <section className="wx-panel">
          <Alert tone="warn" title="Stay somewhere private">
            This rehearsal uses a disposable demo phrase kept only in memory. Auvora never asks for
            your recovery phrase in email, chat, or support.
          </Alert>
          <ul className="wx-checklist">
            <li>
              <Checkbox
                checked={acks.alone}
                onCheckedChange={(v) => setAcks((a) => ({ ...a, alone: v === true }))}
                label="I am somewhere private"
              />
            </li>
            <li>
              <Checkbox
                checked={acks.write}
                onCheckedChange={(v) => setAcks((a) => ({ ...a, write: v === true }))}
                label="I have pen and paper ready (no screenshots)"
              />
            </li>
            <li>
              <Checkbox
                checked={acks.neverShare}
                onCheckedChange={(v) => setAcks((a) => ({ ...a, neverShare: v === true }))}
                label="I will never share these words"
              />
            </li>
          </ul>
          <WizardActions
            onNext={() => setStep('educate')}
            nextDisabled={!(acks.alone && acks.write && acks.neverShare)}
          />
        </section>
      ) : null}

      {step === 'educate' ? (
        <section className="wx-panel">
          <h2>Education</h2>
          <ul className="wx-bullets">
            <li>Order matters — word #1 is not interchangeable with word #12</li>
            <li>Store offline; avoid cloud notes and photos</li>
            <li>Anyone with the phrase can move funds</li>
            <li>Auvora support will never ask for it</li>
          </ul>
          <WizardActions onBack={() => setStep('warn')} onNext={() => setStep('display')} />
        </section>
      ) : null}

      {step === 'display' ? (
        <section className="wx-panel">
          <div className="wx-phrase-toolbar">
            <h2>Recovery phrase</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)}>
              {revealed ? (
                <>
                  <EyeOff size={14} aria-hidden /> Hide
                </>
              ) : (
                <>
                  <Eye size={14} aria-hidden /> Reveal
                </>
              )}
            </Button>
          </div>
          <ol
            className={`wx-phrase-grid as-sensitive${revealed ? ' is-revealed' : ''}`}
            aria-label="Recovery words"
          >
            {(revealed ? phrase : masked).map((w, i) => (
              <li key={i}>
                <span className="wx-phrase-num">{i + 1}</span>
                <span className="wx-phrase-word">{w}</span>
              </li>
            ))}
          </ol>
          <WizardActions
            onBack={() => setStep('educate')}
            onNext={() => setStep('confirm')}
            nextDisabled={!revealed}
            nextLabel="I wrote it down"
          />
        </section>
      ) : null}

      {step === 'confirm' ? (
        <section className="wx-panel">
          <Alert tone="info" title="Confirmation">
            Next we will ask for a few random words to confirm your backup.
          </Alert>
          <WizardActions
            onBack={() => setStep('display')}
            onNext={beginVerify}
            nextLabel="Start verification"
          />
        </section>
      ) : null}

      {step === 'verify' ? (
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
            <Alert tone="error" title="Try again">
              {error}
            </Alert>
          ) : null}
          <WizardActions onBack={() => setStep('confirm')} onNext={check} nextLabel="Verify" />
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title="Backup confirmed"
          description="Demo phrase discarded from UI state on navigation. Enable PIN under Security."
          action={
            <div className="wx__actions">
              <Link href="/settings/security">
                <Button>Security settings</Button>
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
