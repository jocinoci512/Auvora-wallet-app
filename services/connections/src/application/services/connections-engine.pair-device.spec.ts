import { ConnectionsEngineService } from './connections-engine.service';

/**
 * Cross-user protection for hardware device pairing (IDOR).
 *
 * `hardwareDevice.deviceId` is globally unique, so without an ownership check a
 * second user pairing the same deviceId would mutate the first user's device
 * row. These tests prove ownership is enforced at the service/DB-query level.
 */
function build(existingOwnerUserId: string | null) {
  const paired = {
    deviceId: 'ledger-1',
    vendor: 'Ledger',
    model: 'Nano X',
    transport: 'USB',
    firmwareVersion: '2.0',
    firmwareCompatible: true,
    status: 'CONNECTED',
    accounts: [],
  };
  const providers = {
    code: 'sim',
    pairDevice: jest.fn().mockResolvedValue(paired),
    disconnectDevice: jest.fn().mockResolvedValue(undefined),
  };
  const hardwareDevice = {
    findUnique: jest
      .fn()
      .mockResolvedValue(existingOwnerUserId ? { userId: existingOwnerUserId } : null),
    upsert: jest.fn().mockResolvedValue({ id: 'dev-row-1', deviceId: paired.deviceId }),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma = {
    hardwareDevice,
    externalWalletConnection: {
      create: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const clock = { now: () => new Date() };
  const ids = { uuid: () => 'uuid-1' };
  const crypto = { encrypt: (s: string) => s, decrypt: (s: string) => s };
  const analytics = { publishEvent: jest.fn() };
  const notifications = { publishEvent: jest.fn() };
  const ai = { publishEvent: jest.fn() };
  const env = { CONNECTIONS_SIGN_TIMEOUT_SECONDS: 120 } as never;
  const engine = new ConnectionsEngineService(
    env,
    prisma as never,
    providers as never,
    clock as never,
    ids as never,
    crypto as never,
    analytics as never,
    notifications as never,
    ai as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { engine, prisma, hardwareDevice };
}

describe('ConnectionsEngineService.pairDevice cross-user protection', () => {
  it('User A can pair a device not owned by anyone else', async () => {
    const { engine, hardwareDevice, prisma } = build(null);
    await expect(engine.pairDevice('user-A', 'ledger-1')).resolves.toBeTruthy();
    // ownership checked at the DB query level before any mutation
    expect(hardwareDevice.findUnique).toHaveBeenCalledWith({
      where: { deviceId: 'ledger-1' },
      select: { userId: true },
    });
    expect(hardwareDevice.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.externalWalletConnection.create).toHaveBeenCalledTimes(1);
  });

  it('User A re-pairing their own device is allowed', async () => {
    const { engine, hardwareDevice } = build('user-A');
    await expect(engine.pairDevice('user-A', 'ledger-1')).resolves.toBeTruthy();
    expect(hardwareDevice.upsert).toHaveBeenCalledTimes(1);
  });

  it("User B cannot pair/claim/mutate User A's device (no upsert, safe error)", async () => {
    const { engine, hardwareDevice, prisma } = build('user-A');
    await expect(engine.pairDevice('user-B', 'ledger-1')).rejects.toThrow(/another account/i);
    // No mutation happened → cannot overwrite A's row
    expect(hardwareDevice.upsert).not.toHaveBeenCalled();
    expect(prisma.externalWalletConnection.create).not.toHaveBeenCalled();
  });

  it('disconnectDevice enforces ownership at the DB query (User B cannot touch A device)', async () => {
    const { engine, hardwareDevice } = build('user-A');
    hardwareDevice.findFirst.mockResolvedValue(null); // no row for {userId: user-B, deviceId}
    await expect(engine.disconnectDevice('user-B', 'ledger-1')).rejects.toThrow(/not found/i);
    expect(hardwareDevice.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-B', deviceId: 'ledger-1' },
    });
    expect(hardwareDevice.update).not.toHaveBeenCalled();
  });

  it('listDevices is scoped to the authenticated user', async () => {
    const { engine, hardwareDevice } = build(null);
    await engine.listDevices('user-A');
    expect(hardwareDevice.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
      orderBy: { updatedAt: 'desc' },
    });
  });
});
