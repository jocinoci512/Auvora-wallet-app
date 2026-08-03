import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';
import { SwapExperience } from '../../components/trading/SwapExperience';

export default function SwapPage(): ReactElement {
  return (
    <>
      <ComingSoonPanel title="Swap">
        <p>
          Preview quotes may appear below. Confirming does not broadcast — liveBroadcastEnabled
          remains false.
        </p>
      </ComingSoonPanel>
      <SwapExperience />
    </>
  );
}
