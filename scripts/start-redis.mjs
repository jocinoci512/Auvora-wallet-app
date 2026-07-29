import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RedisMemoryServer } = require('redis-memory-server');

const redis = new RedisMemoryServer({
  instance: {
    port: 6379,
  },
});

const host = await redis.getHost();
const port = await redis.getPort();
process.stdout.write(
  JSON.stringify({ level: 'info', msg: 'redis ready', redisUrl: `redis://${host}:${port}` }) + '\n',
);

process.on('SIGINT', async () => {
  await redis.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await redis.stop();
  process.exit(0);
});

await new Promise(() => undefined);
