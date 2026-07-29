'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Button, IconButton } from '@auvora/ui';
import { Check, Copy, Share2 } from 'lucide-react';

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
      setError('Clipboard unavailable');
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
    <div className="wx-qr">
      <div className="wx-qr__frame" style={{ width: size, height: size }}>
        {dataUrl ? (
          <img src={dataUrl} alt={label} width={size} height={size} />
        ) : (
          <div className="wx-qr__skel" aria-busy={!error} aria-label="Generating QR">
            {error ?? 'Generating…'}
          </div>
        )}
      </div>
      {error && dataUrl ? (
        <p className="wx-meta" role="alert">
          {error}
        </p>
      ) : null}
      <p className="wx-qr__value">
        <code>{value}</code>
      </p>
      <div className="wx-qr__actions">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          <Copy size={16} aria-hidden /> {copied ? 'Copied' : 'Copy'}
        </Button>
        <IconButton label="Share address" onClick={() => void share()}>
          <Share2 size={16} />
        </IconButton>
        {copied ? (
          <span className="wx-inline-ok" role="status">
            <Check size={14} aria-hidden /> Copied to clipboard
          </span>
        ) : null}
      </div>
    </div>
  );
}
