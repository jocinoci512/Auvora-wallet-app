'use client';

import { AuvoraClientError, type KycProfile, type VerificationRequest } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { productKycLabel } from '../../lib/kyc-status-label';

export default function CompliancePage(): ReactElement {
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [status, setStatus] = useState<VerificationRequest | null>(null);
  const [legalName, setLegalName] = useState('QA User');
  const [country, setCountry] = useState('US');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [p, s] = await Promise.all([client.getComplianceProfile(), client.getKycStatus()]);
      setProfile(p);
      setStatus(s);
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
        requestedLevel: 'BASIC',
        country,
        legalName: legalName || undefined,
      });
      setStatus(result);
      setMessage(`Verification submitted. Status: ${productKycLabel(result.status)}`);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Identity verification</h1>
      <p>
        <Link href="/">Home</Link>
      </p>
      {loading ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {profile ? (
        <section>
          <h2>Status</h2>
          <p>{productKycLabel(profile.status)}</p>
          {status?.rejectionReason ? <p>{status.rejectionReason}</p> : null}
          <p>
            Transfers of $5,000 or more require verified identity. Transfers of $10,000 or more also
            need a short review before they can continue. Nothing is sent until you sign on this
            device.
          </p>
        </section>
      ) : null}
      {status ? (
        <section>
          <h2>Latest request</h2>
          <p>{productKycLabel(status.status)}</p>
        </section>
      ) : null}
      <section>
        <h2>Submit verification</h2>
        <p>
          Use synthetic test identity only in this environment. Do not enter real documents or IDs.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Legal name
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit verification'}
          </Button>
        </form>
      </section>
    </main>
  );
}
