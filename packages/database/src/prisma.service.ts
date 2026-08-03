import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@auvora/database-schema';

const DEFAULT_CONNECT_ATTEMPTS = 8;
const DEFAULT_CONNECT_BASE_DELAY_MS = 500;
const DEFAULT_CONNECT_MAX_DELAY_MS = 8_000;

/**
 * Bounded exponential backoff for Prisma connect (Postgres may lag container start on Railway).
 * Does not retry forever — fails after attempts so crash loops remain observable.
 */
export async function connectPrismaWithRetry(
  client: { $connect(): Promise<void> },
  options: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {},
): Promise<void> {
  const attempts = options.attempts ?? DEFAULT_CONNECT_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_CONNECT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_CONNECT_MAX_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await client.$connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) {
        break;
      }
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Prisma $connect failed after ${attempts} attempts`);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await connectPrismaWithRetry(this);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
