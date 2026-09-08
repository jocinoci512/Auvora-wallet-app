import { ChainNetwork } from '@auvora/database';
import {
  evaluateMainnetBroadcastGate,
  MAINNET_CHAIN_CONFIRMATION_POLICIES,
  validateChainAddress,
  type MainnetDefenseInDepthContext,
} from './mainnet-rollout';

describe('Mainnet Controlled Rollout Defense-in-Depth Suite', () => {
  const defaultValidContext: MainnetDefenseInDepthContext = {
    environment: 'production',
    globalMainnetEnabled: true,
    chainRolloutState: 'ACTIVE',
    emergencyPauseActive: false,
    chain: ChainNetwork.ETHEREUM,
    expectedChainId: 1,
    actualChainId: 1,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/audited-key',
    isApprovedRpcEndpoint: true,
    signingLocation: 'client_local_hardware',
    isLocallySigned: true,
    rawSignedTx:
      '0x02f871018203e8843b9aca008504a817c80082520894d8da6bf26964af9d7eed9e03e53415d37aa96045880de0b6b3a764000080c080a0',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    recipientAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    amount: 100,
    nativeBalance: 1000,
    nativeFeeBalance: 50,
    estimatedFee: 5,
    maxFeeSafetyLimit: 50,
    nonceOrUtxoFresh: true,
    expiresAtMs: Date.now() + 60000,
    nowMs: Date.now(),
    kycApproved: true,
    adminReviewApproved: true,
    isDuplicateTx: false,
    safetyPreflightPassed: true,
  };

  describe('1. Global Emergency Kill Switch', () => {
    it('blocks broadcast when global mainnet switch is OFF (default)', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        globalMainnetEnabled: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('GLOBAL_MAINNET_KILL_SWITCH_ACTIVE');
    });

    it('blocks broadcast when emergency pause is active', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        emergencyPauseActive: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('GLOBAL_EMERGENCY_PAUSE_ACTIVE');
    });
  });

  describe('2. Independent Per-Chain Rollout Gates (All 6 Chains Default OFF)', () => {
    const allChains = [
      ChainNetwork.ETHEREUM,
      ChainNetwork.BNB_SMART_CHAIN,
      ChainNetwork.POLYGON,
      ChainNetwork.SOLANA,
      ChainNetwork.BITCOIN,
      ChainNetwork.TRON,
    ];

    it.each(allChains)('fails closed for %s when state is OFF', (chain) => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        chain,
        chainRolloutState: 'OFF',
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('CHAIN_MAINNET_OFF');
    });

    it.each(allChains)('fails closed for %s when state is READY', (chain) => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        chain,
        chainRolloutState: 'READY',
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('CHAIN_MAINNET_READY_ONLY');
    });

    it.each(allChains)('fails closed for %s when state is PAUSED', (chain) => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        chain,
        chainRolloutState: 'PAUSED',
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('CHAIN_MAINNET_PAUSED');
    });

    it('allows CANARY and ACTIVE when all other safety conditions are met', () => {
      const canaryRes = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        chainRolloutState: 'CANARY',
      });
      expect(canaryRes.allowed).toBe(true);

      const activeRes = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        chainRolloutState: 'ACTIVE',
      });
      expect(activeRes.allowed).toBe(true);
    });
  });

  describe('3. Client-Side Hardware Signing Boundary (Zero Custody Violation)', () => {
    it('blocks broadcast if signing origin is server', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        signingLocation: 'server',
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('SERVER_SIGNING_FORBIDDEN');
    });

    it('blocks broadcast if unsigned or missing local signature', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        isLocallySigned: false,
        rawSignedTx: '',
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('UNSIGNED_TRANSACTION_REJECTED');
    });
  });

  describe('4. Network Identity & RPC Verification', () => {
    it('blocks broadcast if RPC chainId does not match expected mainnet chainId', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        expectedChainId: 1,
        actualChainId: 11155111, // Sepolia testnet ID
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('CHAIN_ID_MISMATCH');
    });

    it('blocks broadcast if RPC endpoint is not an approved provider', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        rpcUrl: 'https://untrusted-public-node.org/rpc',
        isApprovedRpcEndpoint: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('UNAPPROVED_RPC_ENDPOINT');
    });
  });

  describe('5. Address Safety Across All 6 Chains', () => {
    it('validates Ethereum address syntax', () => {
      expect(
        validateChainAddress(ChainNetwork.ETHEREUM, '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'),
      ).toBe(true);
      expect(validateChainAddress(ChainNetwork.ETHEREUM, 'invalid-eth-address')).toBe(false);
    });

    it('validates BNB address syntax', () => {
      expect(
        validateChainAddress(
          ChainNetwork.BNB_SMART_CHAIN,
          '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
        ),
      ).toBe(true);
      expect(validateChainAddress(ChainNetwork.BNB_SMART_CHAIN, 'not-an-address')).toBe(false);
    });

    it('validates Polygon address syntax', () => {
      expect(
        validateChainAddress(ChainNetwork.POLYGON, '0x1a9c8182c09f50c8318d769245be52c32ba46972'),
      ).toBe(true);
      expect(validateChainAddress(ChainNetwork.POLYGON, 'invalid-polygon')).toBe(false);
    });

    it('validates Solana address syntax', () => {
      expect(
        validateChainAddress(ChainNetwork.SOLANA, 'So11111111111111111111111111111111111111112'),
      ).toBe(true);
      expect(validateChainAddress(ChainNetwork.SOLANA, '0xnotSolana')).toBe(false);
    });

    it('validates Bitcoin address syntax', () => {
      expect(
        validateChainAddress(ChainNetwork.BITCOIN, 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'),
      ).toBe(true);
      expect(validateChainAddress(ChainNetwork.BITCOIN, 'invalid-btc-address')).toBe(false);
    });

    it('validates Tron address syntax', () => {
      expect(validateChainAddress(ChainNetwork.TRON, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(
        true,
      );
      expect(validateChainAddress(ChainNetwork.TRON, '0xTronNotHex')).toBe(false);
    });
  });

  describe('6. Balance, Fee & Race Protection', () => {
    it('blocks broadcast if transfer amount exceeds available native balance', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        amount: 5000,
        nativeBalance: 1000,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('INSUFFICIENT_ASSET_BALANCE');
    });

    it('blocks broadcast if estimated fee exceeds native fee asset balance', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        estimatedFee: 60,
        nativeFeeBalance: 50,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('INSUFFICIENT_FEE_ASSET_BALANCE');
    });

    it('blocks broadcast if fee estimate exceeds safety threshold', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        estimatedFee: 50,
        maxFeeSafetyLimit: 20,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('EXCESSIVE_FEE_ESTIMATE');
    });

    it('blocks broadcast when nonce or UTXO is stale', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        nonceOrUtxoFresh: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('STALE_NONCE_OR_UTXO');
    });

    it('blocks broadcast when Solana blockhash or Tron reference block has expired', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        expiresAtMs: 1000,
        nowMs: 2000,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('TRANSACTION_EXPIRED');
    });

    it('blocks broadcast on duplicate submission attempt (idempotency)', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        isDuplicateTx: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('DUPLICATE_BROADCAST_ATTEMPT');
    });

    it('blocks broadcast when dry-run preflight simulation fails', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        safetyPreflightPassed: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('PREFLIGHT_SIMULATION_FAILED');
    });
  });

  describe('7. KYC and Administrator Policy Review Thresholds', () => {
    it('blocks $5,000+ transfer without approved KYC', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        amount: 5000,
        nativeBalance: 10000,
        kycApproved: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('KYC_APPROVAL_REQUIRED');
    });

    it('blocks $10,000+ transfer without administrator policy review', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        amount: 15000,
        nativeBalance: 20000,
        kycApproved: true,
        adminReviewApproved: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.rejectionCode).toBe('ADMIN_POLICY_REVIEW_REQUIRED');
    });

    it('allows high-value transfer only when both KYC and Admin review are approved', () => {
      const res = evaluateMainnetBroadcastGate({
        ...defaultValidContext,
        amount: 15000,
        nativeBalance: 20000,
        kycApproved: true,
        adminReviewApproved: true,
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe('8. Chain Confirmation & Finality Policies', () => {
    it('defines standard confirmation policies for all 6 mainnet chains', () => {
      expect(MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.ETHEREUM].standardConfirmations).toBe(
        12,
      );
      expect(
        MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.BNB_SMART_CHAIN].standardConfirmations,
      ).toBe(15);
      expect(MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.POLYGON].standardConfirmations).toBe(
        32,
      );
      expect(MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.SOLANA].standardConfirmations).toBe(
        32,
      );
      expect(MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.BITCOIN].standardConfirmations).toBe(
        3,
      );
      expect(MAINNET_CHAIN_CONFIRMATION_POLICIES[ChainNetwork.TRON].standardConfirmations).toBe(19);
    });
  });
});
