import { Module } from '@nestjs/common';
import { VisaApplicationsController } from './visa-applications.controller';
import { VisaApplicationsService } from './visa-applications.service';

@Module({
  controllers: [VisaApplicationsController],
  providers: [VisaApplicationsService],
  exports: [VisaApplicationsService],
})
export class VisaApplicationsModule {}
