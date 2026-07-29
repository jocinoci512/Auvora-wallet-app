import { Suspense, type ReactElement } from 'react';
import { SigningExperience } from '../../../components/web3/SigningExperience';

export default function Web3SignPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="cx cx--wide" aria-busy="true" aria-label="Loading signing">
          <div className="cx-panel">
            <p className="cx-meta">Loading signing…</p>
          </div>
        </div>
      }
    >
      <SigningExperience />
    </Suspense>
  );
}
