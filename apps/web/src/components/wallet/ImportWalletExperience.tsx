'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';
import { normalizePhrase, pickChallengeIndexes } from '../../lib/wallet-experience/recovery-demo';
import { setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { NETWORKS } from '../../lib/wallet-experience/types';
import { setOnboardingAuth, setUserPrefs } from '../../lib/wallet-experience/user-prefs';
import { ObActions, OnboardingShell } from '../onboarding/OnboardingShell';
import '../../app/onboarding.css';

const STEPS = [
  { id: 'method', label: 'Method' },
  { id: 'auth', label: 'Sign in' },
  { id: 'input', label: 'Import' },
  { id: 'verify', label: 'Verify' },
  { id: 'network', label: 'Network' },
  { id: 'security', label: 'Security' },
  { id: 'success', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
type ImportMethod = 'phrase' | 'privateKey' | 'hardware' | 'walletconnect';

export function ImportWalletExperience(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('method');
  const [method, setMethod] = useState<ImportMethod>('phrase');
  const [phraseText, setPhraseText] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [networkId, setNetworkId] = useState<(typeof NETWORKS)[number]['id']>('ethereum');
  const [challenges, setChallenges] = useState<{ index: number; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(true);
  const [autoLock, setAutoLock] = useState(true);
  const [email, setEmail] = useState('');

  const words = useMemo(() => normalizePhrase(phraseText), [phraseText]);
  const phraseOk = words.length === 12 || words.length === 24;
  const keyOk = /^0x?[a-fA-F0-9]{64}$/.test(privateKey.trim()) || privateKey.trim().length >= 32;

  function goInput(): void {
    setOnboardingAuth({
      method: email ? 'email' : 'skip',
      email: email || undefined,
      completedAt: new Date().toISOString(),
    });
    setStep('input');
  }

  function goVerify(): void {
    setError(null);
    if (method === 'phrase') {
      if (!phraseOk) {
        setError('Enter a 12- or 24-word recovery phrase.');
        return;
      }
      const idxs = pickChallengeIndexes(words.length, 3);
      setChallenges(idxs.map((index) => ({ index, value: '' })));
      setStep('verify');
      return;
    }
    if (method === 'privateKey') {
      if (!keyOk) {
        setError('That private key does not look valid. Check the format and try again.');
        return;
      }
      setStep('network');
      return;
    }
    /* hardware / walletconnect — simulated continue */
    setStep('network');
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

  function finishSecurity(): void {
    setSecurityPrefs({
      biometricEnabled: bio,
      autoLockMinutes: autoLock ? 5 : 0,
      backupReminderEnabled: true,
      lastBackupReminderAt: new Date().toISOString(),
    });
    setUserPrefs({ defaultNetwork: networkId });
    setStep('success');
  }

  return (
    <OnboardingShell
      title="Import wallet"
      subtitle="Bring an existing wallet into Auvora — carefully, and at your pace."
      reassure="Your phrase and keys stay in this session only. We never ask for them in chat."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'method' ? (
        <section className="ob-panel">
          <h2>How do you want to import?</h2>
          <p>Choose one path. More methods can be added later without changing this screen.</p>
          <div className="ob-choice-grid" role="radiogroup" aria-label="Import method">
            {(
              [
                ['phrase', 'Recovery phrase', '12 or 24 words'],
                ['privateKey', 'Private key', 'Advanced'],
                ['hardware', 'Hardware wallet', 'Ledger / Trezor'],
                ['walletconnect', 'WalletConnect', 'Link a wallet'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={`ob-choice ${method === id ? 'ob-choice--on' : ''}`}
                aria-pressed={method === id}
                onClick={() => setMethod(id)}
              >
                <strong>{label}</strong>
                <span>{hint}</span>
              </button>
            ))}
          </div>
          <div className="ob-warn">
            <strong>Sensitive step ahead</strong>
            <p>
              Make sure nobody can see your screen. Auvora support will never ask for your phrase or
              key.
            </p>
          </div>
          <ObActions
            onBack={() => router.push('/wallets/onboarding')}
            onNext={() => setStep('auth')}
            nextLabel="Continue"
          />
        </section>
      ) : null}

      {step === 'auth' ? (
        <section className="ob-panel">
          <h2>Optional account link</h2>
          <p>Linking helps with recovery preferences — it is not required to import.</p>
          <label className="ob-field">
            <span>Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <ObActions
            onBack={() => setStep('method')}
            onNext={goInput}
            nextLabel="Continue"
            secondary={
              <button type="button" onClick={goInput}>
                Skip
              </button>
            }
          />
        </section>
      ) : null}

      {step === 'input' ? (
        <section className="ob-panel">
          {method === 'phrase' ? (
            <>
              <h2>Enter recovery phrase</h2>
              <p>Type or paste 12 or 24 words. Spaces are fine.</p>
              <label className="ob-field">
                <span>Recovery phrase</span>
                <textarea
                  value={phraseText}
                  onChange={(e) => setPhraseText(e.target.value)}
                  rows={4}
                  placeholder="twelve or twenty four words…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p className="ob-meta">{words.length} words detected</p>
            </>
          ) : null}
          {method === 'privateKey' ? (
            <>
              <h2>Enter private key</h2>
              <p>Advanced. Prefer a hardware wallet when you can.</p>
              <label className="ob-field">
                <span>Private key</span>
                <input
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </>
          ) : null}
          {method === 'hardware' ? (
            <>
              <h2>Connect hardware</h2>
              <p>We will open a secure pairing flow. Have your device unlocked and nearby.</p>
              <div className="ob-alert ob-alert--info">
                Simulated pairing for this UI — Connections integration preserved for production
                wiring.
              </div>
            </>
          ) : null}
          {method === 'walletconnect' ? (
            <>
              <h2>WalletConnect</h2>
              <p>Scan or approve the session from your other wallet when prompted.</p>
              <div className="ob-alert ob-alert--info">
                Session UX is ready for WalletConnect wiring — presentation only in this pass.
              </div>
            </>
          ) : null}
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
          <ObActions onBack={() => setStep('auth')} onNext={goVerify} nextLabel="Continue" />
        </section>
      ) : null}

      {step === 'verify' ? (
        <section className="ob-panel">
          <h2>Confirm selected words</h2>
          <p>Prove the phrase was entered correctly.</p>
          <div className="ob-challenge-grid">
            {challenges.map((c) => (
              <label key={c.index} className="ob-field">
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
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
          <ObActions onBack={() => setStep('input')} onNext={checkVerify} nextLabel="Verify" />
        </section>
      ) : null}

      {step === 'network' ? (
        <section className="ob-panel">
          <h2>Primary network</h2>
          <p>Choose the network you use most. You can add more later.</p>
          <div className="ob-choice-grid" role="radiogroup" aria-label="Network">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`ob-choice ${networkId === n.id ? 'ob-choice--on' : ''}`}
                aria-pressed={networkId === n.id}
                onClick={() => setNetworkId(n.id)}
              >
                <strong>{n.label}</strong>
                <span>{n.asset}</span>
              </button>
            ))}
          </div>
          <ObActions
            onBack={() => setStep(method === 'phrase' ? 'verify' : 'input')}
            onNext={() => setStep('security')}
          />
        </section>
      ) : null}

      {step === 'security' ? (
        <section className="ob-panel">
          <h2>Lock it down</h2>
          <p>Optional protections — recommended before you move funds.</p>
          <div className="ob-toggle-row">
            <div>
              <strong>Biometrics</strong>
              <span>Face ID / Touch ID</span>
            </div>
            <input
              type="checkbox"
              checked={bio}
              onChange={(e) => setBio(e.target.checked)}
              aria-label="Biometrics"
            />
          </div>
          <div className="ob-toggle-row">
            <div>
              <strong>Auto-lock</strong>
              <span>After 5 minutes</span>
            </div>
            <input
              type="checkbox"
              checked={autoLock}
              onChange={(e) => setAutoLock(e.target.checked)}
              aria-label="Auto-lock"
            />
          </div>
          <ObActions
            onBack={() => setStep('network')}
            onNext={finishSecurity}
            nextLabel="Finish import"
            secondary={
              <button type="button" onClick={finishSecurity}>
                Skip for now
              </button>
            }
          />
        </section>
      ) : null}

      {step === 'success' ? (
        <div className="ob-success">
          <div className="ob-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Import complete.</h2>
          <p>Your wallet is ready to use in Auvora. Review security anytime from Settings.</p>
          <div className="ob-success__cta">
            <Link href="/dashboard" className="ob-btn ob-btn--primary ob-btn--lg">
              Enter wallet
            </Link>
            <Link href="/security" className="ob-btn ob-btn--ghost ob-btn--lg">
              Open Security
            </Link>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
