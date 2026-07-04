import { IsEnum } from 'class-validator';
import { VisaStage } from '../../generated/prisma/enums';

/** Payload for `PATCH /applications/:id/force-stage` (admin God-Mode). */
export class ForceStageDto {
  @IsEnum(VisaStage)
  stage!: VisaStage;
}
