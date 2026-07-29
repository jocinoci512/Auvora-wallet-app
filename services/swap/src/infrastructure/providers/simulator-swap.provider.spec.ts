import { ChainNetwork } from '@auvora/database';
import { SimulatorSwapProvider } from './simulator-swap.provider';

describe('SimulatorSwapProvider', () => {
  const provider = new SimulatorSwapProvider();

  it('quotes ethereum native to usdc', async () => {
    const quote = await provider.getQuote({
      network: ChainNetwork.ETHEREUM,
      sellToken: 'ETH',
      buyToken: 'USDC',
      sellAmount: '1',
      slippageBps: 50,
    });
    expect(Number(quote.amountOut)).toBeGreaterThan(0);
    expect(quote.minAmountOut).toBeTruthy();
    expect(quote.supportsSimulation).toBe(true);
  });

  it('rejects bitcoin direct swaps', async () => {
    await expect(
      provider.getQuote({
        network: ChainNetwork.BITCOIN,
        sellToken: 'BTC',
        buyToken: 'USDT',
        sellAmount: '1',
        slippageBps: 50,
      }),
    ).rejects.toThrow(/Bitcoin/i);
  });

  it('builds and tracks execution', async () => {
    const quote = await provider.getQuote({
      network: ChainNetwork.SOLANA,
      sellToken: 'SOL',
      buyToken: 'USDC',
      sellAmount: '2',
      slippageBps: 30,
    });
    const tx = await provider.buildTransaction({
      network: ChainNetwork.SOLANA,
      sellToken: 'SOL',
      buyToken: 'USDC',
      sellAmount: '2',
      slippageBps: 30,
      providerQuoteId: quote.providerQuoteId,
    });
    expect(tx.simulationOk).toBe(true);
    const status = await provider.getExecutionStatus(quote.providerQuoteId);
    expect(status.status).toBe('COMPLETED');
  });
});
