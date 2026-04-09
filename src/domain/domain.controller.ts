import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { DocumentType } from './domain.types';
import { RequireAuth } from '../firebase/require-auth';
import { FirestoreDomainService } from './firestore-domain.service';
import type { Request } from 'express';

class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsIn(['contract', 'settlement_statement'] satisfies DocumentType[])
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  parsedText?: string;
}

class CreateNetSheetDto {
  @IsString()
  @IsNotEmpty()
  templateVersionId!: string;

  @IsArray()
  documentIds!: string[];
}

@Controller()
export class DomainController {
  constructor(private readonly domain: FirestoreDomainService) {}

  @Get('documents')
  @RequireAuth()
  listDocuments(@Req() req: Request & { auth?: { companyId: string; uid?: string } }) {
    return this.domain.listDocuments(req.auth?.companyId ?? 'default');
  }

  @Post('documents')
  @RequireAuth()
  createDocument(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Body() dto: CreateDocumentDto,
  ) {
    return this.domain.createDocument(req.auth?.companyId ?? 'default', {
      fileName: dto.fileName,
      documentType: dto.documentType,
      status: dto.parsedText ? 'parsed' : 'uploaded',
      parsedText: dto.parsedText,
    });
  }

  @Get('templates')
  @RequireAuth()
  listTemplates(@Req() req: Request & { auth?: { companyId: string; uid?: string } }) {
    return this.domain.listTemplates(req.auth?.companyId ?? 'default');
  }

  @Get('templates/:templateId/versions')
  @RequireAuth()
  listTemplateVersions(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('templateId') templateId: string,
  ) {
    return this.domain.listTemplateVersions(req.auth?.companyId ?? 'default', templateId);
  }

  @Post('templates/:templateId/drafts')
  @RequireAuth()
  createDraft(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('templateId') templateId: string,
  ) {
    return this.domain.createTemplateDraftFromPublished(req.auth?.companyId ?? 'default', templateId);
  }

  @Post('template-versions/:versionId/publish')
  @RequireAuth()
  publish(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('versionId') versionId: string,
  ) {
    return this.domain.publishTemplateVersion(req.auth?.companyId ?? 'default', versionId);
  }

  @Get('netsheets')
  @RequireAuth()
  listNetSheets(@Req() req: Request & { auth?: { companyId: string; uid?: string } }) {
    return this.domain.listNetSheets(req.auth?.companyId ?? 'default');
  }

  @Post('netsheets')
  @RequireAuth()
  createNetSheet(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Body() dto: CreateNetSheetDto,
  ) {
    return this.domain.createNetSheet(req.auth?.companyId ?? 'default', {
      templateVersionId: dto.templateVersionId,
      documentIds: dto.documentIds,
    });
  }

  @Get('audit')
  @RequireAuth()
  listAudit(@Req() req: Request & { auth?: { companyId: string; uid?: string } }) {
    return this.domain.listAudit(req.auth?.companyId ?? 'default');
  }
}

