import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Payload for `PATCH /applications/:id/resume`. */
export class ResumeApplicationDto {
  /** Optional note stored on the audit-log entry for this resumption. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
