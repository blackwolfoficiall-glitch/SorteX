import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      nome: 'SorteX API',
      versao: '1.0.0',
      status: 'online',
      mensagem: 'Bem-vindo à API oficial da SorteX 🚀',
    };
  }
}
