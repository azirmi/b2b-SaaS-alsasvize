import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Payload for `PATCH /documents/:id/reject`. */
export class RejectDocumentDto {
  /** Why the file was rejected — surfaced to the customer so they can re-upload. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
