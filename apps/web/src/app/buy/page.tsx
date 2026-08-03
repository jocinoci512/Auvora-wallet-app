import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';
import { BuyExperience } from '../../components/trading/BuyExperience';

export default function BuyPage(): ReactElement {
  return (
    <>
      <ComingSoonPanel title="Buy">
        <p>Fiat on-ramp is Coming soon. No payment is charged in this Alpha companion.</p>
      </ComingSoonPanel>
      <BuyExperience />
    </>
  );
}
