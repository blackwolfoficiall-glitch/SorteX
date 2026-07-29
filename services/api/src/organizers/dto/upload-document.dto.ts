import { OrganizerDocumentType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UploadDocumentDto {
  @IsEnum(OrganizerDocumentType)
  type: OrganizerDocumentType;
}
