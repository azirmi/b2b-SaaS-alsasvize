import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SlaMonitorService } from './sla-monitor.service';

/**
 * Registers the {@link SlaMonitorService} cron. PrismaService (global) and
 * ConfigService (global) are injected implicitly; EventsModule supplies the
 * gateway used to broadcast reversions post-commit.
 */
@Module({
  imports: [EventsModule],
  providers: [SlaMonitorService],
})
export class SlaModule {}
