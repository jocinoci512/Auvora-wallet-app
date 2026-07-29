import { SimulatorConnectionProvider } from './simulator-connection.provider';

describe('connections failure recovery', () => {
  const provider = new SimulatorConnectionProvider();

  it('returns rejected when user does not confirm', async () => {
    const prepared = await provider.prepareSign({
      kind: 'HARDWARE',
      connectionRef: 'dev',
      network: 'ETHEREUM' as never,
      payloadType: 'MESSAGE',
      payload: 'msg',
    });
    const result = await provider.completeSign(prepared.requestId, false);
    expect(result.status).toBe('REJECTED');
  });

  it('throws for unknown device', async () => {
    await expect(provider.pairDevice('missing')).rejects.toMatchObject({
      code: 'CONNECTIONS_NOT_FOUND',
    });
  });
});
