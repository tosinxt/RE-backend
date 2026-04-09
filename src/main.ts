import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/e1ee6f96-a72f-4f01-bbb0-09da4413e61e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8d6967' },
    body: JSON.stringify({
      sessionId: '8d6967',
      hypothesisId: 'H-listen',
      location: 'main.ts:bootstrap',
      message: 'Nest listen ok',
      data: { port, host: '0.0.0.0' },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}
bootstrap();
