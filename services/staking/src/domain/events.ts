export const STAKING_EVENTS = {
  STAKE_PREPARED: 'staking.stake.prepared',
  STAKE_EXECUTED: 'staking.stake.executed',
  UNSTAKE_PREPARED: 'staking.unstake.prepared',
  UNSTAKE_EXECUTED: 'staking.unstake.executed',
  REWARD_AVAILABLE: 'staking.reward.available',
  REWARD_CLAIMED: 'staking.reward.claimed',
  VALIDATOR_STATUS_CHANGED: 'staking.validator.status_changed',
  POSITION_SYNCED: 'staking.position.synced',
} as const;
