import { createApplication } from './application';

async function bootstrap() {
  const app = await createApplication();
  const port = Number(process.env.PORT ?? 3333);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser uma porta TCP válida.');
  }
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');

  console.log(
    `SorteX API iniciada na porta ${port} (${process.env.NODE_ENV ?? 'development'}).`,
  );
}

void bootstrap();
