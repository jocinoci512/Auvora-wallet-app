'use client';

import { AuvoraClientError, type ComplianceDocument } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function ComplianceDocumentsPage(): ReactElement {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [documentType, setDocumentType] = useState('PASSPORT');
  const [storageKey, setStorageKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      setDocs(await client.listComplianceDocuments());
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setMessage(null);
    try {
      const client = createApiClient();
      await client.uploadComplianceDocument({
        documentType,
        storageKey: storageKey || `local://${fileName || 'document'}`,
        fileName: fileName || undefined,
      });
      setMessage('Document uploaded');
      setStorageKey('');
      await load();
    } catch (err) {
      if (err instanceof AuvoraClientError) setError(err.message);
      else setError(formatApiError(err));
    }
  }

  return (
    <main>
      <h1>Compliance documents</h1>
      <p>
        <Link href="/compliance">Back to KYC</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      <form onSubmit={onSubmit}>
        <label>
          Type
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="PASSPORT">Passport</option>
            <option value="DRIVER_LICENSE">Driver license</option>
            <option value="NATIONAL_ID">National ID</option>
            <option value="PROOF_OF_ADDRESS">Proof of address</option>
            <option value="SELFIE">Selfie</option>
            <option value="LIVENESS">Liveness</option>
          </select>
        </label>
        <label>
          File name
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </label>
        <label>
          Storage key
          <input value={storageKey} onChange={(e) => setStorageKey(e.target.value)} placeholder="s3://… or local://…" />
        </label>
        <Button type="submit">Upload metadata</Button>
      </form>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            {doc.documentType} — {doc.status} {doc.fileName ? `(${doc.fileName})` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
