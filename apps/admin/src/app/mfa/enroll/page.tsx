'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../../components/AdminChrome';
import { TotpQrCode } from '../../../components/TotpQrCode';
import { adminEnrollConfirm, adminEnrollStart } from '../../../lib/admin-session';
import {
  ADMIN_TOTP_ISSUER,
  buildAdminOtpauthUrl,
  formatMfaAuthError,
  normalizeTotpInput,
  recoveryCodesText,
} from '../../../lib/mfa-enrollment';

export default function MfaEnrollPage(): ReactElement {
  const router = useRouter();
  const started = useRef(false);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const mfaToken = sessionStorage.getItem('auvora_admin_mfa_token');
    if (!mfaToken) {
      router.replace('/login');
      return;
    }
    void adminEnrollStart(mfaToken)
      .then((data) => {
        setSecret(data.secret);
        setOtpauthUrl(buildAdminOtpauthUrl(data.secret));
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          router.replace('/login');
          return;
        }
        setError(formatMfaAuthError(err));
      });
  }, [router]);

  async function copyText(label: 'secret' | 'codes', value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  }

  function downloadCodes(codes: string[]): void {
    const blob = new Blob([recoveryCodesText(codes)], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'auvora-admin-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(href);
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const mfaToken = sessionStorage.getItem('auvora_admin_mfa_token');
    if (!mfaToken) {
      router.replace('/login');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await adminEnrollConfirm(mfaToken, code);
      sessionStorage.removeItem('auvora_admin_mfa_token');
      setSecret('');
      setOtpauthUrl('');
      setRecovery(data.recoveryCodes);
    } catch (err) {
      setError(formatMfaAuthError(err));
    } finally {
      setPending(false);
    }
  }

  if (recovery) {
    return (
      <AuthScreen
        title="Save recovery codes"
        description="Save these recovery codes somewhere secure. Each code can only be used once."
        homeLink={false}
      >
        <ol className="admin-recovery-codes">
          {recovery.map((item) => (
            <li key={item}>
              <code>{item}</code>
            </li>
          ))}
        </ol>
        <div className="admin-mfa-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void copyText('codes', recovery.join('\n'))}
          >
            {copied === 'codes' ? 'Copied' : 'Copy codes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => downloadCodes(recovery)}>
            Download codes
          </Button>
        </div>
        <label className="admin-mfa-ack">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          <span>I have saved my recovery codes.</span>
        </label>
        <Button
          type="button"
          disabled={!saved}
          onClick={() => router.replace('/dashboard?mfa=enabled')}
        >
          Continue to dashboard
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Set up Google Authenticator"
      description="Add Auvora Wallet to Google Authenticator on your phone, then enter the 6-digit code currently shown in the app."
      homeLink={false}
    >
      {error ? (
        <Alert tone="error" title="Enrollment could not continue">
          {error}
        </Alert>
      ) : null}
      <ol className="admin-mfa-steps">
        <li>Open Google Authenticator on your phone.</li>
        <li>Tap the + button.</li>
        <li>Choose “Scan a QR code”.</li>
        <li>Scan the code below.</li>
        <li>Enter the 6-digit code shown in the app.</li>
      </ol>
      {otpauthUrl ? (
        <TotpQrCode otpauthUrl={otpauthUrl} />
      ) : (
        <div className="admin-mfa-qr admin-mfa-qr--loading" />
      )}
      <details className="admin-mfa-manual">
        <summary>Can’t scan the QR code?</summary>
        <dl className="admin-mfa-manual__meta">
          <div>
            <dt>Account</dt>
            <dd>{ADMIN_TOTP_ISSUER}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>Time based</dd>
          </div>
        </dl>
        {secret ? (
          <div className="admin-mfa-manual-key">
            <p>
              Manual secret: <code>{secret}</code>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void copyText('secret', secret)}
            >
              {copied === 'secret' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        ) : null}
      </details>
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="6-digit authentication code" htmlFor="admin-totp-enroll">
          <Input
            id="admin-totp-enroll"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(normalizeTotpInput(e.target.value))}
            required
          />
        </Field>
        <Button type="submit" disabled={pending || code.length !== 6}>
          {pending ? 'Verifying…' : 'Verify & Continue'}
        </Button>
      </form>
    </AuthScreen>
  );
}
