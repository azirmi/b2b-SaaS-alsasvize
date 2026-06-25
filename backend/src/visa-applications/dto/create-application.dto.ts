import { IsOptional, IsUUID } from 'class-validator';

/** Payload for `POST /applications`. */
export class CreateApplicationDto {
  /**
   * The customer the application belongs to.
   * - Required when an ADMIN or SALES agent creates on behalf of a customer.
   * - Ignored for CUSTOMER callers (they always create for themselves).
   */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
