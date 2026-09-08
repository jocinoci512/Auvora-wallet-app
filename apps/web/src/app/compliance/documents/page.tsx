'use client';

import { AuvoraClientError, type ComplianceDocument } from '@auvora/sdk';
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
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function ComplianceDocumentsPage(): ReactElement {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [documentType, setDocumentType] = useState('PASSPORT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string) || '';
        const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const client = createApiClient();
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        await client.uploadComplianceDocument({
          documentType,
          fileName: selectedFile.name,
          contentType: selectedFile.type || 'image/jpeg',
          fileBase64: base64,
        });
      } else {
        await client.uploadComplianceDocument({
          documentType,
          storageKey: storageKey || `local://${fileName || 'document'}`,
          fileName: fileName || undefined,
        });
      }
      setMessage('Document uploaded successfully');
      setSelectedFile(null);
      setFilePreview(null);
      setStorageKey('');
      setFileName('');
      await load();
    } catch (err) {
      if (err instanceof AuvoraClientError) setError(err.message);
      else setError(formatApiError(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <main>
      <h1>Compliance documents</h1>
      <p>
        <Link href="/compliance">Back to KYC</Link>
      </p>
      {error ? (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ color: 'green' }}>{message}</p> : null}

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Document type
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="PASSPORT">Passport</option>
            <option value="NATIONAL_ID">National ID card</option>
            <option value="DRIVER_LICENSE">Driver license</option>
            <option value="RESIDENCE_PERMIT">Residence permit</option>
            <option value="PROOF_OF_ADDRESS">Proof of address</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Select document file
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
          />
        </label>

        {filePreview ? (
          <div>
            <img
              src={filePreview}
              alt="Preview"
              style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        ) : null}

        {!selectedFile ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              File name (optional)
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              Storage key (optional)
              <input
                value={storageKey}
                onChange={(e) => setStorageKey(e.target.value)}
                placeholder="s3://… or local://…"
              />
            </label>
          </>
        ) : null}

        <Button type="submit" disabled={uploading}>
          {uploading
            ? 'Uploading…'
            : selectedFile
              ? 'Upload encrypted file'
              : 'Upload document metadata'}
        </Button>
      </form>

      <h2 style={{ marginTop: '2rem' }}>Uploaded documents</h2>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <strong>{doc.documentType}</strong> — {doc.status}{' '}
            {doc.fileName ? `(${doc.fileName})` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
