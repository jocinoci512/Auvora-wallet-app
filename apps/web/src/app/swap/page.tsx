import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';

export default function SwapPage(): ReactElement {
  return (
    <ComingSoonPanel title="Swap">
      <p>
        Swap is not available until a production quote provider is wired. Simulated quotes are not
        shown as live prices.
      </p>
    </ComingSoonPanel>
  );
}
