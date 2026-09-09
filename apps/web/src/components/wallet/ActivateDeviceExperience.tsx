'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { getCachedUser, isSignedIn } from '../../lib/auth/session';
import { resolveActivationRoute, type ActivationRoute } from '../../lib/vault/activation-route';
import { decryptVaultBundle, rewrapVaultWithNewPassword } from '../../lib/vault/browser-envelope';
import {
  clearDeviceVault,
  getEncryptedVault,
  readDeviceVault,
  restoreVaultFromCloud,
} from '../../lib/vault/vault-sync';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import '../../app/onboarding.css';

const STEPS = [
  { id: 'check', label: 'Check' },
  { id: 'unlock', label: 'Unlock' },
  { id: 'done', label: 'Done' },
] as const;

/**
 * Normal path: discover cloud vault → unlock with account password only.
 * Recovery phrase is an explicit exceptional path only.
 */
export function ActivateDeviceExperience(): ReactElement {
  const router = useRouter();
  const [route, setRoute] = useState<ActivationRoute>('checking');
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);
  const [walletCount, setWalletCount] = useState(0);

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
        const remoteOk = Boolean(remote);
        const localOk = Boolean(local?.bundle.wallets.length);
        setHasRemote(remoteOk);
        setHasLocal(localOk);
        if (local?.bundle.wallets.length) setWalletCount(local.bundle.wallets.length);
        setRoute(
          resolveActivationRoute({
            hasRemoteVault: remoteOk,
            hasLocalSessionVault: localOk,
          }),
        );
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

  async function onUnlock(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const bundle = await restoreVaultFromCloud({ password });
      setWalletCount(bundle.wallets.length);
      setStatus('Your Auvora wallet is ready on this device.');
      setHasLocal(true);
      setRoute('ready');
      setPassword('');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRecover(e: FormEvent): Promise<void> {
    e.preventDefault();
    const words = phrase.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
    if (words.length !== 12 && words.length !== 24) {
      setError('Enter a 12- or 24-word recovery phrase.');
      return;
    }
    if (password.length < 12) {
      setError('Enter the account password that will protect this wallet on this device.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = getCachedUser();
      if (!user?.id) throw new Error('Sign in before recovering.');
      const client = createApiClient({ timeoutMs: 45_000 });
      const remote = await client.getEncryptedVault();
      if (!remote) {
        throw new Error('No encrypted vault is stored for this account yet.');
      }
      const recoveryPhrase = words.join(' ');
      const envelope = {
        algorithmId: remote.algorithmId as 'auvora-vault-v1',
        version: 1 as const,
        kdfSalt: remote.kdfSalt,
        kdfParams: {
          type: 'argon2id' as const,
          memoryCost: Number(
            (remote.kdfParams as { memoryCost?: number; memoryKiB?: number }).memoryCost ??
              (remote.kdfParams as { memoryKiB?: number }).memoryKiB ??
              0,
          ),
          timeCost: Number(
            (remote.kdfParams as { timeCost?: number; iterations?: number }).timeCost ??
              (remote.kdfParams as { iterations?: number }).iterations ??
              0,
          ),
          parallelism: Number((remote.kdfParams as { parallelism?: number }).parallelism ?? 1),
          hashLength: Number((remote.kdfParams as { hashLength?: number }).hashLength ?? 32),
        },
        recoveryKdfSalt: remote.recoveryKdfSalt,
        recoveryKdfParams: {
          type: 'argon2id' as const,
          memoryCost: Number(
            (remote.recoveryKdfParams as { memoryCost?: number; memoryKiB?: number }).memoryCost ??
              (remote.recoveryKdfParams as { memoryKiB?: number }).memoryKiB ??
              0,
          ),
          timeCost: Number(
            (remote.recoveryKdfParams as { timeCost?: number; iterations?: number }).timeCost ??
              (remote.recoveryKdfParams as { iterations?: number }).iterations ??
              0,
          ),
          parallelism: Number(
            (remote.recoveryKdfParams as { parallelism?: number }).parallelism ?? 1,
          ),
          hashLength: Number(
            (remote.recoveryKdfParams as { hashLength?: number }).hashLength ?? 32,
          ),
        },
        wrappedVaultKey: remote.wrappedVaultKey,
        wrappedVaultKeyRecovery: remote.wrappedVaultKeyRecovery,
        ciphertext: remote.ciphertext,
        aad: remote.aad,
      };
      // Prove phrase unlocks the existing cloud vault (never create a replacement wallet).
      await decryptVaultBundle({
        ownerUserId: user.id,
        envelope,
        epoch: remote.epoch,
        recoveryPhrase,
      });
      const payload = await rewrapVaultWithNewPassword({
        ownerUserId: user.id,
        envelope,
        epoch: remote.epoch,
        recoveryPhrase,
        newPassword: password,
      });
      const stored = await client.upsertEncryptedVault({
        algorithmId: payload.algorithmId,
        version: payload.version,
        epoch: payload.epoch,
        kdfSalt: payload.kdfSalt,
        kdfParams: payload.kdfParams,
        recoveryKdfSalt: payload.recoveryKdfSalt,
        recoveryKdfParams: payload.recoveryKdfParams,
        wrappedVaultKey: payload.wrappedVaultKey,
        wrappedVaultKeyRecovery: payload.wrappedVaultKeyRecovery,
        ciphertext: payload.ciphertext,
        aad: payload.aad,
      });
      const restored = await restoreVaultFromCloud({ password });
      setWalletCount(restored.wallets.length);
      setStatus(`Existing wallet restored and secured (revision ${stored.epoch}).`);
      setHasRemote(true);
      setHasLocal(true);
      setRoute('ready');
      setPassword('');
      setPhrase('');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const shellStep =
    route === 'ready' ? 'done' : route === 'unlock' || route === 'recover' ? 'unlock' : 'check';

  return (
    <OnboardingShell
      title={
        route === 'unlock'
          ? 'Unlock your Auvora wallet'
          : route === 'ready'
            ? 'Auvora Wallet'
            : route === 'recover'
              ? 'Recover wallet'
              : 'Activate this device'
      }
      subtitle={
        route === 'unlock'
          ? 'For your security, confirm your Auvora password.'
          : route === 'ready'
            ? 'Your wallet is ready on this device.'
            : route === 'missing'
              ? 'We could not find a secure backup for this account yet.'
              : route === 'recover'
                ? 'Use your recovery phrase only if you cannot unlock from another device.'
                : 'Checking for your encrypted wallet backup…'
      }
      reassure="Auvora never asks for your recovery phrase during normal sign-in."
      steps={[...STEPS]}
      currentStepId={shellStep}
    >
      {route === 'checking' ? (
        <section className="ob-panel">
          <h2>Checking your wallet…</h2>
          <p>{busy ? 'Contacting Auvora…' : (error ?? 'Preparing this device.')}</p>
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
        </section>
      ) : null}

      {route === 'unlock' ? (
        <section className="ob-panel" aria-labelledby="ob-unlock">
          <h2 id="ob-unlock">Unlock your Auvora wallet</h2>
          <p>Your wallet backup is ready. Confirm your Auvora password to use it here.</p>
          <form onSubmit={(e) => void onUnlock(e)}>
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
                type="submit"
                className="ob-btn ob-btn--primary"
                disabled={busy || password.length < 12}
              >
                {busy ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          </form>
          <p className="ob__reassure" style={{ marginTop: '1.25rem' }}>
            Trouble accessing your wallet?{' '}
            <button
              type="button"
              className="ob-back"
              onClick={() => {
                setError(null);
                setRoute('recover');
              }}
            >
              Recover wallet
            </button>
          </p>
        </section>
      ) : null}

      {route === 'missing' ? (
        <section className="ob-panel" aria-labelledby="ob-missing">
          <h2 id="ob-missing">Secure backup not found yet</h2>
          <p>
            Sign in on the device where you created your wallet (for example Auvora QA on Android)
            so it can finish secure backup. Then unlock here with your Auvora password — no recovery
            phrase required.
          </p>
          {error ? <div className="ob-alert ob-alert--error">{error}</div> : null}
          <div className="ob-actions">
            <button
              type="button"
              className="ob-btn ob-btn--primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                void (async () => {
                  try {
                    const remote = await getEncryptedVault();
                    const local = readDeviceVault();
                    const remoteOk = Boolean(remote);
                    const localOk = Boolean(local?.bundle.wallets.length);
                    setHasRemote(remoteOk);
                    setHasLocal(localOk);
                    setRoute(
                      resolveActivationRoute({
                        hasRemoteVault: remoteOk,
                        hasLocalSessionVault: localOk,
                      }),
                    );
                  } catch (err) {
                    setError(formatApiError(err));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {busy ? 'Checking…' : 'Check again'}
            </button>
          </div>
          <p className="ob__reassure" style={{ marginTop: '1.25rem' }}>
            Trouble accessing your wallet?{' '}
            <button
              type="button"
              className="ob-back"
              onClick={() => {
                setError(null);
                setRoute('recover');
              }}
            >
              Recover wallet
            </button>
          </p>
        </section>
      ) : null}

      {route === 'recover' ? (
        <section className="ob-panel" aria-labelledby="ob-recover">
          <h2 id="ob-recover">Recover wallet</h2>
          <p>
            Only use this if you cannot unlock from a device that already has your wallet. Anyone
            with this phrase can move your funds.
          </p>
          <form onSubmit={(e) => void onRecover(e)}>
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
                  setRoute(
                    resolveActivationRoute({
                      hasRemoteVault: hasRemote,
                      hasLocalSessionVault: hasLocal,
                    }),
                  )
                }
              >
                Back
              </button>
              <button
                type="submit"
                className="ob-btn ob-btn--primary"
                disabled={busy || password.length < 12 || phrase.trim().length < 20}
              >
                {busy ? 'Recovering…' : 'Recover'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {route === 'ready' ? (
        <div className="ob-success">
          <div className="ob-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Your wallet is ready on this device.</h2>
          <p>
            {status ??
              (walletCount > 0
                ? `${walletCount} wallet${walletCount === 1 ? '' : 's'} available.`
                : 'Continue to your dashboard.')}
          </p>
          <div className="ob-success__cta">
            <Link href="/dashboard" className="ob-btn ob-btn--primary ob-btn--lg">
              Continue
            </Link>
            {hasLocal ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost ob-btn--lg"
                onClick={() => {
                  clearDeviceVault();
                  setHasLocal(false);
                  setRoute(
                    resolveActivationRoute({
                      hasRemoteVault: hasRemote,
                      hasLocalSessionVault: false,
                    }),
                  );
                }}
              >
                Lock wallet on this browser
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
