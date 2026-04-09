import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DocumentType } from './netsheet.types';

export class ExtractNetSheetDto {
  @IsIn(['contract', 'settlement_statement'] satisfies DocumentType[])
  documentType!: DocumentType;

  // Raw extracted text from PDF parse endpoint (embedded or OCR)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200_000)
  text!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

