import { Suspense, type ReactElement } from 'react';
import { SigningExperience } from '../../../components/web3/SigningExperience';
import '../../web3-experience.css';

export default function Web3SignPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="w3" aria-busy="true" aria-label="Loading signing">
          <div className="w3-skeleton" />
        </div>
      }
    >
      <SigningExperience />
    </Suspense>
  );
}
