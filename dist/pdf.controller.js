"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PdfController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const platform_express_1 = require("@nestjs/platform-express");
const pdf_parse_1 = require("pdf-parse");
const ocr_service_1 = require("./ocr.service");
let PdfController = PdfController_1 = class PdfController {
    ocrService;
    config;
    logger = new common_1.Logger(PdfController_1.name);
    constructor(ocrService, config) {
        this.ocrService = ocrService;
        this.config = config;
    }
    async parsePdf(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const forceVision = this.config.get('PDF_USE_VISION_ONLY') === 'true';
        this.logger.log(`parsePdf: forceVision=${forceVision} filename=${file.originalname}`);
        const parser = new pdf_parse_1.PDFParse({ data: file.buffer });
        const textResult = await parser.getText();
        const useEmbeddedText = !forceVision &&
            !!textResult.text &&
            textResult.text.trim().length > 50;
        if (useEmbeddedText) {
            this.logger.log(`parsePdf: using embedded text (len=${textResult.text.trim().length})`);
            await parser.destroy();
            return {
                source: 'embedded-text',
                text: textResult.text,
                totalPages: textResult.total,
            };
        }
        this.logger.log('parsePdf: using OCR fallback (Google Vision)');
        let screenshotResult;
        try {
            screenshotResult = await parser.getScreenshot({
                first: 10,
            });
        }
        catch (err) {
            await parser.destroy().catch(() => undefined);
            this.logger.error({ err }, 'PDF screenshot failed');
            throw new common_1.InternalServerErrorException('Could not rasterize PDF for OCR. Try a different PDF or enable embedded text.');
        }
        await parser.destroy();
        const pageImages = screenshotResult.pages?.map((p) => p.data).filter(Boolean) ??
            [];
        if (!pageImages.length) {
            return {
                source: 'none',
                text: '',
                totalPages: textResult.total ?? 0,
            };
        }
        try {
            const ocrText = await this.ocrService.extractTextFromImageBuffers(pageImages);
            return {
                source: 'ocr',
                text: ocrText,
                totalPages: textResult.total,
            };
        }
        catch (err) {
            this.logger.error({ err }, 'Google Vision OCR failed');
            const message = err instanceof Error ? err.message : 'Unknown Vision API error';
            throw new common_1.InternalServerErrorException(`Google Vision OCR failed: ${message}. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with Vision API enabled.`);
        }
    }
};
exports.PdfController = PdfController;
__decorate([
    (0, common_1.Post)('parse'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PdfController.prototype, "parsePdf", null);
exports.PdfController = PdfController = PdfController_1 = __decorate([
    (0, common_1.Controller)('pdf'),
    __metadata("design:paramtypes", [ocr_service_1.OcrService,
        config_1.ConfigService])
], PdfController);
//# sourceMappingURL=pdf.controller.js.map