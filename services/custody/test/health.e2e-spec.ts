import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('custody health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['SERVICE_NAME'] = 'custody';
    process.env['PORT'] = '3009';
    process.env['OTEL_ENABLED'] = 'false';
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'silent';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'custody',
    });
  });
});
