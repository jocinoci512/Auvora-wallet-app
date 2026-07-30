import { Suspense, type ReactElement } from 'react';
import { PermissionCenterExperience } from '../../../components/web3/PermissionCenterExperience';

export default function Web3PermissionsPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="cx cx--wide" aria-busy="true" aria-label="Loading permissions">
          <div className="cx-panel">
            <p className="cx-meta">Loading permissions…</p>
          </div>
        </div>
      }
    >
      <PermissionCenterExperience />
    </Suspense>
  );
}
