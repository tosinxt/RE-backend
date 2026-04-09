import { Body, Controller, Post } from '@nestjs/common';
import { ExtractNetSheetDto } from './netsheet.dto';
import { NetSheetService } from './netsheet.service';

@Controller('netsheet')
export class NetSheetController {
  constructor(private readonly netSheet: NetSheetService) {}

  @Post('extract')
  async extract(@Body() dto: ExtractNetSheetDto) {
    const { extract, computed } = await this.netSheet.extractFromText({
      documentType: dto.documentType,
      text: dto.text,
      fileName: dto.fileName,
    });

    return {
      extract,
      computed,
    };
  }
}

