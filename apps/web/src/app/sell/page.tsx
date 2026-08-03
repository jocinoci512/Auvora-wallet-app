import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';
import { SellExperience } from '../../components/trading/SellExperience';

export default function SellPage(): ReactElement {
  return (
    <>
      <ComingSoonPanel title="Sell">
        <p>Off-ramp is Coming soon. No funds move in this Alpha companion.</p>
      </ComingSoonPanel>
      <SellExperience />
    </>
  );
}
