import { Module } from '@nestjs/common';
import { DijizinModule } from '../dijizin/dijizin.module';
import { EventsModule } from '../events/events.module';
import { VisaApplicationsController } from './visa-applications.controller';
import { VisaApplicationsService } from './visa-applications.service';

@Module({
  imports: [EventsModule, DijizinModule],
  controllers: [VisaApplicationsController],
  providers: [VisaApplicationsService],
  exports: [VisaApplicationsService],
})
export class VisaApplicationsModule {}
