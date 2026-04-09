import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TextResult } from 'pdf-parse';
import { PDFParse } from 'pdf-parse';
import { OcrService } from './ocr.service';

@Controller('pdf')
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    private readonly ocrService: OcrService,
    private readonly config: ConfigService,
  ) {}

  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parsePdf(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const forceVision =
      this.config.get<string>('PDF_USE_VISION_ONLY') === 'true';
    this.logger.log(
      `parsePdf: forceVision=${forceVision} filename=${file.originalname}`,
    );

    const parser = new PDFParse({ data: file.buffer });
    const textResult: TextResult = await parser.getText();

    const useEmbeddedText =
      !forceVision &&
      !!textResult.text &&
      textResult.text.trim().length > 50;

    if (useEmbeddedText) {
      this.logger.log(
        `parsePdf: using embedded text (len=${textResult.text.trim().length})`,
      );
      await parser.destroy();
      return {
        source: 'embedded-text' as const,
        text: textResult.text,
        totalPages: textResult.total,
      };
    }

    // Render page images and run OCR via Google Cloud Vision.
    this.logger.log('parsePdf: using OCR fallback (Google Vision)');
    let screenshotResult;
    try {
      screenshotResult = await parser.getScreenshot({
        first: 10,
      });
    } catch (err) {
      await parser.destroy().catch(() => undefined);
      this.logger.error({ err }, 'PDF screenshot failed');
      throw new InternalServerErrorException(
        'Could not rasterize PDF for OCR. Try a different PDF or enable embedded text.',
      );
    }

    await parser.destroy();

    const pageImages: Buffer[] =
      screenshotResult.pages?.map((p: { data?: Buffer }) => p.data).filter(Boolean) ??
      [];

    if (!pageImages.length) {
      return {
        source: 'none' as const,
        text: '',
        totalPages: textResult.total ?? 0,
      };
    }

    try {
      const ocrText = await this.ocrService.extractTextFromImageBuffers(
        pageImages,
      );
      return {
        source: 'ocr' as const,
        text: ocrText,
        totalPages: textResult.total,
      };
    } catch (err) {
      this.logger.error({ err }, 'Google Vision OCR failed');
      const message =
        err instanceof Error ? err.message : 'Unknown Vision API error';
      throw new InternalServerErrorException(
        `Google Vision OCR failed: ${message}. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with Vision API enabled.`,
      );
    }
  }
}

