import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequireAuth } from '../firebase/require-auth';
import { FirestoreDomainService } from '../domain/firestore-domain.service';
import { AssignNetSheetDto, RejectNetSheetDto, ReviewNetSheetDto } from './workflow.dto';

@Controller('netsheets')
export class NetSheetWorkflowController {
  constructor(private readonly domain: FirestoreDomainService) {}

  @Post(':id/submit-review')
  @RequireAuth()
  async submitReview(@Req() req: Request & { auth?: { companyId: string } }, @Param('id') id: string) {
    const companyId = req.auth?.companyId ?? 'default';
    const res = await this.domain.submitForReview(companyId, id);
    if (res === null) throw new NotFoundException('Net sheet not found');
    if (res === 'invalid') throw new BadRequestException('Invalid transition for current status');
    return res;
  }

  @Post(':id/assign')
  @RequireAuth()
  async assign(
    @Req() req: Request & { auth?: { companyId: string } },
    @Param('id') id: string,
    @Body() dto: AssignNetSheetDto,
  ) {
    const companyId = req.auth?.companyId ?? 'default';
    const assignedToUid =
      dto.assignedToUid === undefined || dto.assignedToUid === null || dto.assignedToUid === ''
        ? null
        : dto.assignedToUid;
    const res = await this.domain.assign(companyId, id, assignedToUid);
    if (res === null) throw new NotFoundException('Net sheet not found');
    return res;
  }

  @Post(':id/approve')
  @RequireAuth()
  async approve(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('id') id: string,
    @Body() dto: ReviewNetSheetDto,
  ) {
    const companyId = req.auth?.companyId ?? 'default';
    const reviewerUid = (req.auth as any)?.uid ?? 'unknown';
    const res = await this.domain.approve(companyId, id, reviewerUid, dto.note ?? null);
    if (res === null) throw new NotFoundException('Net sheet not found');
    if (res === 'invalid') throw new BadRequestException('Invalid transition for current status');
    return res;
  }

  @Post(':id/reject')
  @RequireAuth()
  async reject(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('id') id: string,
    @Body() dto: RejectNetSheetDto,
  ) {
    const companyId = req.auth?.companyId ?? 'default';
    const reviewerUid = (req.auth as any)?.uid ?? 'unknown';
    const res = await this.domain.reject(companyId, id, reviewerUid, dto.note);
    if (res === null) throw new NotFoundException('Net sheet not found');
    if (res === 'invalid') throw new BadRequestException('Invalid transition for current status');
    return res;
  }

  @Post(':id/finalize')
  @RequireAuth()
  async finalize(
    @Req() req: Request & { auth?: { companyId: string; uid?: string } },
    @Param('id') id: string,
  ) {
    const companyId = req.auth?.companyId ?? 'default';
    const uid = (req.auth as any)?.uid ?? 'unknown';
    const res = await this.domain.finalize(companyId, id, uid);
    if (res === null) throw new NotFoundException('Net sheet not found');
    if (res === 'invalid') throw new BadRequestException('Invalid transition for current status');
    return res;
  }
}

