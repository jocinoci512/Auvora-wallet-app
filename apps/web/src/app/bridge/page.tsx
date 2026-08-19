import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';

export default function BridgePage(): ReactElement {
  return (
    <ComingSoonPanel title="Bridge">
      <p>Bridge is Coming soon. No assets move between chains in this Alpha companion.</p>
    </ComingSoonPanel>
  );
}
