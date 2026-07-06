import {
  Body,
  Controller,
  Delete,
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
import { DocumentsService } from './documents.service';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// Every route requires a valid JWT cookie AND a matching role.
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** Request a presigned upload URL and create the document record. */
  @Post('presigned-url')
  @Roles(Role.CUSTOMER, Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  createUploadUrl(
    @Body() dto: CreatePresignedUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.createUploadUrl(dto, user);
  }

  /** Get a presigned download URL for a document. */
  @Get(':id/download')
  @Roles(Role.CUSTOMER, Role.SALES, Role.DOC, Role.SEC, Role.ADMIN)
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.createDownloadUrl(id, user);
  }

  /** Approve a document (Doc staff / admin only). */
  @Patch(':id/approve')
  @Roles(Role.DOC, Role.ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.approve(id, user);
  }

  /** Reject a document with a reason (Doc staff / admin only). */
  @Patch(':id/reject')
  @Roles(Role.DOC, Role.ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reject(id, dto, user);
  }

  /** Delete a document (its owner customer, or an admin). */
  @Delete(':id')
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.remove(id, user);
  }
}
