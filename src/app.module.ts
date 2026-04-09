import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfController } from './pdf.controller';
import { OcrService } from './ocr.service';
import { NetSheetController } from './netsheet/netsheet.controller';
import { NetSheetService } from './netsheet/netsheet.service';
import { NetSheetWorkflowController } from './netsheet/workflow.controller';
import { JsonStoreService } from './store/json-store.service';
import { DomainService } from './domain/domain.service';
import { DomainController } from './domain/domain.controller';
import { FirebaseAdminService } from './firebase/firebase-admin.service';
import { FirestoreDomainService } from './domain/firestore-domain.service';

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
                },
              }
            : undefined,
      },
    }),
  ],
  controllers: [
    AppController,
    PdfController,
    NetSheetController,
    NetSheetWorkflowController,
    DomainController,
  ],
  providers: [
    AppService,
    OcrService,
    NetSheetService,
    JsonStoreService,
    DomainService,
    FirebaseAdminService,
    FirestoreDomainService,
  ],
})
export class AppModule {}
