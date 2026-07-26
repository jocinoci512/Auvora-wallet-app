import { Inject, Injectable } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import type { SimulatorLedgerPort } from '../../application/ports/simulator-ledger.port';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

@Injectable()
export class SimulatorLedgerAdapter implements SimulatorLedgerPort {
  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  private balanceKey(chain: ChainNetwork, address: string): string {
    return `chain:balance:${chain}:${address}`;
  }

  private heightKey(chain: ChainNetwork): string {
    return `chain:height:${chain}`;
  }

  private mempoolKey(chain: ChainNetwork): string {
    return `chain:mempool:${chain}`;
  }

  private watchKey(chain: ChainNetwork): string {
    return `chain:watch:${chain}`;
  }

  async getBalance(chain: ChainNetwork, address: string): Promise<string> {
    const raw = await this.redis.getClient().get(this.balanceKey(chain, address));
    return raw ?? '0';
  }

  async credit(chain: ChainNetwork, address: string, amount: string): Promise<string> {
    return this.redis.getClient().incrbyfloat(this.balanceKey(chain, address), Number(amount));
  }

  async debit(chain: ChainNetwork, address: string, amount: string): Promise<string> {
    return this.redis.getClient().incrbyfloat(this.balanceKey(chain, address), -Number(amount));
  }

  async getBlockHeight(chain: ChainNetwork): Promise<bigint> {
    const key = this.heightKey(chain);
    const existing = await this.redis.getClient().get(key);
    if (existing) {
      return BigInt(existing);
    }
    await this.redis.getClient().set(key, '1', 'NX');
    const seeded = await this.redis.getClient().get(key);
    return BigInt(seeded ?? '1');
  }

  async advanceBlockHeight(chain: ChainNetwork, by = 1n): Promise<bigint> {
    await this.getBlockHeight(chain);
    const next = await this.redis.getClient().incrby(this.heightKey(chain), Number(by));
    return BigInt(next);
  }

  async addToMempool(chain: ChainNetwork, txHash: string): Promise<void> {
    await this.redis.getClient().sadd(this.mempoolKey(chain), txHash);
  }

  async removeFromMempool(chain: ChainNetwork, txHash: string): Promise<void> {
    await this.redis.getClient().srem(this.mempoolKey(chain), txHash);
  }

  async listMempool(chain: ChainNetwork): Promise<string[]> {
    return this.redis.getClient().smembers(this.mempoolKey(chain));
  }

  async watchAddress(chain: ChainNetwork, address: string): Promise<void> {
    await this.redis.getClient().sadd(this.watchKey(chain), address);
  }

  async isWatched(chain: ChainNetwork, address: string): Promise<boolean> {
    const result = await this.redis.getClient().sismember(this.watchKey(chain), address);
    return result === 1;
  }
}
