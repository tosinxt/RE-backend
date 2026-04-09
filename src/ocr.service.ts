import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly client = new ImageAnnotatorClient();

  async extractTextFromImageBuffers(buffers: Buffer[]): Promise<string> {
    const texts: string[] = [];

    for (const buffer of buffers) {
      const [result] = await this.client.documentTextDetection({
        image: { content: buffer },
      });

      const fullText = result.fullTextAnnotation?.text;
      const fromBlocks =
        !fullText && result.textAnnotations?.length
          ? result.textAnnotations[0]?.description
          : undefined;
      const pageText = fullText ?? fromBlocks;

      if (pageText) {
        texts.push(pageText);
      }
    }

    const combined = texts.join('\n\n');

    if (!combined.trim()) {
      this.logger.warn('OCR returned empty result for provided images');
    }

    return combined;
  }
}

