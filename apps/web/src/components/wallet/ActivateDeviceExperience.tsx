'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { getCachedUser, isSignedIn } from '../../lib/auth/session';
import {
  clearDeviceVault,
  getEncryptedVault,
  readDeviceVault,
  restoreVaultFromCloud,
  uploadVaultBundle,
} from '../../lib/vault/vault-sync';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import '../../app/onboarding.css';

const STEPS = [
  { id: 'check', label: 'Check' },
  { id: 'restore', label: 'Restore' },
  { id: 'upload', label: 'Upload' },
  { id: 'done', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/**
 * Device activation: restore encrypted vault from cloud after sign-in, or upload
 * a local phrase. Server stores ciphertext only (auvora-vault-v1).
 */
export function ActivateDeviceExperience(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('check');
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace('/auth/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const remote = await getEncryptedVault();
        const local = readDeviceVault();
        if (cancelled) return;
        setHasRemote(Boolean(remote));
        setHasLocal(Boolean(local?.bundle.wallets.length));
        if (remote && !local) setStep('restore');
        else if (!remote) setStep('upload');
        else setStep('done');
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onRestore(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const bundle = await restoreVaultFromCloud({ password });
      setStatus(`Restored ${bundle.wallets.length} wallet(s) to this device session.`);
      setHasLocal(true);
      setStep('done');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e: FormEvent): Promise<void> {
    e.preventDefault();
    const words = phrase.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
    if (words.length !== 12 && words.length !== 24) {
      setError('Enter a 12- or 24-word recovery phrase to encrypt and upload.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = getCachedUser();
      const stored = await uploadVaultBundle({
        password,
        recoveryPhrase: words.join(' '),
        bundle: {
          version: 1,
          wallets: [
            {
              walletId: `web-${crypto.randomUUID()}`,
              mnemonic: words.join(' '),
              label: 'Web wallet',
              metadata: { source: 'activate-device' },
            },
          ],
        },
      });
      setStatus(
        `Encrypted vault uploaded for ${user?.email ?? 'account'} (epoch ${stored.epoch}).`,
      );
      setHasRemote(true);
      setHasLocal(true);
      setStep('done');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      title="Activate this device"
      subtitle="Restore your encrypted vault from the cloud, or upload a recovery phrase encrypted with your account password."
      reassure="Auvora stores ciphertext only. Password reset cannot decrypt a vault — re-wrap with your recovery phrase after changing your password."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'check' ? (
        <section className="ob-panel">
          <h2>Checking encrypted vault…</h2>
          <p>{busy ? 'Contacting Auvora…' : (error ?? 'Preparing device activation.')}</p>
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
        </section>
      ) : null}

      {step === 'restore' ? (
        <section className="ob-panel" aria-labelledby="ob-restore">
          <h2 id="ob-restore">Restore cloud vault</h2>
          <p>
            A vault blob exists for your account. Enter your account password to decrypt it on this
            device. Secrets never leave the browser unencrypted.
          </p>
          <form onSubmit={(e) => void onRestore(e)}>
            <label className="ob-field">
              <span>Account password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={12}
              />
            </label>
            {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                onClick={() => router.push('/wallets/onboarding')}
              >
                Back
              </button>
              <button
                type="submit"
                className="ob-btn ob-btn--primary"
                disabled={busy || password.length < 12}
              >
                {busy ? 'Decrypting…' : 'Restore vault'}
              </button>
            </div>
          </form>
          <p className="ob__reassure" style={{ marginTop: '1rem' }}>
            Prefer a fresh phrase instead?{' '}
            <button type="button" className="ob-back" onClick={() => setStep('upload')}>
              Upload a new encrypted vault
            </button>
          </p>
        </section>
      ) : null}

      {step === 'upload' ? (
        <section className="ob-panel" aria-labelledby="ob-upload">
          <h2 id="ob-upload">{hasRemote ? 'Replace encrypted vault' : 'Create encrypted vault'}</h2>
          <p>
            Encrypt a recovery phrase with your account password and upload ciphertext only. Use the
            same password on mobile to restore.
          </p>
          <form onSubmit={(e) => void onUpload(e)}>
            <label className="ob-field">
              <span>Account password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={12}
              />
            </label>
            <label className="ob-field">
              <span>Recovery phrase</span>
              <textarea
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                rows={3}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                onClick={() =>
                  hasRemote ? setStep('restore') : router.push('/wallets/onboarding')
                }
              >
                Back
              </button>
              <button
                type="submit"
                className="ob-btn ob-btn--primary"
                disabled={busy || password.length < 12 || phrase.trim().length < 20}
              >
                {busy ? 'Encrypting…' : 'Encrypt & upload'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'done' ? (
        <div className="ob-success">
          <div className="ob-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Device ready</h2>
          <p>
            {status ??
              (hasLocal
                ? 'This browser session has your vault material.'
                : 'You can create or import a wallet next.')}
          </p>
          <div className="ob-success__cta">
            <Link href="/dashboard" className="ob-btn ob-btn--primary ob-btn--lg">
              Continue to dashboard
            </Link>
            <Link href="/wallets/create" className="ob-btn ob-btn--ghost ob-btn--lg">
              Create another wallet
            </Link>
            {hasLocal ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost ob-btn--lg"
                onClick={() => {
                  clearDeviceVault();
                  setHasLocal(false);
                  setStep(hasRemote ? 'restore' : 'upload');
                }}
              >
                Clear session vault
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
