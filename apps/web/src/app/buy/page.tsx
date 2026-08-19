import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';

export default function BuyPage(): ReactElement {
  return (
    <ComingSoonPanel title="Buy">
      <p>Fiat on-ramp is Coming soon. No payment is charged. Simulated checkout is not shown.</p>
    </ComingSoonPanel>
  );
}
