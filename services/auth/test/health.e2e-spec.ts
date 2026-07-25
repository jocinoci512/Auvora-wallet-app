import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('auth health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['PORT'] = '4001';
    process.env['SERVICE_NAME'] = 'auth';
    process.env['OTEL_ENABLED'] = 'false';
    process.env['LOG_LEVEL'] = 'silent';
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://test:test@localhost:5432/auvora_test';
    process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-minimum-32-characters-long';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-minimum-32-characters-long';
    process.env['CSRF_SECRET'] = 'test-csrf-secret-minimum-32-characters-long';
    process.env['APP_PUBLIC_URL'] = 'http://localhost:3000';

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
      service: 'auth',
    });
  });
});
