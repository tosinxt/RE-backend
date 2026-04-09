import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';
export declare class PdfController {
    private readonly ocrService;
    private readonly config;
    private readonly logger;
    constructor(ocrService: OcrService, config: ConfigService);
    parsePdf(file?: Express.Multer.File): Promise<{
        source: "embedded-text";
        text: string;
        totalPages: number;
    } | {
        source: "none";
        text: string;
        totalPages: number;
    } | {
        source: "ocr";
        text: string;
        totalPages: number;
    }>;
}
