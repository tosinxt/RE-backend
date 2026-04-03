import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TextResult } from 'pdf-parse';
import { PDFParse } from 'pdf-parse';

@Controller('pdf')
export class PdfController {
  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parsePdf(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const parser = new PDFParse({ data: file.buffer });
    const data: TextResult = await parser.getText();
    await parser.destroy();

    return {
      text: data.text,
      totalPages: data.total,
    };
  }
}

