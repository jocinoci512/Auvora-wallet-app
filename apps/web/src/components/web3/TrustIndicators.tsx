'use client';

import { Alert } from '@auvora/ui';
import type { CSSProperties, ReactElement } from 'react';
import { riskLabel } from '../../lib/web3/demo';
import { assessTrust, type TrustAssessment } from '../../lib/web3/trust';

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  marginTop: '0.35rem',
};

type Props = {
  origin: string;
  permissions?: string[];
  previouslyConnected?: boolean;
  newlyConnected?: boolean;
  pendingRequestCount?: number;
  /** Optional precomputed assessment (avoids double work). */
  assessment?: TrustAssessment;
  showRiskNotes?: boolean;
};

export function TrustIndicators({
  origin,
  permissions,
  previouslyConnected,
  newlyConnected,
  pendingRequestCount,
  assessment: assessmentProp,
  showRiskNotes = true,
}: Props): ReactElement {
  const assessment =
    assessmentProp ??
    assessTrust({
      origin,
      permissions,
      previouslyConnected,
      newlyConnected,
      pendingRequestCount,
    });

  const present = assessment.flags.filter((f) => f.present);
  const missing = assessment.flags.filter((f) => !f.present);

  return (
    <div>
      <p className="cx-meta">{assessment.summary}</p>
      <div style={chipRow} role="list" aria-label="Trust signals">
        {present.map((f) => (
          <span key={f.id} className="cx-chip is-on" role="listitem">
            {f.label}
          </span>
        ))}
        {present.length === 0 ? (
          <span className="cx-chip" role="listitem">
            We can’t verify this site yet
          </span>
        ) : null}
        {missing
          .filter((f) => f.id === 'verified-domain' && !assessment.hasVerifiedDomain)
          .map((f) => (
            <span key={`missing-${f.id}`} className="cx-chip" role="listitem">
              Catalog verification missing
            </span>
          ))}
      </div>
      <p className="cx-meta" style={{ marginTop: '0.45rem' }}>
        Request risk · {riskLabel(assessment.overallRisk)}
      </p>
      {showRiskNotes && assessment.riskNotes.length > 0 ? (
        <Alert tone="warn" title="Review carefully">
          <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
            {assessment.riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
