import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Payload for `PATCH /applications/:id/stage`. */
export class TransitionStageDto {
  /** Optional note stored on the audit-log entry for this transition. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
