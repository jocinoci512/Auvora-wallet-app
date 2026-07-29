import { ChainNetwork } from '@auvora/database';
import { RoutingEngineService } from './routing-engine.service';

describe('RoutingEngineService', () => {
  it('returns bitcoin architecture stub', async () => {
    const registry = {
      getRoutes: jest.fn(),
      getQuote: jest.fn(),
    };
    const service = new RoutingEngineService(registry as never, registry as never);
    const result = await service.compareRoutes({
      network: ChainNetwork.BITCOIN,
      sellToken: 'BTC',
      buyToken: 'USDT',
      sellAmount: '1',
      slippageBps: 50,
    });
    expect(result.supported).toBe(false);
    expect(result.architecture).toBe('future_otc_or_bridge');
  });
});
