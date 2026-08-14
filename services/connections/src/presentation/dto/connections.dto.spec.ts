import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChainNetwork } from '@auvora/database';
import {
  ApproveSessionDto,
  CreateDappConnectionRequestDto,
  CreateWcSessionDto,
  PairDeviceDto,
  PrepareSignDto,
  VerifyOwnershipChallengeDto,
} from './connections.dto';

async function errorsFor<T extends object>(cls: new () => T, payload: unknown): Promise<string[]> {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

const UUID = '11111111-1111-4111-8111-111111111111';

describe('connections DTO input bounds', () => {
  it('PairDeviceDto: accepts valid, rejects oversized deviceId', async () => {
    expect(await errorsFor(PairDeviceDto, { deviceId: 'ledger-1' })).toHaveLength(0);
    expect(await errorsFor(PairDeviceDto, { deviceId: 'x'.repeat(201) })).toContain('maxLength');
    expect(await errorsFor(PairDeviceDto, { deviceId: 'ab' })).toContain('minLength');
  });

  it('CreateWcSessionDto: enforces array + string bounds', async () => {
    expect(await errorsFor(CreateWcSessionDto, { networks: [ChainNetwork.ETHEREUM] })).toHaveLength(
      0,
    );
    // too many networks
    expect(
      await errorsFor(CreateWcSessionDto, {
        networks: Array.from({ length: 21 }, () => ChainNetwork.ETHEREUM),
      }),
    ).toContain('arrayMaxSize');
    // too many permissions
    expect(
      await errorsFor(CreateWcSessionDto, {
        networks: [ChainNetwork.ETHEREUM],
        permissions: Array.from({ length: 51 }, (_, i) => `p${i}`),
      }),
    ).toContain('arrayMaxSize');
    // oversized permission string
    expect(
      await errorsFor(CreateWcSessionDto, {
        networks: [ChainNetwork.ETHEREUM],
        permissions: ['x'.repeat(101)],
      }),
    ).toContain('maxLength');
  });

  it('ApproveSessionDto: bounds account arrays and strings', async () => {
    expect(await errorsFor(ApproveSessionDto, { accounts: ['0xabc'] })).toHaveLength(0);
    expect(
      await errorsFor(ApproveSessionDto, {
        accounts: Array.from({ length: 51 }, (_, i) => `0x${i}`),
      }),
    ).toContain('arrayMaxSize');
    expect(await errorsFor(ApproveSessionDto, { accounts: ['x'.repeat(201)] })).toContain(
      'maxLength',
    );
  });

  it('VerifyOwnershipChallengeDto: challengeId must be a UUID', async () => {
    expect(
      await errorsFor(VerifyOwnershipChallengeDto, {
        challengeId: UUID,
        signature: 'a'.repeat(90),
      }),
    ).toHaveLength(0);
    // non-UUID challengeId rejected
    expect(
      await errorsFor(VerifyOwnershipChallengeDto, {
        challengeId: 'not-a-uuid',
        signature: 'a'.repeat(90),
      }),
    ).toContain('isUuid');
    // oversized signature rejected
    expect(
      await errorsFor(VerifyOwnershipChallengeDto, {
        challengeId: UUID,
        signature: 'a'.repeat(2001),
      }),
    ).toContain('maxLength');
  });

  it('PrepareSignDto: bounds connectionRef and payload', async () => {
    expect(
      await errorsFor(PrepareSignDto, {
        kind: 'HARDWARE',
        connectionRef: 'ledger-1',
        network: ChainNetwork.ETHEREUM,
        payloadType: 'MESSAGE',
        payload: 'hello',
      }),
    ).toHaveLength(0);
    expect(
      await errorsFor(PrepareSignDto, {
        kind: 'HARDWARE',
        connectionRef: 'x'.repeat(201),
        network: ChainNetwork.ETHEREUM,
        payloadType: 'MESSAGE',
        payload: 'hello',
      }),
    ).toContain('maxLength');
    expect(
      await errorsFor(PrepareSignDto, {
        kind: 'HARDWARE',
        connectionRef: 'ledger-1',
        network: ChainNetwork.ETHEREUM,
        payloadType: 'MESSAGE',
        payload: 'x'.repeat(100_001),
      }),
    ).toContain('maxLength');
  });

  it('CreateDappConnectionRequestDto: bounds name/origin/permission arrays', async () => {
    expect(
      await errorsFor(CreateDappConnectionRequestDto, {
        origin: 'https://app.uniswap.org',
        name: 'Uniswap',
        networks: [ChainNetwork.ETHEREUM],
        permissions: ['VIEW_ADDRESSES'],
      }),
    ).toHaveLength(0);
    expect(
      await errorsFor(CreateDappConnectionRequestDto, {
        origin: 'https://app.uniswap.org',
        name: 'x'.repeat(121),
        networks: [ChainNetwork.ETHEREUM],
        permissions: ['VIEW_ADDRESSES'],
      }),
    ).toContain('maxLength');
    expect(
      await errorsFor(CreateDappConnectionRequestDto, {
        origin: `https://${'a'.repeat(2048)}.com`,
        name: 'Uniswap',
        networks: [ChainNetwork.ETHEREUM],
        permissions: ['VIEW_ADDRESSES'],
      }),
    ).toContain('maxLength');
  });
});
