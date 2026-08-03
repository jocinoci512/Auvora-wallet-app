'use client';

import type { ReactElement } from 'react';
import type { FeatureStatus } from '../../lib/product/feature-catalog';
import { statusLabel } from '../../lib/product/feature-catalog';

export function FeatureStatusBadge({
  status,
  className,
}: {
  status: FeatureStatus | 'Demo' | 'Beta' | 'Soon';
  className?: string;
}): ReactElement {
  const mapped: FeatureStatus =
    status === 'Demo'
      ? 'DEMO'
      : status === 'Beta'
        ? 'BETA'
        : status === 'Soon'
          ? 'COMING_SOON'
          : status;
  const label = statusLabel(mapped);
  return (
    <span
      className={`auv-badge auv-badge--${mapped.toLowerCase()}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}
