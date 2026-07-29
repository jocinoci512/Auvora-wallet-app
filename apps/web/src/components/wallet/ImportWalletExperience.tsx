'use client';

import { Alert, Button, SuccessState, Textarea } from '@auvora/ui';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { normalizePhrase, pickChallengeIndexes } from '../../lib/wallet-experience/recovery-demo';
import { NETWORKS } from '../../lib/wallet-experience/types';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'intro', label: 'Intro' },
  { id: 'phrase', label: 'Phrase' },
  { id: 'verify', label: 'Verify' },
  { id: 'network', label: 'Network' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function ImportWalletExperience(): ReactElement {
  const [step, setStep] = useState<StepId>('intro');
  const [phraseText, setPhraseText] = useState('');
  const [networkId, setNetworkId] = useState<(typeof NETWORKS)[number]['id']>('ethereum');
  const [challenges, setChallenges] = useState<{ index: number; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const words = useMemo(() => normalizePhrase(phraseText), [phraseText]);
  const phraseOk = words.length === 12 || words.length === 24;

  function goVerify(): void {
    if (!phraseOk) {
      setError('Enter a 12- or 24-word recovery phrase.');
      return;
    }
    setError(null);
    const idxs = pickChallengeIndexes(words.length, 3);
    setChallenges(idxs.map((index) => ({ index, value: '' })));
    setStep('verify');
  }

  function checkVerify(): void {
    const ok = challenges.every((c) => words[c.index] === c.value.trim().toLowerCase());
    if (!ok) {
      setError('One or more words do not match. Try again.');
      return;
    }
    setError(null);
    setStep('network');
  }

  return (
    <WizardShell
      title="Import wallet"
      subtitle="Paste or type your recovery phrase. Words stay in this session only — never uploaded as plaintext by this UI."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'intro' ? (
        <section className="wx-panel">
          <Alert tone="warn" title="Treat this screen as sensitive">
            Make sure nobody can see your screen. Auvora support will never ask for your phrase.
          </Alert>
          <ul className="wx-bullets">
            <li>Use an offline backup if possible</li>
            <li>Prefer hardware import when available</li>
            <li>After import, enable PIN + auto-lock under Security</li>
          </ul>
          <WizardActions onNext={() => setStep('phrase')} nextLabel="I understand" />
        </section>
      ) : null}

      {step === 'phrase' ? (
        <section className="wx-panel">
          <label className="wx-field">
            <span>Recovery phrase</span>
            <Textarea
              value={phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              rows={4}
              placeholder="twelve or twenty four words…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="wx-meta">{words.length} words detected</p>
          {error ? (
            <Alert tone="error" title="Invalid phrase">
              {error}
            </Alert>
          ) : null}
          <WizardActions
            onBack={() => setStep('intro')}
            onNext={goVerify}
            nextDisabled={!phraseOk}
            nextLabel="Continue"
          />
        </section>
      ) : null}

      {step === 'verify' ? (
        <section className="wx-panel">
          <h2>Confirm selected words</h2>
          <p className="wx__sub">Prove you recorded the phrase correctly.</p>
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
          <WizardActions onBack={() => setStep('phrase')} onNext={checkVerify} nextLabel="Verify" />
        </section>
      ) : null}

      {step === 'network' ? (
        <section className="wx-panel">
          <h2>Primary network</h2>
          <div className="wx-choice-grid" role="radiogroup" aria-label="Network">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`wx-choice ${networkId === n.id ? 'wx-choice--on' : ''}`}
                aria-pressed={networkId === n.id}
                onClick={() => setNetworkId(n.id)}
              >
                <strong>{n.label}</strong>
                <span>{n.asset}</span>
              </button>
            ))}
          </div>
          <WizardActions
            onBack={() => setStep('verify')}
            onNext={() => {
              /* Clear phrase from memory before finishing */
              setPhraseText('');
              setStep('done');
            }}
            nextLabel="Finish import"
          />
        </section>
      ) : null}

      {step === 'done' ? (
        <SuccessState
          title="Import flow complete"
          description="In production, import submits to wallet-engine / custody — never logs the phrase. Enable Security next."
          action={
            <div className="wx__actions">
              <Link href="/wallets">
                <Button>View wallets</Button>
              </Link>
              <Link href="/security">
                <Button variant="secondary">Security settings</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </WizardShell>
  );
}
