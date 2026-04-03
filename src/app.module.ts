import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfController } from './pdf.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.LOG_PRETTY !== 'false'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: false,
                  messageFormat:
                    '{req.method} {req.url} -> {res.statusCode} ({responseTime}ms)',
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            '*.password',
            'token',
            '*.token',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
  ],
  controllers: [AppController, PdfController],
  providers: [AppService],
})
export class AppModule {}
