import { IsEnum, IsUUID } from 'class-validator';
import { Department } from '../../generated/prisma/enums';

/** Payload for `PATCH /applications/:id/reassign` (admin God-Mode). */
export class ReassignApplicationDto {
  @IsUUID()
  newStaffId: string;

  @IsEnum(Department)
  department: Department;
}
