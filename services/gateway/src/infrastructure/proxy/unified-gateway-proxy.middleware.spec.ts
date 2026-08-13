import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { loadEnv } from '../../config/env.schema';
import { createUnifiedGatewayProxyMiddleware } from './unified-gateway-proxy.middleware';
import { createNftGoneMiddleware } from './nft-gone.middleware';

/**
 * Regression: many createProxyMiddleware() instances each register server.on('close')
 * on the first request → MaxListenersExceededWarning (11 > 10).
 */
describe('gateway proxy close listeners', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['SERVICE_NAME'] = 'gateway';
    process.env['PORT'] = '4010';
    process.env['OTEL_ENABLED'] = 'false';
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'silent';
    process.env['CORS_ORIGINS'] = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const env = loadEnv(process.env);
    app.use(createNftGoneMiddleware());
    app.use(createUnifiedGatewayProxyMiddleware(env));
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps server close listeners at or below default max after /health', async () => {
    const warnings: string[] = [];
    const onWarning = (warning: Error) => {
      warnings.push(warning.name + ': ' + warning.message);
    };
    process.on('warning', onWarning);

    await request(app.getHttpServer()).get('/health').expect(200);

    const server = app.getHttpServer() as Server;
    const closeListeners = server.listenerCount('close');

    process.off('warning', onWarning);

    expect(closeListeners).toBeLessThanOrEqual(10);
    expect(warnings.some((w) => /MaxListenersExceededWarning/i.test(w))).toBe(false);
  });
});
