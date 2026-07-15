import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesStore } from './messages.store';

@Module({
  controllers: [MessagesController],
  providers: [MessagesStore],
})
export class MessagesModule {}
