'use client';

import { AuvoraClientError } from '@auvora/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import {
  generateDemoPhrase,
  pickChallengeIndexes,
} from '../../lib/wallet-experience/recovery-demo';
import { hashPin, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { NETWORKS } from '../../lib/wallet-experience/types';
import {
  setOnboardingAuth,
  setUserPrefs,
  type CurrencyPref,
  type ThemePref,
} from '../../lib/wallet-experience/user-prefs';
import { ObActions, OnboardingShell } from '../onboarding/OnboardingShell';
import '../../app/onboarding.css';

const STEPS = [
  { id: 'auth', label: 'Account' },
  { id: 'setup', label: 'Setup' },
  { id: 'creating', label: 'Create' },
  { id: 'backup', label: 'Backup' },
  { id: 'phrase', label: 'Phrase' },
  { id: 'verify', label: 'Verify' },
  { id: 'security', label: 'Security' },
  { id: 'prefs', label: 'Prefs' },
  { id: 'success', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function CreateWalletExperience(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('auth');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [networkId, setNetworkId] = useState<(typeof NETWORKS)[number]['id']>('ethereum');
  const [alias, setAlias] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [acks, setAcks] = useState({ written: false, private: false, neverShare: false });
  const [challenges, setChallenges] = useState<{ index: number; value: string }[]>([]);
  const [bio, setBio] = useState(true);
  const [autoLock, setAutoLock] = useState(true);
  const [currency, setCurrency] = useState<CurrencyPref>('USD');
  const [theme, setTheme] = useState<ThemePref>('system');
  const [notifications, setNotifications] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);

  const network = useMemo(() => NETWORKS.find((n) => n.id === networkId)!, [networkId]);
  const nameOk = name.trim().length >= 2;

  useEffect(() => {
    if (step !== 'phrase') setRevealed(false);
  }, [step]);

  const securityScore = useMemo(() => {
    let s = 35;
    if (acks.written && acks.private && acks.neverShare) s += 25;
    if (bio) s += 15;
    if (autoLock) s += 15;
    if (pin.length >= 4) s += 10;
    return Math.min(100, s);
  }, [acks, autoLock, bio, pin.length]);

  async function createWallet(): Promise<void> {
    setStep('creating');
    setSubmitting(true);
    setError(null);
    try {
      const client = createApiClient();
      const wallet = await client.createWallet({
        assetCode: network.asset,
        alias: alias.trim() || undefined,
        label: name.trim(),
      });
      setCreatedId(wallet.id);
      setSecurityPrefs({
        backupReminderEnabled: true,
        lastBackupReminderAt: new Date().toISOString(),
      });
      const words = generateDemoPhrase(12);
      setPhrase(words);
      setStep('backup');
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError(
          'Sign in to your Auvora account to create this wallet on the server. You can also continue on this device. Keys stay here.',
        );
        setStep('setup');
      } else {
        setError(formatApiError(err));
        setCreatedId(`preview-${crypto.randomUUID().slice(0, 8)}`);
        const words = generateDemoPhrase(12);
        setPhrase(words);
        setStep('backup');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function beginPhrase(): void {
    setRevealed(false);
    setStep('phrase');
  }

  function beginVerify(): void {
    if (!(acks.written && acks.private && acks.neverShare)) return;
    const idxs = pickChallengeIndexes(phrase.length, 3);
    setChallenges(idxs.map((index) => ({ index, value: '' })));
    setStep('verify');
  }

  function checkVerify(): void {
    const ok = challenges.every((c) => phrase[c.index] === c.value.trim().toLowerCase());
    if (!ok) {
      setError('Those words do not match. Check your written backup and try again.');
      return;
    }
    setError(null);
    setStep('security');
  }

  async function finishSecurity(): Promise<void> {
    const patch: Parameters<typeof setSecurityPrefs>[0] = {
      biometricEnabled: bio,
      autoLockMinutes: autoLock ? 5 : 0,
      backupReminderEnabled: true,
      lastBackupReminderAt: new Date().toISOString(),
    };
    if (pin.length >= 4) {
      patch.pinEnabled = true;
      patch.pinHash = await hashPin(pin);
    }
    setSecurityPrefs(patch);
    setStep('prefs');
  }

  function finishPrefs(): void {
    setUserPrefs({
      currency,
      theme,
      defaultNetwork: networkId,
      notificationsEnabled: notifications,
      privacyMode,
      portfolioCompact: false,
    });
    setStep('success');
  }

  function completeAuth(): void {
    setOnboardingAuth({
      method: 'skip',
      completedAt: new Date().toISOString(),
    });
    setStep('setup');
  }

  return (
    <OnboardingShell
      title="Create wallet"
      subtitle="Generate a non-custodial wallet on this device, then back it up."
      reassure="Auvora does not receive your private keys or recovery phrase through account login."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'auth' ? (
        <section className="ob-panel" aria-labelledby="ob-auth">
          <h2 id="ob-auth">Auvora Account is optional</h2>
          <p>
            An account stores identity and preferences. A wallet stores keys on this device. Login
            never sends a recovery phrase to Auvora.
          </p>
          <div className="ob-paths">
            <Link href="/auth/login" className="ob-path">
              <strong>Sign in</strong>
              <span>Use an existing Auvora Account, then return here to create the wallet.</span>
            </Link>
            <Link href="/auth/register" className="ob-path">
              <strong>Create account</strong>
              <span>Email and password only. No seed phrase is collected.</span>
            </Link>
          </div>
          <ObActions
            onBack={() => router.push('/wallets/onboarding')}
            onNext={completeAuth}
            nextLabel="Continue without account"
          />
        </section>
      ) : null}

      {step === 'setup' ? (
        <section className="ob-panel" aria-labelledby="ob-setup">
          <h2 id="ob-setup">Name your wallet</h2>
          <p>Something you will recognize — like “Personal” or “Daily spend”.</p>
          <label className="ob-field">
            <span>Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Personal"
              autoComplete="off"
              maxLength={48}
            />
          </label>
          <label className="ob-field">
            <span>Alias (optional)</span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="personal-eth"
              autoComplete="off"
            />
          </label>
          <h2 style={{ marginTop: '1.25rem' }}>Primary network</h2>
          <p>You can add more networks anytime.</p>
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
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
          <div className="ob-alert ob-alert--info">
            Your keys stay protected. We never ask you to paste a seed into chat or email.
          </div>
          <ObActions
            onBack={() => setStep('auth')}
            onNext={() => void createWallet()}
            nextDisabled={!nameOk || submitting}
            nextLoading={submitting}
            nextLabel="Create wallet"
          />
        </section>
      ) : null}

      {step === 'creating' ? (
        <div className="ob-creating" role="status" aria-live="polite">
          <div className="ob-creating__ring" aria-hidden />
          <h2>Creating your wallet</h2>
          <p>
            Securing {name.trim() || 'your account'} on {network.label}. This only takes a moment.
          </p>
        </div>
      ) : null}

      {step === 'backup' ? (
        <section className="ob-panel" aria-labelledby="ob-backup">
          <h2 id="ob-backup">Your recovery phrase matters most</h2>
          <p>
            This is the only way to restore access if you lose this device. We will show it once —
            write it down offline.
          </p>
          <div className="ob-warn">
            <strong>Protect it like cash</strong>
            <ul>
              <li>Never share it — support will never ask</li>
              <li>Do not screenshot or store in cloud notes</li>
              <li>Write it on paper and keep it somewhere safe</li>
            </ul>
          </div>
          {error && createdId?.startsWith('preview-') ? (
            <div className="ob-alert ob-alert--info">
              Preview mode: {error}. You can still rehearse backup and finish onboarding.
            </div>
          ) : null}
          <ObActions
            onBack={() => setStep('setup')}
            onNext={beginPhrase}
            nextLabel="Show my phrase"
          />
        </section>
      ) : null}

      {step === 'phrase' ? (
        <section className="ob-panel" aria-labelledby="ob-phrase">
          <h2 id="ob-phrase">Write these words down</h2>
          <p>Tap reveal when you are ready and no one can see your screen.</p>
          {!revealed ? (
            <button
              type="button"
              className="ob-btn ob-btn--primary"
              onClick={() => setRevealed(true)}
            >
              Reveal recovery phrase
            </button>
          ) : (
            <ol className={`ob-phrase as-sensitive${revealed ? ' is-revealed' : ''}`}>
              {phrase.map((w, i) => (
                <li key={`${w}-${i}`}>
                  <span>{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
          )}
          <ul className="ob-checklist">
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={acks.written}
                  onChange={(e) => setAcks((a) => ({ ...a, written: e.target.checked }))}
                />
                I wrote the phrase offline
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={acks.private}
                  onChange={(e) => setAcks((a) => ({ ...a, private: e.target.checked }))}
                />
                I will keep it private and offline
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={acks.neverShare}
                  onChange={(e) => setAcks((a) => ({ ...a, neverShare: e.target.checked }))}
                />
                I will never share these words with anyone
              </label>
            </li>
          </ul>
          <ObActions
            onBack={() => setStep('backup')}
            onNext={beginVerify}
            nextDisabled={!(revealed && acks.written && acks.private && acks.neverShare)}
            nextLabel="Continue to verification"
          />
        </section>
      ) : null}

      {step === 'verify' ? (
        <section className="ob-panel" aria-labelledby="ob-verify">
          <h2 id="ob-verify">Confirm a few words</h2>
          <p>This proves your written backup is correct before we continue.</p>
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
          <ObActions onBack={() => setStep('phrase')} onNext={checkVerify} nextLabel="Verify" />
        </section>
      ) : null}

      {step === 'security' ? (
        <section className="ob-panel" aria-labelledby="ob-sec">
          <h2 id="ob-sec">Strengthen your protection</h2>
          <p>
            Optional — but every step raises your security score. Encouraging, not intimidating.
          </p>
          <div className="ob-score" style={{ ['--ob-score' as string]: `${securityScore}%` }}>
            <div className="ob-score__ring" aria-label={`Security score ${securityScore}`}>
              <span>{securityScore}</span>
            </div>
            <div>
              <strong>Security score</strong>
              <p>
                {securityScore >= 80
                  ? 'Excellent start. You are set up for calm daily use.'
                  : 'A few toggles go a long way — add what feels right.'}
              </p>
            </div>
          </div>
          <div className="ob-toggle-row">
            <div>
              <strong>Biometrics</strong>
              <span>Face ID / Touch ID when available</span>
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
              <span>Lock after 5 minutes idle</span>
            </div>
            <input
              type="checkbox"
              checked={autoLock}
              onChange={(e) => setAutoLock(e.target.checked)}
              aria-label="Auto-lock"
            />
          </div>
          <label className="ob-field" style={{ marginTop: '1rem' }}>
            <span>Optional device PIN</span>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4+ digits"
              autoComplete="new-password"
            />
          </label>
          <ObActions
            onBack={() => setStep('verify')}
            onNext={() => void finishSecurity()}
            nextLabel="Continue"
            secondary={
              <button type="button" onClick={() => void finishSecurity()}>
                Skip for now
              </button>
            }
          />
        </section>
      ) : null}

      {step === 'prefs' ? (
        <section className="ob-panel" aria-labelledby="ob-prefs">
          <h2 id="ob-prefs">Make it yours</h2>
          <p>Everything here is optional. Defaults work great.</p>
          <label className="ob-field">
            <span>Preferred currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyPref)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
            </select>
          </label>
          <label className="ob-field">
            <span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemePref)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <div className="ob-toggle-row">
            <div>
              <strong>Notifications</strong>
              <span>Important activity only</span>
            </div>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              aria-label="Notifications"
            />
          </div>
          <div className="ob-toggle-row">
            <div>
              <strong>Privacy mode</strong>
              <span>Hide balances until unlock</span>
            </div>
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(e) => setPrivacyMode(e.target.checked)}
              aria-label="Privacy mode"
            />
          </div>
          <ObActions
            onBack={() => setStep('security')}
            onNext={finishPrefs}
            nextLabel="Finish"
            secondary={
              <button type="button" onClick={finishPrefs}>
                Use defaults
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
          <h2>Welcome to Auvora, {name.trim() || 'friend'}.</h2>
          <p>
            Your wallet is ready. Take a breath — you did the hard part. Next, explore calmly or
            receive your first funds.
          </p>
          <div className="ob-success__next">
            <h3>Suggested next steps</h3>
            <ul>
              <li>Receive a small test amount</li>
              <li>Review Security anytime</li>
              <li>Take a short product tour</li>
            </ul>
          </div>
          <div className="ob-success__cta">
            <Link
              href={
                createdId && !createdId.startsWith('preview-')
                  ? `/wallets/${createdId}`
                  : '/dashboard'
              }
              className="ob-btn ob-btn--primary ob-btn--lg"
            >
              Enter wallet
            </Link>
            <Link href="/dashboard" className="ob-btn ob-btn--ghost ob-btn--lg">
              Take product tour
            </Link>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
