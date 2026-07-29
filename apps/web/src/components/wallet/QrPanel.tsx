'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface QrPanelProps {
  value: string;
  label?: string;
  size?: number;
}

export function QrPanel({ value, label = 'QR code', size = 200 }: QrPanelProps): ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);
    void (async () => {
      try {
        const QR = await import('qrcode');
        const url = await QR.toDataURL(value, {
          width: size * 2,
          margin: 1,
          color: { dark: '#0b1220', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) {
          setDataUrl(url);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
          setError('Could not render QR code');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  useEffect(
    () => () => {
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Clipboard unavailable — select the address and copy manually.');
    }
  }

  async function share(): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Auvora receive address', text: value });
        return;
      } catch {
        /* fall through */
      }
    }
    await copy();
  }

  return (
    <div className="cx-qr">
      <div className="cx-qr__frame" style={{ width: size, height: size }}>
        {dataUrl ? (
          <img src={dataUrl} alt={label} width={size} height={size} />
        ) : (
          <div className="cx-qr__skel" aria-busy={!error} aria-label="Generating QR">
            {error ?? 'Generating…'}
          </div>
        )}
      </div>
      {error && dataUrl ? (
        <p className="cx-meta" role="alert">
          {error}
        </p>
      ) : null}
      <p className="cx-qr__value">
        <code>{value}</code>
      </p>
      <div className="cx-qr__actions">
        <button type="button" className="cx-btn cx-btn--ghost" onClick={() => void copy()}>
          <Copy size={16} aria-hidden /> {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          className="cx-btn cx-btn--ghost"
          onClick={() => void share()}
          aria-label="Share address"
        >
          <Share2 size={16} aria-hidden /> Share
        </button>
        {copied ? (
          <span className="cx-inline-ok" role="status">
            <Check size={14} aria-hidden /> Copied to clipboard
          </span>
        ) : null}
      </div>
    </div>
  );
}
