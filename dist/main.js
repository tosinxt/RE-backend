"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization',
    });
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
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
    }).catch(() => { });
}
bootstrap();
//# sourceMappingURL=main.js.map