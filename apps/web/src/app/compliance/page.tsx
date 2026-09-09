'use client';

import { AuvoraClientError, type KycProfile, type VerificationRequest } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { productKycLabel } from '../../lib/kyc-status-label';

export default function CompliancePage(): ReactElement {
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [status, setStatus] = useState<VerificationRequest | null>(null);
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('US');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idType, setIdType] = useState('PASSPORT');
  const [idNumber, setIdNumber] = useState('');
  const [idExpiration, setIdExpiration] = useState('');

  // File upload state
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
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

  const handleFrontFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontFile(file);
      const reader = new FileReader();
      reader.onload = () => setFrontPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setBackFile(file);
      const reader = new FileReader();
      reader.onload = () => setBackPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string) || '';
        // Strip data:image/...;base64, prefix
        const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    setUploadProgress(null);

    try {
      const client = createApiClient();
      let frontDocId: string | undefined;
      let backDocId: string | undefined;

      if (frontFile) {
        setUploadProgress('Uploading front document securely…');
        const frontBase64 = await fileToBase64(frontFile);
        const frontDoc = await client.uploadComplianceDocument({
          documentType: idType,
          fileName: frontFile.name,
          contentType: frontFile.type || 'image/jpeg',
          fileBase64: frontBase64,
          side: 'front',
        });
        frontDocId = frontDoc.id;
      }

      if (backFile) {
        setUploadProgress('Uploading back document securely…');
        const backBase64 = await fileToBase64(backFile);
        const backDoc = await client.uploadComplianceDocument({
          documentType: idType,
          fileName: backFile.name,
          contentType: backFile.type || 'image/jpeg',
          fileBase64: backBase64,
          side: 'back',
        });
        backDocId = backDoc.id;
      }

      setUploadProgress('Submitting verification request…');
      const result = await client.submitKyc({
        requestedLevel: 'BASIC',
        country: country || undefined,
        legalName: legalName.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        idType,
        idNumber: idNumber.trim() || undefined,
        idExpiration: idExpiration || undefined,
        frontDocumentId: frontDocId,
        backDocumentId: backDocId,
      });

      setStatus(result);
      setMessage(`Verification submitted. Current status: ${productKycLabel(result.status)}`);
      setFrontFile(null);
      setFrontPreview(null);
      setBackFile(null);
      setBackPreview(null);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  const isPendingReview =
    status?.status === 'SUBMITTED' ||
    status?.status === 'IN_REVIEW' ||
    status?.status === 'PENDING_PROVIDER';

  const isApproved = status?.status === 'APPROVED' || profile?.status === 'APPROVED';

  return (
    <main>
      <h1>Identity verification</h1>
      <p>
        <Link href="/">Home</Link> · <Link href="/compliance/documents">Documents</Link>
      </p>
      {loading ? <p>Loading…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ color: 'green' }}>{message}</p> : null}

      {profile ? (
        <section
          style={{
            border: '1px solid #ccc',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          <h2>Current verification status</h2>
          <p>
            <strong>Status:</strong> {productKycLabel(profile.status)}
          </p>
          {status?.rejectionReason ? (
            <p style={{ color: '#b00' }}>
              <strong>Notice:</strong> {status.rejectionReason}
            </p>
          ) : null}
          <p style={{ fontSize: '0.9rem', color: '#555' }}>
            Transfers under $5,000 do not require KYC. Transfers of $5,000 to $9,999.99 require
            verified identity. Transfers of $10,000 or more require verified identity and an
            administrative review. Nothing is ever signed or broadcast without your explicit
            on-device authorization.
          </p>
        </section>
      ) : null}

      {isApproved ? (
        <section style={{ padding: '1rem', background: '#e6f7ec', borderRadius: '8px' }}>
          <h2>Identity verified</h2>
          <p>
            Your identity has been verified by the Auvora Compliance team. No further action is
            required.
          </p>
        </section>
      ) : isPendingReview ? (
        <section style={{ padding: '1rem', background: '#f0f4ff', borderRadius: '8px' }}>
          <h2>Verification in review</h2>
          <p>
            Your identity submission was received on{' '}
            {status?.submittedAt ? new Date(status.submittedAt).toLocaleString() : 'recently'}. An
            authorized administrator is reviewing your documentation. You will receive an update
            once the review is complete.
          </p>
        </section>
      ) : (
        <section style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <h2>
            {status?.status === 'REQUIRES_RESUBMISSION' || status?.status === 'REJECTED'
              ? 'Resubmit identity verification'
              : 'Submit identity verification'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            Documents are encrypted at rest and accessible only to authorized administrators for
            compliance verification.
          </p>

          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              Legal name
              <input
                required
                type="text"
                value={legalName}
                placeholder="Full legal name"
                onChange={(e) => setLegalName(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              Date of birth
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              Country
              <input
                required
                type="text"
                maxLength={2}
                value={country}
                placeholder="e.g. US, CA, GB"
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              Identification document type
              <select value={idType} onChange={(e) => setIdType(e.target.value)}>
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID card</option>
                <option value="DRIVER_LICENSE">Driver&apos;s license</option>
                <option value="RESIDENCE_PERMIT">Residence permit</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              ID number
              <input
                type="text"
                value={idNumber}
                placeholder="Document / ID number"
                onChange={(e) => setIdNumber(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              ID expiration date (optional)
              <input
                type="date"
                value={idExpiration}
                onChange={(e) => setIdExpiration(e.target.value)}
              />
            </label>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                Front of ID (Photo / Document)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFrontFileChange}
                />
              </label>
              {frontPreview ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <img
                    src={frontPreview}
                    alt="Front preview"
                    style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <button
                    type="button"
                    style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px' }}
                    onClick={() => {
                      setFrontFile(null);
                      setFrontPreview(null);
                    }}
                  >
                    Remove front document
                  </button>
                </div>
              ) : null}
            </div>

            {idType !== 'PASSPORT' ? (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  Back of ID (where applicable)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleBackFileChange}
                  />
                </label>
                {backPreview ? (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img
                      src={backPreview}
                      alt="Back preview"
                      style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button
                      type="button"
                      style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px' }}
                      onClick={() => {
                        setBackFile(null);
                        setBackPreview(null);
                      }}
                    >
                      Remove back document
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {uploadProgress ? (
              <p style={{ fontSize: '0.85rem', color: '#0066cc' }}>{uploadProgress}</p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit verification'}
            </Button>
          </form>
        </section>
      )}
    </main>
  );
}
