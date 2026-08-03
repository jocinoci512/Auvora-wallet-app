'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  buildConnectMobilePayload,
  buildMobilePairHint,
  createPreviewSession,
  disconnectAllPairingSessions,
  disconnectPairingSession,
  getPublicWcProjectId,
  isReownWebConfigured,
  listPairingSessions,
  type PairingSession,
  upsertPairingSession,
} from '../../lib/reown/web-pairing';
import { FeatureStatusBadge } from '../shell/FeatureStatusBadge';
import { ReleaseConfig } from '../../lib/release/config';

export function MobilePairingExperience(): ReactElement {
  const configured = useMemo(() => isReownWebConfigured(), []);
  const connectPayload = useMemo(() => buildConnectMobilePayload(getPublicWcProjectId()), []);
  const [sessions, setSessions] = useState<PairingSession[]>([]);
  const [uri, setUri] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setSessions(listPairingSessions());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(connectPayload.qrPayload, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [connectPayload.qrPayload]);

  function restore(): void {
    setSessions(listPairingSessions());
    setMessage('Restored sessions from this browser.');
  }

  function addPreview(): void {
    const next = upsertPairingSession(createPreviewSession());
    setSessions(next);
    setMessage('Preview session added — not a live Reown relay session.');
  }

  function connectUri(): void {
    const trimmed = uri.trim();
    if (!trimmed.toLowerCase().startsWith('wc:')) {
      setMessage('Paste a WalletConnect URI starting with wc:');
      return;
    }
    if (!configured) {
      setMessage(buildMobilePairHint(false));
      return;
    }
    const now = new Date().toISOString();
    const session: PairingSession = {
      topic: `manual-${Date.now()}`,
      name: 'Pending mobile approval',
      chains: ['eip155:1'],
      accounts: [],
      pairedAt: now,
      lastActiveAt: now,
      source: 'manual',
    };
    setSessions(upsertPairingSession(session));
    setUri('');
    setMessage(
      'URI recorded for companion pairing. Approve on Auvora Android (same Reown Cloud project). Keys stay on mobile. Live broadcast remains off.',
    );
  }

  return (
    <section className="auv-pair" aria-labelledby="auv-pair-title">
      <div className="auv-pair__head">
        <h1 id="auv-pair-title">Pair with mobile</h1>
        <FeatureStatusBadge status={configured ? 'BETA' : 'COMING_SOON'} />
      </div>
      <p>
        One ecosystem: web is the companion; Android holds self-custody keys via Reown WalletKit.
        This browser never receives a Reown Secret. {ReleaseConfig.buildLabel}.
      </p>
      <div className={`auv-pair__status${configured ? ' is-ready' : ''}`}>
        <strong>{configured ? 'Project ID configured' : 'Project ID not configured'}</strong>
        <p>{buildMobilePairHint(configured)}</p>
      </div>

      <section className="auv-pair__panel">
        <h2>Connect Auvora Mobile</h2>
        <p>{connectPayload.instructions}</p>
        <div className="auv-pair__qr">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR to open Auvora Mobile pairing" width={220} height={220} />
          ) : (
            <p>Preparing QR…</p>
          )}
        </div>
        <p className="auv-auth__hint">
          Deep link: <code>{connectPayload.deepLink}</code>
        </p>
        <div className="auv-pair__actions">
          <a className="mh-btn mh-btn--primary" href={connectPayload.deepLink}>
            Open Auvora Mobile
          </a>
          <button
            type="button"
            className="mh-btn mh-btn--ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(connectPayload.deepLink);
                setMessage('Deep link copied.');
              } catch {
                setMessage('Could not copy deep link.');
              }
            }}
          >
            Copy deep link
          </button>
        </div>
        <p className="auv-auth__note">
          Reown Secret is never used in the browser. Live Universal Provider relay remains{' '}
          {configured ? 'BETA (device verification required)' : 'blocked until Project ID is set'}.
          Live transaction broadcast stays OFF.
        </p>
      </section>

      <section className="auv-pair__panel">
        <h2>Connect with URI</h2>
        <label className="auv-auth__field">
          <span>WalletConnect URI</span>
          <textarea
            rows={3}
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="wc:…"
            spellCheck={false}
          />
        </label>
        <div className="auv-pair__actions">
          <button type="button" className="mh-btn mh-btn--primary" onClick={connectUri}>
            Pair
          </button>
          <button type="button" className="mh-btn mh-btn--ghost" onClick={restore}>
            Restore sessions
          </button>
          <button type="button" className="mh-btn mh-btn--ghost" onClick={addPreview}>
            Add preview session
          </button>
        </div>
        {message ? (
          <p className="auv-auth__info" role="status">
            {message}
          </p>
        ) : null}
      </section>

      <section className="auv-pair__panel">
        <div className="auv-pair__list-head">
          <h2>Sessions</h2>
          {sessions.length ? (
            <button
              type="button"
              className="mh-btn mh-btn--ghost mh-btn--sm"
              onClick={() => {
                disconnectAllPairingSessions();
                setSessions([]);
                setMessage('All local sessions disconnected.');
              }}
            >
              Disconnect all
            </button>
          ) : null}
        </div>
        {sessions.length === 0 ? (
          <p>No restored sessions on this browser yet.</p>
        ) : (
          <ul className="auv-pair__list">
            {sessions.map((s) => (
              <li key={s.topic}>
                <div>
                  <strong>{s.name}</strong>
                  <span>
                    {s.source} · {new Date(s.lastActiveAt).toLocaleString()}
                  </span>
                  {s.accounts.length ? <span>{s.accounts.join(', ')}</span> : null}
                </div>
                <button
                  type="button"
                  className="mh-btn mh-btn--ghost mh-btn--sm"
                  onClick={() => {
                    setSessions(disconnectPairingSession(s.topic));
                  }}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>
        Prefer signing on device? Open <Link href="/send">Send preview</Link> then approve on mobile
        when pairing is live. Broadcast kill switch stays off.
      </p>
    </section>
  );
}
