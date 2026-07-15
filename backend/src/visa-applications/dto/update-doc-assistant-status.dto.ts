import { IsEnum } from 'class-validator';
import {
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
} from '../../generated/prisma/enums';

/** PATCH /applications/:id/doc-assistant/status */
export class UpdateDocAssistantStatusDto {
  @IsEnum(DocAssistantDocumentType)
  type!: DocAssistantDocumentType;

  @IsEnum(DocAssistantDocumentStatus)
  status!: DocAssistantDocumentStatus;
}
