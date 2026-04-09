"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_pino_1 = require("nestjs-pino");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const pdf_controller_1 = require("./pdf.controller");
const ocr_service_1 = require("./ocr.service");
const netsheet_controller_1 = require("./netsheet/netsheet.controller");
const netsheet_service_1 = require("./netsheet/netsheet.service");
const workflow_controller_1 = require("./netsheet/workflow.controller");
const json_store_service_1 = require("./store/json-store.service");
const domain_service_1 = require("./domain/domain.service");
const domain_controller_1 = require("./domain/domain.controller");
const firebase_admin_service_1 = require("./firebase/firebase-admin.service");
const firestore_domain_service_1 = require("./domain/firestore-domain.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    level: process.env.LOG_LEVEL || 'info',
                    transport: process.env.LOG_PRETTY !== 'false'
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
            app_controller_1.AppController,
            pdf_controller_1.PdfController,
            netsheet_controller_1.NetSheetController,
            workflow_controller_1.NetSheetWorkflowController,
            domain_controller_1.DomainController,
        ],
        providers: [
            app_service_1.AppService,
            ocr_service_1.OcrService,
            netsheet_service_1.NetSheetService,
            json_store_service_1.JsonStoreService,
            domain_service_1.DomainService,
            firebase_admin_service_1.FirebaseAdminService,
            firestore_domain_service_1.FirestoreDomainService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map