import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignNetSheetDto {
  @IsOptional()
  @IsString()
  assignedToUid?: string | null;
}

export class ReviewNetSheetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}

export class RejectNetSheetDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

