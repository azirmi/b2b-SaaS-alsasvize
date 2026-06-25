import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UsersService } from './users.service';

// Every route requires a valid JWT (cookie) AND a matching role.
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Create a staff member (USERS + STAFF) — admin only. */
  @Post('staff')
  @Roles(Role.ADMIN)
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }

  /** Create a customer account — admins and sales staff. */
  @Post('customer')
  @Roles(Role.ADMIN, Role.SALES)
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.usersService.createCustomer(dto);
  }

  /** Soft-delete (deactivate) a user — admin only. */
  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }

  /** List all users with their staff profile — admin only. */
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }
}
