import { Suspense, type ReactElement } from 'react';
import { ReceiveExperience } from '../../components/wallet/ReceiveExperience';

export default function ReceivePage(): ReactElement {
  return (
    <Suspense fallback={<div className="cx-panel">Loading receive…</div>}>
      <ReceiveExperience />
    </Suspense>
  );
}
