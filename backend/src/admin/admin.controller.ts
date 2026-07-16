import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

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

  /** User/team management list: all users with role/status/date fields. */
  @Get('users')
  @Roles(Role.ADMIN)
  getUsers() {
    return this.adminService.getUsers();
  }

  /** Admin-only account creation for staff/customer users. */
  @Post('users')
  @Roles(Role.ADMIN)
  createUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.adminService.createUser(dto, actor);
  }

  /** Hard-delete user with relation cleanup in a single transaction. */
  @Delete('users/:id')
  @Roles(Role.ADMIN)
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.adminService.deleteUser(id, actor);
  }
}
