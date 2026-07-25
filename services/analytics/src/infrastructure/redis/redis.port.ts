export const REDIS_PORT = Symbol('REDIS_PORT');

export interface RedisPort {
  ping(): Promise<boolean>;
}
