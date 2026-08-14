import type Redis from 'ioredis';

export const REDIS_PORT = Symbol('REDIS_PORT');

export interface RedisPort {
  ping(): Promise<boolean>;
  getClient(): Redis;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Acquire a distributed lock (SET NX PX). Returns true only if acquired. */
  acquireLock(key: string, token: string, ttlMs: number): Promise<boolean>;
  /** Release a lock only if we still own it (token match). */
  releaseLock(key: string, token: string): Promise<void>;
}
