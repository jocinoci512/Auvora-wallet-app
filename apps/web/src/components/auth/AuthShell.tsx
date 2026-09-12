'use client';

import type { ReactElement, ReactNode } from 'react';
import { BrandLogo } from '@auvora/ui';
import '../../app/consumer.css';

export function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  return (
    <div className="as">
      <div className="as__brand">
        <BrandLogo variant="primary" height={48} className="as__logo as__logo--light" />
        <BrandLogo variant="reverse" height={48} className="as__logo as__logo--dark" />
      </div>
      <h1 className="as__title">{title}</h1>
      <p className="as__lede">{lede}</p>
      <div className="as-card">{children}</div>
      {footer}
      <p className="as-note">
        Auvora protects your account without taking custody of your wallet keys.
      </p>
    </div>
  );
}
