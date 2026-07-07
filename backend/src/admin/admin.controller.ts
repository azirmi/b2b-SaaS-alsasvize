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
}
