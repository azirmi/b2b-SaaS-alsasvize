import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { AdminService } from './admin.service';

// Every route requires a valid JWT cookie AND the ADMIN role.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Business analytics: sales/doc split pipeline + productivity charts (SEC excluded). */
  @Get('stats')
  @Roles(Role.ADMIN)
  getStats() {
    return this.adminService.getStats();
  }

  /** SLA/compliance tracking table for Sales->DOC queue delays. */
  @Get('compliance')
  @Roles(Role.ADMIN)
  getCompliance() {
    return this.adminService.getCompliance();
  }

  /** Finance dashboard: timeframe metrics and remaining prepaid balances. */
  @Get('finance')
  @Roles(Role.ADMIN)
  getFinance() {
    return this.adminService.getFinance();
  }

  /** Master table for admin operations with sortable/filterable flat row data. */
  @Get('master-table')
  @Roles(Role.ADMIN)
  getMasterTable() {
    return this.adminService.getMasterTable();
  }
}
