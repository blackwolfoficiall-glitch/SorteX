import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the API status', () => {
      expect(appController.getHello()).toEqual({
        nome: 'SorteX API',
        versao: '1.0.0',
        status: 'online',
        mensagem: 'Bem-vindo à API oficial da SorteX 🚀',
      });
    });
  });
});
