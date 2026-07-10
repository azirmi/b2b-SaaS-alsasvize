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
  Query,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ForceStageDto } from './dto/force-stage.dto';
import { PauseApplicationDto } from './dto/pause-application.dto';
import { ReassignApplicationDto } from './dto/reassign-application.dto';
import { ResumeApplicationDto } from './dto/resume-application.dto';
import { SendDijizinFormDto } from './dto/send-dijizin-form.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { UpdateApplicationCrmDto } from './dto/update-application-crm.dto';
import { UpdateAppointmentOpsDto } from './dto/update-appointment-ops.dto';
import { UpsertApplicationDetailsDto } from './dto/upsert-application-details.dto';
import { VerifyDijizinConsentDto } from './dto/verify-dijizin-consent.dto';
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

  /** Staff workspace: applications assigned to the caller in their active stage. */
  @Get('assigned')
  @Roles(Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  getAssigned(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getAssigned(user);
  }

  /** Sales history: applications this sales rep has processed (read-only tracking). */
  @Get('sales-history')
  @Roles(Role.SALES, Role.ADMIN)
  getSalesHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSalesHistory(user);
  }

  /**
   * God-Mode: every application across all stages (admin only).
   * Supports full-text search (`q`) and staff-focused filtering (`staffId`).
   */
  @Get('all')
  @Roles(Role.ADMIN)
  getAll(
    @Query('q') q?: string,
    @Query('staffId') staffId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
  ) {
    return this.service.getAll({ q, staffId, sortBy, sortDirection });
  }

  /** Global appointment agenda for admin/doc with date+time, city and owner info. */
  @Get('appointments')
  @Roles(Role.ADMIN, Role.DOC)
  getAppointments(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getAppointments(user);
  }

  /** DOC/admin: active sibling applications under the same customer account. */
  @Get(':id/linked-active')
  @Roles(Role.ADMIN, Role.DOC)
  getLinkedActiveApplications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getLinkedActiveApplications(id, user);
  }

  /** Sales CRM integration: sends Dijizin KVKK consent OTP over SMS. */
  @Post(':id/dijizin/consent/sms')
  @Roles(Role.SALES, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  sendDijizinConsentSms(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendDijizinConsentSms(id, user);
  }

  /** Sales CRM integration: verifies the Dijizin KVKK OTP and unlocks gating. */
  @Post(':id/dijizin/consent/verify')
  @Roles(Role.SALES, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  verifyDijizinConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDijizinConsentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.verifyDijizinConsent(id, dto, user);
  }

  /** Sales CRM integration: active system forms + customer's sent forms. */
  @Get(':id/dijizin/forms')
  @Roles(Role.SALES, Role.ADMIN)
  getDijizinForms(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getDijizinForms(id, user);
  }

  /** Sales CRM integration: sends the selected Dijizin form to the customer. */
  @Post(':id/dijizin/forms/send')
  @Roles(Role.SALES, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  sendDijizinForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDijizinFormDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendDijizinForm(id, dto, user);
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

  /** Save the Sales CRM data entry (applicant details, target country, invoice). */
  @Patch(':id')
  @Roles(Role.SALES, Role.ADMIN)
  updateCrm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationCrmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateCrm(id, dto, user);
  }

  /** DOC + admin: persist appointment city/date and enforce minimum travel date by country. */
  @Patch(':id/appointment-ops')
  @Roles(Role.DOC, Role.ADMIN)
  updateAppointmentOps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentOpsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateAppointmentOps(id, dto, user);
  }

  /** Customer's comprehensive application form ("Başvuru Formu"). Owner/admin write; staff read-only. */
  @Put(':id/details')
  @Roles(Role.CUSTOMER, Role.ADMIN)
  updateDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertApplicationDetailsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateDetails(id, dto, user);
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

  /** God-Mode: force an application into any stage (admin only). */
  @Patch(':id/force-stage')
  @Roles(Role.ADMIN)
  forceStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForceStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.forceStage(id, dto, user);
  }
}
