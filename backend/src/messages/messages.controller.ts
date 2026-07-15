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
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../generated/prisma/enums';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesStore } from './messages.store';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly store: MessagesStore) {}

  @Post()
  @Roles(Role.ADMIN)
  send(
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.store.send(dto, user);
  }

  @Get('unread')
  @Roles(Role.ADMIN, Role.SALES, Role.DOC, Role.SEC)
  getUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.store.getUnread(user);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.SALES, Role.DOC, Role.SEC)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.store.markAsRead(id, user);
  }
}
