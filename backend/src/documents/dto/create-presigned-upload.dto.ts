import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FileType } from '../../generated/prisma/enums';

/** Payload for `POST /documents/presigned-url`. */
export class CreatePresignedUploadDto {
  @IsUUID()
  applicationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsEnum(FileType)
  fileType: FileType;
}
