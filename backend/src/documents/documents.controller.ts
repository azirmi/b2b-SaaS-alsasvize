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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/enums';
import { DocumentsService } from './documents.service';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// Every route requires a valid JWT cookie AND a matching role.
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** Request a presigned upload URL and create the document record. */
  @Post('presigned-url')
  @Roles(Role.CUSTOMER, Role.DOC, Role.ADMIN)
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
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.approve(id);
  }
}
