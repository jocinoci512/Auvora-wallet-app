'use client';

import {
  AuvoraClientError,
  type ComplianceRiskSummary,
  type KycProfile,
  type VerificationRequest,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function CompliancePage(): ReactElement {
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [status, setStatus] = useState<VerificationRequest | null>(null);
  const [risk, setRisk] = useState<ComplianceRiskSummary | null>(null);
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('US');
  const [level, setLevel] = useState('BASIC');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [p, s, r] = await Promise.all([
        client.getComplianceProfile(),
        client.getKycStatus(),
        client.getComplianceRisk(),
      ]);
      setProfile(p);
      setStatus(s);
      setRisk(r);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.submitKyc({
        requestedLevel: level,
        country,
        legalName: legalName || undefined,
      });
      setStatus(result);
      setMessage(`KYC submitted — status ${result.status}`);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Compliance / KYC</h1>
      <p>
        <Link href="/">Home</Link> · <Link href="/compliance/documents">Documents</Link>
      </p>
      {loading ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {profile ? (
        <section>
          <h2>Profile</h2>
          <p>
            Level: {profile.level} · Status: {profile.status} · Risk: {String(profile.riskScore)} (
            {profile.riskBand})
          </p>
        </section>
      ) : null}
      {risk ? (
        <section>
          <h2>Risk summary</h2>
          <p>
            {String(risk.score)} / {risk.band}
          </p>
        </section>
      ) : null}
      {status ? (
        <section>
          <h2>Latest verification</h2>
          <p>
            {status.requestedLevel} — {status.status}
            {status.rejectionReason ? ` (${status.rejectionReason})` : ''}
          </p>
        </section>
      ) : null}
      <section>
        <h2>Submit KYC</h2>
        <form onSubmit={onSubmit}>
          <label>
            Legal name
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <label>
            Level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="BASIC">BASIC</option>
              <option value="STANDARD">STANDARD</option>
              <option value="ENHANCED">ENHANCED</option>
              <option value="FULL">FULL</option>
            </select>
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit verification'}
          </Button>
        </form>
      </section>
    </main>
  );
}
