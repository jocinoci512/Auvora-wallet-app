'use client';

import type { CSSProperties, ReactElement } from 'react';
import {
  DAPP_PERMISSION_CODES,
  permissionInfoFor,
  type DappPermissionCode,
} from '../../lib/web3/permissions';
import { riskLabel } from '../../lib/web3/demo';

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.65rem',
};

type Props = {
  codes: string[];
  /** When true, show the full catalog (for education) with requested ones highlighted. */
  showCatalog?: boolean;
  compact?: boolean;
};

export function PermissionExplainList({
  codes,
  showCatalog = false,
  compact = false,
}: Props): ReactElement {
  const requested = new Set(codes);
  const rows: DappPermissionCode[] = showCatalog
    ? [...DAPP_PERMISSION_CODES]
    : (codes.filter((c) => permissionInfoFor(c)) as DappPermissionCode[]);

  if (rows.length === 0) {
    return <p className="cx-meta">No recognized permissions in this request.</p>;
  }

  return (
    <ul className="cx-list" style={listStyle} aria-label="Permission details">
      {rows.map((code) => {
        const info = permissionInfoFor(code)!;
        const on = requested.has(code);
        if (showCatalog && !on && compact) return null;
        return (
          <li key={code}>
            <div>
              <strong>
                {info.title}
                {showCatalog ? (
                  <span className="cx-meta"> · {on ? 'Requested' : 'Not requested'}</span>
                ) : null}
              </strong>
              {!compact ? <p className="cx-meta">{info.explanation}</p> : null}
              <span className="cx-badge">{riskLabel(info.risk)}</span>
              {info.canMoveFunds ? (
                <p className="cx-meta">Can move funds after you approve each transaction.</p>
              ) : info.risk === 'medium' || info.risk === 'elevated' ? (
                <p className="cx-meta">
                  Does not send funds by itself — some signatures can still authorize spending
                  later.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
