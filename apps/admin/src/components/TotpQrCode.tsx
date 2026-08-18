'use client';

import { useEffect, useState, type ReactElement } from 'react';

export function TotpQrCode({ otpauthUrl }: { otpauthUrl: string }): ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDataUrl(null);
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(otpauthUrl, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0B1220', light: '#FFFFFF' },
        }),
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl]);

  if (failed) {
    return (
      <p className="admin-auth-copy">
        The QR code could not be rendered. Use the manual setup key below.
      </p>
    );
  }

  return (
    <figure className="admin-mfa-qr">
      {dataUrl ? (
        // Secret is encoded in the QR payload, never in alt text or the filename.
        <img src={dataUrl} width={256} height={256} alt="Google Authenticator QR code" />
      ) : (
        <div className="admin-mfa-qr__placeholder" aria-hidden="true" />
      )}
      <figcaption>Scan this code with Google Authenticator</figcaption>
    </figure>
  );
}
