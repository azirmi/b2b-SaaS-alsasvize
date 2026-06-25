import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /** Admin SLA dashboard — applications stuck past the SLA threshold. */
  @Get('sla-breaches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  slaBreaches() {
    return this.auditLogsService.getSlaBreaches();
  }

  /**
   * Read audit logs. Any authenticated user may call it; the service scopes
   * results (admin = all, staff = their assigned applications, others = none).
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditLogsService.findAll(query, user);
  }
}
