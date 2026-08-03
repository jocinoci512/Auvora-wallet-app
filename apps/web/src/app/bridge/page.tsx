import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';
import { BridgeExperience } from '../../components/trading/BridgeExperience';

export default function BridgePage(): ReactElement {
  return (
    <>
      <ComingSoonPanel title="Bridge">
        <p>Bridge preview only. No funds leave a chain while broadcast is off.</p>
      </ComingSoonPanel>
      <BridgeExperience />
    </>
  );
}
