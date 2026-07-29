'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { Alert, Button, Checkbox, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { NETWORKS } from '../../lib/wallet-experience/types';
import { setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { WizardActions, WizardShell } from './WizardShell';
import '../../app/wallet-experience.css';

const STEPS = [
  { id: 'name', label: 'Name' },
  { id: 'network', label: 'Network' },
  { id: 'account', label: 'Account' },
  { id: 'backup', label: 'Backup' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'success', label: 'Done' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function CreateWalletExperience(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('name');
  const [name, setName] = useState('');
  const [networkId, setNetworkId] = useState<(typeof NETWORKS)[number]['id']>('ethereum');
  const [alias, setAlias] = useState('');
  const [backupAck, setBackupAck] = useState(false);
  const [offlineAck, setOfflineAck] = useState(false);
  const [shareAck, setShareAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const network = useMemo(() => NETWORKS.find((n) => n.id === networkId)!, [networkId]);
  const nameOk = name.trim().length >= 2;

  async function create(): Promise<void> {
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
      setStep('success');
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above, then retry.');
      } else {
        setError(formatApiError(err));
      }
      /* Preview fallback so the flow remains completable offline */
      if (!(err instanceof AuvoraClientError && err.status === 401)) {
        setCreatedId(`preview-${crypto.randomUUID().slice(0, 8)}`);
        setStep('success');
        setError(
          `${formatApiError(err)} — showing preview success so you can continue the experience.`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      title="Create wallet"
      subtitle="Name your wallet, pick a network, and confirm backup habits before we finish."
      steps={[...STEPS]}
      currentStepId={step}
    >
      {step === 'name' ? (
        <section className="wx-panel" aria-labelledby="wx-name">
          <h2 id="wx-name">Wallet name</h2>
          <p className="wx__sub">Use something you will recognize later — e.g. “Daily spend”.</p>
          <label className="wx-field">
            <span>Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily spend"
              autoComplete="off"
              maxLength={48}
            />
          </label>
          <label className="wx-field">
            <span>Alias (optional)</span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="daily-eth"
              autoComplete="off"
            />
          </label>
          <WizardActions
            onBack={() => router.push('/wallets/onboarding')}
            onNext={() => setStep('network')}
            nextDisabled={!nameOk}
          />
        </section>
      ) : null}

      {step === 'network' ? (
        <section className="wx-panel" aria-labelledby="wx-net">
          <h2 id="wx-net">Network selection</h2>
          <p className="wx__sub">
            Primary asset for this account. You can add more networks later.
          </p>
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
          <WizardActions onBack={() => setStep('name')} onNext={() => setStep('account')} />
        </section>
      ) : null}

      {step === 'account' ? (
        <section className="wx-panel" aria-labelledby="wx-acct">
          <h2 id="wx-acct">Account preview</h2>
          <dl className="wx-kv">
            <div>
              <dt>Name</dt>
              <dd>{name.trim()}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>
                {network.label} · {network.asset}
              </dd>
            </div>
            <div>
              <dt>Alias</dt>
              <dd>{alias.trim() || '—'}</dd>
            </div>
          </dl>
          <Alert tone="info" title="Keys stay protected">
            Auvora custody does not stream raw seed material to the browser. After creation you can
            rehearse recovery education at <Link href="/wallets/recovery">Recovery rehearsal</Link>.
          </Alert>
          <WizardActions onBack={() => setStep('network')} onNext={() => setStep('backup')} />
        </section>
      ) : null}

      {step === 'backup' ? (
        <section className="wx-panel" aria-labelledby="wx-backup">
          <h2 id="wx-backup">Backup reminder</h2>
          <p className="wx__sub">Confirm you understand how Auvora treats recovery material.</p>
          <ul className="wx-checklist">
            <li>
              <Checkbox
                checked={backupAck}
                onCheckedChange={(v) => setBackupAck(v === true)}
                label="I will complete a recovery rehearsal after setup"
              />
            </li>
            <li>
              <Checkbox
                checked={offlineAck}
                onCheckedChange={(v) => setOfflineAck(v === true)}
                label="I will keep any offline backups private and offline"
              />
            </li>
            <li>
              <Checkbox
                checked={shareAck}
                onCheckedChange={(v) => setShareAck(v === true)}
                label="I will never share recovery words with anyone, including support"
              />
            </li>
          </ul>
          <WizardActions
            onBack={() => setStep('account')}
            onNext={() => setStep('confirm')}
            nextDisabled={!(backupAck && offlineAck && shareAck)}
          />
        </section>
      ) : null}

      {step === 'confirm' ? (
        <section className="wx-panel" aria-labelledby="wx-confirm">
          <h2 id="wx-confirm">Confirm creation</h2>
          <p className="wx__sub">
            Creating <strong>{name.trim()}</strong> on {network.label}.
          </p>
          {error ? (
            <Alert tone="error" title="Create failed">
              {error}
            </Alert>
          ) : null}
          <WizardActions
            onBack={() => setStep('backup')}
            onNext={() => void create()}
            nextLabel="Create wallet"
            nextLoading={submitting}
          />
        </section>
      ) : null}

      {step === 'success' ? (
        <>
          {error ? (
            <Alert tone="warn" title="Preview mode">
              {error}
            </Alert>
          ) : null}
          <SuccessState
            title="Wallet ready"
            description={
              createdId
                ? `${name.trim()} is set up. Next: rehearse recovery or fund the account.`
                : 'Wallet created.'
            }
            action={
              <div className="wx__actions">
                <Link
                  href={
                    createdId && !createdId.startsWith('preview-')
                      ? `/wallets/${createdId}`
                      : '/wallets'
                  }
                >
                  <Button>Open wallet</Button>
                </Link>
                <Link href="/wallets/recovery">
                  <Button variant="secondary">Recovery rehearsal</Button>
                </Link>
                <Link href="/receive">
                  <Button variant="ghost">Receive funds</Button>
                </Link>
              </div>
            }
          />
        </>
      ) : null}
    </WizardShell>
  );
}
