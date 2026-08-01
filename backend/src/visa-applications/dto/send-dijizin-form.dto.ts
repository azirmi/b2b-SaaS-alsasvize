import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /applications/:id/dijizin/forms */
export class SendDijizinFormDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  formId!: string;
}
