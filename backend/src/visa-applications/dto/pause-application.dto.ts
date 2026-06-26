import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Payload for `PATCH /applications/:id/pause`. */
export class PauseApplicationDto {
  /** Optional reason for pausing (e.g. "Waiting for consulate response"). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
