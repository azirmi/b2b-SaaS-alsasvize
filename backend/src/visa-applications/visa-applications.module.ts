import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { VisaApplicationsController } from './visa-applications.controller';
import { VisaApplicationsService } from './visa-applications.service';

@Module({
  imports: [EventsModule],
  controllers: [VisaApplicationsController],
  providers: [VisaApplicationsService],
  exports: [VisaApplicationsService],
})
export class VisaApplicationsModule {}
