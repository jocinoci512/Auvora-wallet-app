import { Suspense, type ReactElement } from 'react';
import { DappBrowserExperience } from '../../../components/web3/DappBrowserExperience';

export default function Web3BrowserPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="cx cx--wide" aria-busy="true" aria-label="Loading browser">
          <div className="cx-panel">
            <p className="cx-meta">Loading browser…</p>
          </div>
        </div>
      }
    >
      <DappBrowserExperience />
    </Suspense>
  );
}
