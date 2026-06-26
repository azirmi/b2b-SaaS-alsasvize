import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateApplicationDto } from './dto/create-application.dto';
import { PauseApplicationDto } from './dto/pause-application.dto';
import { ReassignApplicationDto } from './dto/reassign-application.dto';
import { ResumeApplicationDto } from './dto/resume-application.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { VisaApplicationsService } from './visa-applications.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// Every route requires a valid JWT cookie AND a matching role.
@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisaApplicationsController {
  constructor(private readonly service: VisaApplicationsService) {}

  /** Create a new application (starts in SALES_POOL). Customers and sales/admin. */
  @Post()
  @Roles(Role.CUSTOMER, Role.SALES, Role.ADMIN)
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  /** Customer-facing: list all applications belonging to the authenticated customer. */
  @Get('mine')
  @Roles(Role.CUSTOMER)
  getMyApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyApplications(user);
  }

  /** Role-filtered work pool. */
  @Get('pool')
  @Roles(Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  getPool(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPool(user);
  }

  /** Full application detail. Per-record access is enforced in the service. */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  /** Claim an application from the caller's pool. */
  @Post(':id/claim')
  @Roles(Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  claim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.claim(id, user);
  }

  /** Advance an application to the next logical stage. */
  @Patch(':id/stage')
  @Roles(Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  transitionStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.transitionStage(id, dto, user);
  }

  /** Pause an in-flight application (stops SLA clock). Staff and admin only. */
  @Patch(':id/pause')
  @Roles(Role.ADMIN, Role.SALES, Role.DOC, Role.SEC)
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PauseApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.pause(id, dto, user);
  }

  /** Resume a paused application back to its pre-pause stage (restarts SLA clock). */
  @Patch(':id/resume')
  @Roles(Role.ADMIN, Role.SALES, Role.DOC, Role.SEC)
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResumeApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resume(id, dto, user);
  }

  /** God-Mode: force-reassign an application to another staff member (admin only). */
  @Patch(':id/reassign')
  @Roles(Role.ADMIN)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reassign(id, dto, user);
  }

  /** God-Mode: immediately cancel an application (admin only). */
  @Patch(':id/force-cancel')
  @Roles(Role.ADMIN)
  forceCancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.forceCancel(id, user);
  }
}
