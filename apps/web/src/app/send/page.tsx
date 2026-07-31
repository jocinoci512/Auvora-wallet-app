import { Suspense, type ReactElement } from 'react';
import { SendExperience } from '../../components/wallet/SendExperience';

export default function SendPage(): ReactElement {
  return (
    <Suspense fallback={<div className="cx-panel">Loading send…</div>}>
      <SendExperience />
    </Suspense>
  );
}
