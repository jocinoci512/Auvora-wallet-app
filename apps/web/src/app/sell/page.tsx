import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';

export default function SellPage(): ReactElement {
  return (
    <ComingSoonPanel title="Sell">
      <p>Off-ramp is Coming soon. No funds move. Simulated sell checkout is not shown.</p>
    </ComingSoonPanel>
  );
}
