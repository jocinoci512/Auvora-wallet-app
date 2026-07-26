import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('notifications health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['SERVICE_NAME'] = 'notifications';
    process.env['PORT'] = '3006';
    process.env['OTEL_ENABLED'] = 'false';
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'silent';
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/auvora_test';
    process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    process.env['JWT_ACCESS_SECRET'] = process.env['JWT_ACCESS_SECRET'] ?? 'a'.repeat(32);
    process.env['CSRF_SECRET'] = process.env['CSRF_SECRET'] ?? 'b'.repeat(32);
    process.env['INTERNAL_API_KEY'] = process.env['INTERNAL_API_KEY'] ?? 'c'.repeat(32);
    process.env['NOTIFICATIONS_FIELD_ENCRYPTION_KEY'] =
      process.env['NOTIFICATIONS_FIELD_ENCRYPTION_KEY'] ?? 'd'.repeat(32);

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
      service: 'notifications',
    });
  });
});
