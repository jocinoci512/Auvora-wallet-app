import type { ReactElement } from 'react';
import { ComingSoonPanel } from '../../components/shell/ComingSoonPanel';
import { StakingExperience } from '../../components/trading/StakingExperience';

export default function StakingPage(): ReactElement {
  return (
    <>
      <ComingSoonPanel title="Staking">
        <p>Demo positions only. Staking is Coming soon — not a live product claim.</p>
      </ComingSoonPanel>
      <StakingExperience />
    </>
  );
}
