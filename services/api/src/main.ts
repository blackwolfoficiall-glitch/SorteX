import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SafeExceptionFilter } from './infrastructure/http-exception.filter';
import { RequestLoggingInterceptor } from './infrastructure/request-logging.interceptor';
import { EnvironmentService } from './infrastructure/environment.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const environment = app.get(EnvironmentService);
  environment.validate();
  app.use(
    json({
      limit: process.env.MAX_JSON_BODY_SIZE || '1mb',
      verify: (req: any, _res, buffer) => {
        req.rawBody = buffer;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: false,
      limit: process.env.MAX_FORM_BODY_SIZE || '256kb',
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin(origin, callback) {
      if (!origin || environment.allowedOrigins().includes(origin))
        return callback(null, true);
      return callback(new Error('Origem CORS não autorizada.'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Webhook-Signature',
      'X-Hub-Signature-256',
    ],
    maxAge: 600,
  });

  const port = process.env.PORT ?? 3333;
  await app.listen(port, '0.0.0.0');

  console.log(`SorteX API iniciada na porta ${port} (${environment.nodeEnv}).`);
}

void bootstrap();
