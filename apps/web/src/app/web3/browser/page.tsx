import { Suspense, type ReactElement } from 'react';
import { DappBrowserExperience } from '../../../components/web3/DappBrowserExperience';
import '../../web3-experience.css';

export default function Web3BrowserPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="w3" aria-busy="true" aria-label="Loading browser">
          <div className="w3-skeleton" />
        </div>
      }
    >
      <DappBrowserExperience />
    </Suspense>
  );
}
