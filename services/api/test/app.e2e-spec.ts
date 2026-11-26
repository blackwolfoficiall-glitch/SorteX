import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        authSession: { findFirst: jest.fn() },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      nome: 'SorteX API',
      versao: '1.0.0',
      status: 'online',
      mensagem: 'Bem-vindo à API oficial da SorteX 🚀',
    });
  });

  it('aplica o limite de saúde mesmo com o middleware montado na rota curinga', async () => {
    await request(app.getHttpServer())
      .get('/health/live?from=qa')
      .expect(200)
      .expect('RateLimit-Limit', '120');
  });

  afterEach(async () => {
    await app.close();
  });
});
